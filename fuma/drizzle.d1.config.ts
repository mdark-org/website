import { defineConfig } from "drizzle-kit";

// Cloudflare D1 (content database). The schema is *defined* in @repo/source; migrations are
// *generated here*, next to the Postgres ones:
//
//   pnpm db:gen:d1      drizzle-kit -> drizzle/migrations/<ts>_<name>/migration.sql
//                       scripts/sync-d1-migration.ts -> drizzle/d1/NNNN_<name>.sql (what `cf d1 migrations apply` reads)
//   cf d1 migrations apply <database-id> --dir drizzle/d1
export default defineConfig({
  dialect: "sqlite",
  schema: ["../packages/source/src/db/schema/content.ts", "../packages/source/src/db/schema/sync.ts"],
  out: "./drizzle/migrations",
});
