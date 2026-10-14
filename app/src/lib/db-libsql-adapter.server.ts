import { createClient, type Client, type InArgs, type ResultSet } from '@libsql/client'
import type { D1Database, D1PreparedStatement, D1Result } from '@cloudflare/workers-types'

type CompatStatement = {
  sql: string
  args: InArgs
  bind: (...values: unknown[]) => CompatStatement
  first: <T = Record<string, unknown>>(columnName?: string) => Promise<T | null>
  all: <T = Record<string, unknown>>() => Promise<D1Result<T[]>>
  run: () => Promise<D1Result>
}

let client: Client | undefined
function getClient() {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL
    const authToken = process.env.TURSO_AUTH_TOKEN
    if (!url || !authToken) throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be configured')
    client = createClient({ url, authToken })
  }
  return client
}

function normalizeValue(value: unknown) {
  if (typeof value === 'bigint') {
    const number = Number(value)
    return Number.isSafeInteger(number) ? number : value.toString()
  }
  return value
}

function rowsAsObjects(result: ResultSet) {
  return result.rows.map((row) => Object.fromEntries(result.columns.map((column, index) => [column, normalizeValue(row[index])])) )
}

function toD1Result(result: ResultSet, rows = true): D1Result {
  return {
    results: rows ? rowsAsObjects(result) : [],
    success: true,
    meta: {
      duration: 0,
      size_after: 0,
      rows_read: 0,
      rows_written: result.rowsAffected,
      last_row_id: Number(result.lastInsertRowid ?? 0),
      changes: result.rowsAffected,
      changed_db: result.rowsAffected > 0,
    },
  } as D1Result
}

function statement(sql: string): CompatStatement {
  let args: InArgs = []
  const item: CompatStatement = {
    sql,
    args,
    bind(...values: unknown[]) {
      args = values as InArgs
      item.args = args
      return item
    },
    async first<T = Record<string, unknown>>(columnName?: string): Promise<T | null> {
      const result = await getClient().execute({ sql, args })
      const row = rowsAsObjects(result)[0] as Record<string, unknown> | undefined
      if (!row) return null
      return (columnName ? row[columnName] : row) as T
    },
    async all<T = Record<string, unknown>>() {
      const result = await getClient().execute({ sql, args })
      return toD1Result(result) as D1Result<T[]>
    },
    async run() {
      const result = await getClient().execute({ sql, args })
      return toD1Result(result, false)
    },
  }
  return item
}

/** Small D1-compatible surface used by this app, backed by Turso/libSQL. */
export function tursoD1(): D1Database {
  const adapter = {
    prepare(sql: string) {
      return statement(sql) as unknown as D1PreparedStatement
    },
    async batch(statements: D1PreparedStatement[]) {
      const prepared = statements as unknown as CompatStatement[]
      const results = await getClient().batch(prepared.map(({ sql, args }) => ({ sql, args })), 'write')
      return results.map((result) => toD1Result(result, false))
    },
  }
  return adapter as unknown as D1Database
}
