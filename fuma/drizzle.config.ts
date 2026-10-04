import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle/migrations",
  schema: ["./src/lib/db/d1/index.ts","../packages/source/src/db/schema/content.ts", "../packages/source/src/db/schema/sync.ts"],
  dialect: 'sqlite',
})