import { Application } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { ZodObject, ZodOptional, ZodType, ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { AdminWriteDomain } from "../middleware/adminAccess";
import { credentialLimiter, emailSendLimiter } from "../middleware/rateLimit";
import * as adminSchemas from "../utils/types/adminValidatorSchema";
import * as authSchemas from "../utils/types/authValidatorSchema";
import * as bookingSchemas from "../utils/types/bookingValidatorSchema";
import * as chatSchemas from "../utils/types/chatValidatorSchema";
import * as clientSchemas from "../utils/types/clientValidatorSchema";
import * as driverSchemas from "../utils/types/driverValidatorSchema";
import * as earningsSchemas from "../utils/types/earningsValidatorSchema";
import * as hireSchemas from "../utils/types/hireValidatorSchema";
import * as notificationSchemas from "../utils/types/notificationValidatorSchema";
import * as referralSchemas from "../utils/types/referralValidatorSchema";
import * as requestSchemas from "../utils/types/requestValidatorSchema";
import * as ticketSchemas from "../utils/types/ticketValidatorSchema";
import * as trainingSchemas from "../utils/types/trainingValidatorSchema";
import { findRouteSource, HandlerInputs, InputSource, RouteSource, scanControllers, scanRoutes } from "./sourceScan";

type Middleware = Function & { adminWriteDomain?: AdminWriteDomain };
type Layer = {
  handle: Middleware & { stack?: Layer[] };
  method?: string;
  regexp: RegExp & { fast_slash?: boolean };
  keys: { name: string }[];
  route?: { path: unknown; methods: Record<string, boolean>; stack: Layer[] };
};
type Scoped = { path: string; fn: Middleware };
type Endpoint = { verb: string; path: string; routePath: string; tag: string; middleware: Middleware[]; handler: Middleware; routerKeys: Set<string> };
type JsonSchema = Record<string, unknown>;

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HTTP_VERBS = new Set(["get", "post", "put", "patch", "delete"]);
const DOCS_PREFIX = "/api/docs";

const ROLE_GUARDS: Record<string, string> = {
  validateDriverSession: "DRIVER",
  validateClientSession: "CLIENT",
  validateAdminSession: "ADMIN",
};

const GUARD_NOTES: Record<string, string> = {
  validateRefreshToken: "Takes the refresh token from `refreshToken` in the body or the refresh cookie.",
  validateGoogleVerificationToken: "The `tokenId` path segment is the one-time token from the Google OAuth redirect.",
  requireVerifiedDriver: "The driver must have passed verification. Admins pass through.",
  requireSuperAdmin: "Super admins only.",
};

const RATE_LIMITS = new Map<Function, string>([
  [credentialLimiter, "20 requests per 15 minutes per IP"],
  [emailSendLimiter, "5 requests per 15 minutes per IP"],
]);

const ZOD_SCHEMAS = new Map(
  [
    adminSchemas,
    authSchemas,
    bookingSchemas,
    chatSchemas,
    clientSchemas,
    driverSchemas,
    earningsSchemas,
    hireSchemas,
    notificationSchemas,
    referralSchemas,
    requestSchemas,
    ticketSchemas,
    trainingSchemas,
  ]
    .flatMap((module) => Object.entries(module))
    .filter((entry): entry is [string, ZodTypeAny] => entry[1] instanceof ZodType),
);

const toJsonSchema = (schema: ZodTypeAny) => {
  const unwrapped = schema instanceof ZodOptional ? schema.unwrap() : schema;
  const { $schema, ...json } = zodToJsonSchema(unwrapped, { target: "openApi3", $refStrategy: "none" }) as JsonSchema;
  return json;
};

const mountPath = (layer: Layer) => {
  if (layer.regexp.fast_slash) return "";

  let key = 0;
  return layer.regexp.source
    .replace(/^\^/, "")
    .replace(/\\\/\?\(\?=\\\/\|\$\)$/, "")
    .replace(/\(\?:\\\/\(\[\^\\?\/\]\+\?\)\)/g, () => `/:${layer.keys[key++]?.name ?? "param"}`)
    .replace(/\\(.)/g, "$1");
};

const scopedTo = (scoped: Scoped[], target: string) => scoped.filter(({ path }) => target === path || target.startsWith(`${path}/`)).map(({ fn }) => fn);

const handlerName = (fn: Middleware) => fn.name.replace(/^bound /, "");

const routeLayers = (route: NonNullable<Layer["route"]>, verb: string) => route.stack.filter((routeLayer) => !routeLayer.method || routeLayer.method === verb);

const routeVerbs = (route: NonNullable<Layer["route"]>) => Object.keys(route.methods).filter((method) => HTTP_VERBS.has(method));

const collectEndpoints = (stack: Layer[], prefix = "", inherited: Middleware[] = []): Endpoint[] => {
  const endpoints: Endpoint[] = [];
  const middleware = [...inherited];
  const scoped: Scoped[] = [];

  const routerKeys = new Set(
    stack.flatMap(({ route }) =>
      route && typeof route.path === "string"
        ? routeVerbs(route).map((verb) => `${verb} ${route.path} ${handlerName(routeLayers(route, verb).at(-1)!.handle)}`)
        : [],
    ),
  );

  for (const layer of stack) {
    if (layer.route) {
      if (typeof layer.route.path !== "string") continue;

      for (const verb of routeVerbs(layer.route)) {
        const layers = routeLayers(layer.route, verb);
        const fullPath = `${prefix}${layer.route.path}`.replace(/\/+/g, "/").replace(/(.)\/$/, "$1");

        endpoints.push({
          verb,
          path: fullPath,
          routePath: layer.route.path,
          tag: prefix.replace(/^\/(api\/?)?/, "") || "general",
          middleware: [...middleware, ...scopedTo(scoped, layer.route.path), ...layers.slice(0, -1).map((routeLayer) => routeLayer.handle)],
          handler: layers[layers.length - 1].handle,
          routerKeys,
        });
      }
    } else if (layer.handle.stack) {
      const mount = mountPath(layer);
      endpoints.push(...collectEndpoints(layer.handle.stack, `${prefix}${mount}`, [...middleware, ...scopedTo(scoped, mount)]));
    } else if (layer.regexp.fast_slash) {
      middleware.push(layer.handle);
    } else {
      scoped.push({ path: mountPath(layer), fn: layer.handle });
    }
  }

  return endpoints;
};

const humanize = (name: string) => {
  const words = name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const describe = (endpoint: Endpoint, source: RouteSource | undefined) => {
  const names = endpoint.middleware.map((fn) => fn.name);
  const role = names.map((name) => ROLE_GUARDS[name]).filter(Boolean).at(-1);
  const writeDomain = endpoint.verb !== "get" && endpoint.middleware.map((fn) => fn.adminWriteDomain).find(Boolean);
  const rateLimit = endpoint.middleware.map((fn) => RATE_LIMITS.get(fn)).find(Boolean);

  return [
    role && `**Role:** ${role}`,
    writeDomain && `**Admin write access:** an admin role permitted to change \`${writeDomain}\`.`,
    rateLimit && `**Rate limit:** ${rateLimit}.`,
    endpoint.path.startsWith("/webhooks") && "Called by the payment provider and authenticated by its signature header, not a token.",
    ...names.map((name) => GUARD_NOTES[name]),
    source && `**Handler:** \`${source.handler}\``,
  ]
    .filter(Boolean)
    .join("\n\n");
};

const security = (middleware: Middleware[]) => {
  const names = new Set(middleware.map((fn) => fn.name));
  return names.has("validateAccessToken") ? [{ bearerAuth: [] }, { cookieAuth: [] }] : undefined;
};

const queryParameters = (query: InputSource) => {
  const schema = query.schema && ZOD_SCHEMAS.get(query.schema);
  const shape = schema instanceof ZodObject ? (schema.shape as Record<string, ZodTypeAny>) : {};
  const names = new Set([...Object.keys(shape), ...query.fields, ...query.fieldSchemas.keys()]);

  return [...names].map((name) => {
    const fieldSchema = shape[name] ?? ZOD_SCHEMAS.get(query.fieldSchemas.get(name) ?? "");
    return {
      name,
      in: "query",
      required: shape[name] ? !shape[name].isOptional() : false,
      schema: fieldSchema ? toJsonSchema(fieldSchema) : { type: "string" },
    };
  });
};

const requestBody = (body: InputSource, source: RouteSource | undefined, components: Record<string, JsonSchema>) => {
  const schema = body.schema && ZOD_SCHEMAS.get(body.schema);
  if (schema && body.schema && !components[body.schema]) components[body.schema] = toJsonSchema(schema);

  const fieldProperties = Object.fromEntries([...body.fields].map((name) => [name, {}]));
  const uploads = source?.uploads ?? [];

  if (uploads.length) {
    const files = Object.fromEntries(
      uploads.map(({ name, multiple }) => [name, multiple ? { type: "array", items: { type: "string", format: "binary" } } : { type: "string", format: "binary" }]),
    );
    const properties = { ...fieldProperties, ...((schema && (components[body.schema!].properties as JsonSchema)) ?? {}), ...files };
    return { content: { "multipart/form-data": { schema: { type: "object", properties } } } };
  }

  if (schema) return { required: true, content: { "application/json": { schema: { $ref: `#/components/schemas/${body.schema}` } } } };
  if (body.fields.size) return { content: { "application/json": { schema: { type: "object", properties: fieldProperties } } } };
  return undefined;
};

const responses = (endpoint: Endpoint, inputs: HandlerInputs | undefined) => {
  const names = new Set(endpoint.middleware.map((fn) => fn.name));
  const authed = names.has("validateAccessToken") || names.has("validateRefreshToken");
  const gated =
    [...names].some((name) => ROLE_GUARDS[name] || name === "requireVerifiedDriver" || name === "requireSuperAdmin") ||
    (endpoint.verb !== "get" && endpoint.middleware.some((fn) => fn.adminWriteDomain));

  return {
    200: { description: "Success" },
    ...((inputs?.body.schema || inputs?.query.schema) && { 400: { description: "Validation failed" } }),
    ...(authed && { 401: { description: "Missing or invalid token" } }),
    ...(gated && { 403: { description: "Wrong role, unverified driver, or an admin role without access" } }),
    ...(endpoint.middleware.some((fn) => RATE_LIMITS.has(fn)) && { 429: { description: "Rate limit exceeded" } }),
  };
};

export const buildOpenApiSpec = (app: Application) => {
  const routeScan = scanRoutes(path.join(SRC_ROOT, "routes"));
  const handlerInputs = scanControllers(path.join(SRC_ROOT, "controllers"));
  const components: Record<string, JsonSchema> = {};
  const paths: Record<string, Record<string, unknown>> = {};
  const operationIds = new Set<string>();

  const { stack } = (app as unknown as { _router: { stack: Layer[] } })._router;

  for (const endpoint of collectEndpoints(stack)) {
    if (endpoint.path.startsWith(DOCS_PREFIX)) continue;

    const name = handlerName(endpoint.handler);
    const source = findRouteSource(routeScan, `${endpoint.verb} ${endpoint.routePath} ${name}`, endpoint.routerKeys);
    const inputs = source?.inputs ?? (source && handlerInputs.get(source.handler));
    const pathParams = [...endpoint.path.matchAll(/:(\w+)\??/g)].map(([, name]) => ({ name, in: "path", required: true, schema: { type: "string" } }));

    let operationId = name && source ? source.handler : `${endpoint.verb}${endpoint.path.replace(/\W+/g, "_")}`;
    while (operationIds.has(operationId)) operationId += "_";
    operationIds.add(operationId);

    const body = endpoint.verb !== "get" && inputs ? requestBody(inputs.body, source, components) : undefined;
    const openApiPath = endpoint.path.replace(/:(\w+)\??/g, "{$1}");

    paths[openApiPath] ??= {};
    paths[openApiPath][endpoint.verb] = {
      tags: [endpoint.tag],
      operationId,
      summary: name ? humanize(name) : `${endpoint.verb.toUpperCase()} ${endpoint.path}`,
      description: describe(endpoint, source) || undefined,
      security: security(endpoint.middleware),
      parameters: [...pathParams, ...(inputs ? queryParameters(inputs.query) : [])],
      ...(body && { requestBody: body }),
      responses: responses(endpoint, inputs),
    };
  }

  return {
    openapi: "3.0.3",
    info: {
      title: "Haya Drivers API",
      version: process.env.npm_package_version ?? "1.0.0",
      description: "Generated at startup from the live Express router and the controller source.",
    },
    servers: [{ url: "/" }],
    paths,
    components: {
      schemas: components,
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        cookieAuth: { type: "apiKey", in: "cookie", name: "session_id" },
      },
    },
  };
};
