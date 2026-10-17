import { Application, Router } from "express";
import swaggerUi from "swagger-ui-express";
import { buildOpenApiSpec } from "../docs/openapi";

export const createDocsRouter = (app: Application) => {
  const docsRouter = Router();
  let spec: ReturnType<typeof buildOpenApiSpec> | undefined;

  // Built on first request, not at mount time, so routers registered after this one are included.
  docsRouter.get("/openapi.json", (_req, res) => {
    spec ??= buildOpenApiSpec(app);
    res.json(spec);
  });

  docsRouter.use("/", swaggerUi.serve, swaggerUi.setup(undefined, { swaggerOptions: { url: "/api/docs/openapi.json", persistAuthorization: true } }));

  return docsRouter;
};
