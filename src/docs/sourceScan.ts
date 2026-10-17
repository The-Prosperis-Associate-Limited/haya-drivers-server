import fs from "fs";
import path from "path";
import ts from "typescript";

export type InputSource = { schema?: string; fields: Set<string>; fieldSchemas: Map<string, string> };
export type HandlerInputs = { body: InputSource; query: InputSource };
export type RouteSource = { handler: string; file: string; uploads: { name: string; multiple: boolean }[]; inputs?: HandlerInputs };

const HTTP_VERBS = new Set(["get", "post", "put", "patch", "delete"]);
const PARSE_METHODS = new Set(["parse", "safeParse", "parseAsync", "safeParseAsync"]);

const listSourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(full);
    return /\.(ts|js)$/.test(entry.name) && !entry.name.endsWith(".d.ts") ? [full] : [];
  });

const parseFile = (file: string) => ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);

const visit = (node: ts.Node, fn: (node: ts.Node) => void) => {
  fn(node);
  node.forEachChild((child) => visit(child, fn));
};

const isFunctionLike = (node: ts.Node | undefined): node is ts.ArrowFunction | ts.FunctionExpression =>
  !!node && (ts.isArrowFunction(node) || ts.isFunctionExpression(node));

const handlerTarget = (expression: ts.Expression) => {
  const target =
    ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression) && expression.expression.name.text === "bind"
      ? expression.expression.expression
      : expression;

  if (ts.isIdentifier(target)) return { instance: undefined, method: target.text };
  if (!ts.isPropertyAccessExpression(target) || !ts.isIdentifier(target.expression)) return undefined;
  return { instance: target.expression.text, method: target.name.text };
};

const uploadFields = (expression: ts.Expression): RouteSource["uploads"] => {
  if (!ts.isCallExpression(expression) || !ts.isPropertyAccessExpression(expression.expression)) return [];

  const [first] = expression.arguments;
  const kind = expression.expression.name.text;

  if ((kind === "single" || kind === "array") && first && ts.isStringLiteralLike(first)) return [{ name: first.text, multiple: kind === "array" }];
  if (kind !== "fields" || !first || !ts.isArrayLiteralExpression(first)) return [];

  return first.elements.flatMap((element) => {
    if (!ts.isObjectLiteralExpression(element)) return [];
    const name = element.properties.find((property) => property.name?.getText() === "name");
    return name && ts.isPropertyAssignment(name) && ts.isStringLiteralLike(name.initializer) ? [{ name: name.initializer.text, multiple: true }] : [];
  });
};

const emptyInputs = (): HandlerInputs => ({
  body: { fields: new Set(), fieldSchemas: new Map() },
  query: { fields: new Set(), fieldSchemas: new Map() },
});

const scanHandler = (fn: ts.FunctionLikeDeclaration, source: ts.SourceFile) => {
  const inputs = emptyInputs();
  const [firstParam] = fn.parameters;
  const req = firstParam && ts.isIdentifier(firstParam.name) ? firstParam.name.text : "req";
  const aliases = new Map<string, keyof HandlerInputs>();

  const sourceOf = (expression: ts.Expression): keyof HandlerInputs | undefined => {
    const text = expression.getText(source);
    if (text === `${req}.body`) return "body";
    if (text === `${req}.query`) return "query";
    return aliases.get(text);
  };

  const unwrap = (expression: ts.Expression): ts.Expression =>
    ts.isAsExpression(expression) || ts.isParenthesizedExpression(expression) ? unwrap(expression.expression) : expression;

  const fieldOf = (expression: ts.Expression) => {
    const unwrapped = ts.isBinaryExpression(expression) ? expression.left : expression;
    if (!ts.isPropertyAccessExpression(unwrapped) && !ts.isElementAccessExpression(unwrapped)) return undefined;

    const from = sourceOf(unwrapped.expression);
    const name = ts.isPropertyAccessExpression(unwrapped)
      ? unwrapped.name.text
      : ts.isStringLiteralLike(unwrapped.argumentExpression)
        ? unwrapped.argumentExpression.text
        : undefined;

    return from && name ? { from, name } : undefined;
  };

  visit(fn, (node) => {
    if (!ts.isVariableDeclaration(node) || !node.initializer) return;

    const initializer = unwrap(node.initializer);

    if (ts.isIdentifier(node.name)) {
      const from = sourceOf(initializer);
      if (from) aliases.set(node.name.text, from);
      return;
    }

    if (!ts.isObjectBindingPattern(node.name)) return;

    const from = sourceOf(initializer);
    const isReq = initializer.getText(source) === req;

    for (const element of node.name.elements) {
      const key = (element.propertyName ?? element.name).getText(source);
      if (from) inputs[from].fields.add(key);
      if (isReq && (key === "body" || key === "query") && ts.isIdentifier(element.name)) aliases.set(element.name.text, key);
    }
  });

  visit(fn, (node) => {
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const field = fieldOf(node);
      if (field) inputs[field.from].fields.add(field.name);
    }

    if (!ts.isCallExpression(node)) return;

    if (ts.isIdentifier(node.expression) && node.expression.text === "parsePagination" && node.arguments[0] && sourceOf(node.arguments[0]) === "query") {
      inputs.query.fields.add("page");
      inputs.query.fields.add("limit");
      return;
    }

    if (!ts.isPropertyAccessExpression(node.expression)) return;
    if (!PARSE_METHODS.has(node.expression.name.text) || !ts.isIdentifier(node.expression.expression)) return;

    const schema = node.expression.expression.text;
    const [arg] = node.arguments;
    if (!arg) return;

    const whole = ts.isObjectLiteralExpression(arg)
      ? arg.properties.map((property) => (ts.isSpreadAssignment(property) ? sourceOf(property.expression) : undefined)).find(Boolean)
      : sourceOf(arg);

    if (whole) {
      inputs[whole].schema = schema;
      return;
    }

    const field = fieldOf(arg);
    if (field) inputs[field.from].fieldSchemas.set(field.name, schema);
  });

  return inputs;
};

