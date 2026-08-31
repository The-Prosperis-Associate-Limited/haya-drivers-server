/// <reference types="node" />
import "dotenv/config";
import { defineConfig } from "prisma/config";

const { DATABASE_URL } = process.env;

export default defineConfig({
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: DATABASE_URL,
  },
});
