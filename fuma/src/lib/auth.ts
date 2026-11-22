import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { env } from "cloudflare:workers";
import * as d1Table from "./db/d1";
import * as pgTable from "./db/pg";
import { createDB, getDbBackend } from "./db/db";

export const createAuth = () => {
  const backend = getDbBackend();
  const db = createDB();
  const table = backend === "d1" ? d1Table : pgTable;
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: backend === "d1" ? "sqlite" : "pg",
      schema: {
        verifications: table.verifications,
        users: table.users,
        accounts: table.accounts,
        sessions: table.sessions,
      },
      usePlural: true,
    }),
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID as string,
        clientSecret: env.GOOGLE_CLIENT_SECRET as string,
      },
    },
  });
};