export type RouteScan = { routes: Map<string, RouteSource[]>; fileKeys: Map<string, Set<string>> };

export const scanRoutes = (routesDir: string): RouteScan => {
  const routes = new Map<string, RouteSource[]>();
  const fileKeys = new Map<string, Set<string>>();

  for (const file of listSourceFiles(routesDir)) {
    const source = parseFile(file);
    const relativeFile = path.relative(routesDir, file).replace(/\\/g, "/");
    const instances = new Map<string, string>();
    const keys = new Set<string>();
    fileKeys.set(relativeFile, keys);

    visit(source, (node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isNewExpression(node.initializer)) {
        instances.set(node.name.text, node.initializer.expression.getText(source));
      }
    });

    visit(source, (node) => {
      if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return;

      const verb = node.expression.name.text;
      const [routePath, ...handlers] = node.arguments;
      if (!HTTP_VERBS.has(verb) || !routePath || !ts.isStringLiteralLike(routePath) || !handlers.length) return;

      const last = handlers[handlers.length - 1];
      const uploads = handlers.flatMap(uploadFields);

      if (isFunctionLike(last)) {
        const key = `${verb} ${routePath.text} `;
        keys.add(key);
        routes.set(key, [...(routes.get(key) ?? []), { handler: `inline handler in routes/${relativeFile}`, file: relativeFile, uploads, inputs: scanHandler(last, source) }]);
        return;
      }

      const target = handlerTarget(last);
      if (!target) return;

      const key = `${verb} ${routePath.text} ${target.method}`;
      const className = target.instance && instances.get(target.instance);

      keys.add(key);
      routes.set(key, [...(routes.get(key) ?? []), { handler: className ? `${className}.${target.method}` : target.method, file: relativeFile, uploads }]);
    });
  }

  return { routes, fileKeys };
};

// Routers reuse keys like "get / list", so the file whose whole route table matches the live router's wins.
export const findRouteSource = ({ routes, fileKeys }: RouteScan, key: string, routerKeys: Set<string>) => {
  const candidates = routes.get(key) ?? [];
  if (candidates.length < 2) return candidates[0];

  const overlap = (file: string) => {
    const keys = fileKeys.get(file) ?? new Set<string>();
    const shared = [...keys].filter((fileKey) => routerKeys.has(fileKey)).length;
    return shared / (keys.size + routerKeys.size - shared);
  };

  const scored = candidates.map((candidate) => ({ candidate, score: overlap(candidate.file) }));
  const best = Math.max(...scored.map(({ score }) => score));
  const winners = scored.filter(({ score }) => score === best);

  return winners.length === 1 ? winners[0].candidate : undefined;
};

export const scanControllers = (controllersDir: string) => {
  const handlers = new Map<string, HandlerInputs>();

  for (const file of listSourceFiles(controllersDir)) {
    const source = parseFile(file);

    for (const statement of source.statements) {
      if (ts.isFunctionDeclaration(statement) && statement.name) handlers.set(statement.name.text, scanHandler(statement, source));
      if (!ts.isVariableStatement(statement)) continue;

      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && isFunctionLike(declaration.initializer)) handlers.set(declaration.name.text, scanHandler(declaration.initializer, source));
      }
    }

    visit(source, (node) => {
      if (!ts.isClassDeclaration(node) || !node.name) return;

      for (const member of node.members) {
        const fn = ts.isMethodDeclaration(member) ? member : ts.isPropertyDeclaration(member) && isFunctionLike(member.initializer) ? member.initializer : undefined;

        if (fn && member.name) handlers.set(`${node.name.text}.${member.name.getText(source)}`, scanHandler(fn, source));
      }
    });
  }

  return handlers;
};
