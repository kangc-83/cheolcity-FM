import { readFile } from 'node:fs/promises'
import { createClient } from '@libsql/client'

const file = process.argv[2]
if (!file) {
  console.error('Usage: TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/restore-turso.mjs /path/to/cheolcity-restore.sql')
  process.exit(2)
}
const url = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN
if (!url || !authToken) throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required')
const sql = await readFile(file, 'utf8')
const client = createClient({ url, authToken })
console.log(`Applying ${file} to ${url}. This should be a NEW, EMPTY database.`)
await client.executeMultiple(sql)
for (const table of ['players', 'users', 'seasons', 'gatherings', 'attendance', 'matches', 'team_assignments', 'match_players', 'signup_requests', 'app_config']) {
  const result = await client.execute(`SELECT COUNT(*) AS count FROM ${table}`)
  console.log(`${table}: ${result.rows[0]?.count ?? 0}`)
}
await client.close()
console.log('Restore completed. Sessions were intentionally not restored; users must sign in again.')
