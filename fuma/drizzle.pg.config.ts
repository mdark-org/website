import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle/pg/migrations",
  schema: [
    "./src/lib/db/pg/index.ts",
    "../packages/source/src/db/schema/pg/namespace.ts",
    "../packages/source/src/db/schema/pg/content.ts",
    "../packages/source/src/db/schema/pg/sync.ts",
  ],
  dialect: "postgresql",
  schemaFilter: ["mdark"],
  migrations: {
    table: "__drizzle_migrations_mdark",
    schema: "drizzle",
  },
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
