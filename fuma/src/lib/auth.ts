import { betterAuth } from "better-auth";
import * as table from './db/d1'
import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2';
import {createDB} from "./db/d1";
import {env} from 'cloudflare:workers'
export const createAuth = () => {
  const db = createDB()
  return betterAuth({
    baseURL: env.BASE_URL,
    database: drizzleAdapter(db, {
      provider: 'sqlite',
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
  })
}
