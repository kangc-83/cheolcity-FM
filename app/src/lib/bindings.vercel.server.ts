import type { D1Database } from '@cloudflare/workers-types'
import { tursoD1 } from './db-libsql-adapter.server'

type AppEnv = { DB?: D1Database; HF_ENV?: string; APP_SLUG?: string }
let database: D1Database | undefined

/** Vercel runtime bindings. The D1-compatible adapter keeps existing app SQL intact. */
export function bindings(): AppEnv {
  database ??= tursoD1()
  return { DB: database, HF_ENV: process.env.VERCEL_ENV ?? 'vercel', APP_SLUG: 'cheolcity-football-manager' }
}
