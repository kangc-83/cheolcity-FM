import type { D1Database } from '@cloudflare/workers-types'
import { createFileRoute } from '@tanstack/react-router'
import { bindings } from '../../lib/bindings.server'
const COOKIE = 'cheolcity_session'
const encoder = new TextEncoder()
async function digest(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))), (b) => b.toString(16).padStart(2, '0')).join('')
}
function json(data: unknown, status = 200, headers?: HeadersInit) { return Response.json(data, { status, headers }) }
async function currentUser(request: Request, db: D1Database) {
  const token = request.headers.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1)
  if (!token) return null
  return db.prepare("SELECT u.id,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>datetime('now') AND u.active=1").bind(await digest(token)).first<any>()
}
export const Route = createFileRoute('/api/backup')({
  server: { handlers: {
    GET: async ({ request }) => {
      const db = bindings().DB
      if (!db) return json({ error: '데이터베이스가 아직 준비되지 않았습니다.' }, 503)
      const user = await currentUser(request, db)
      if (!user) return json({ error: '로그인이 필요합니다.' }, 401)
      if (user.role !== 'admin') return json({ error: '관리자만 전체 백업을 만들 수 있습니다.' }, 403)
      const tables = ['app_config', 'attendance', 'gatherings', 'match_players', 'matches', 'players', 'seasons', 'signup_requests', 'team_assignments', 'users']
      const schemaRows = await db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%' ORDER BY type,name").all<any>()
      const schema = (schemaRows.results || []).filter((row: any) => row.name !== 'sessions' && row.tbl_name !== 'sessions')
      const data: Record<string, any[]> = {}
      const counts: Record<string, number> = {}
      for (const table of tables) {
        const count = table === 'app_config'
          ? await db.prepare('SELECT COUNT(*) AS count FROM app_config WHERE key<>?').bind('setup_code_hash').first<any>()
          : await db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).first<any>()
        counts[table] = Number(count?.count || 0)
        data[table] = []
        for (let offset = 0; offset < counts[table]; offset += 500) {
          const page = table === 'app_config'
            ? await db.prepare('SELECT key,value FROM app_config WHERE key<>? ORDER BY key LIMIT 500 OFFSET ?').bind('setup_code_hash', offset).all<any>()
            : await db.prepare(`SELECT * FROM ${table} ORDER BY rowid LIMIT 500 OFFSET ?`).bind(offset).all<any>()
          data[table].push(...(page.results || []))
        }
      }
      return json({
        format: 'cheolcity-full-database-backup', version: 2, exportedAt: new Date().toISOString(),
        application: 'Cheol City Football Manager', database: 'Cloudflare D1 / SQLite',
        notes: ['사용자 비밀번호 해시는 포함됩니다. 백업 파일을 안전한 장소에 보관하세요.', '로그인 세션은 보안상 제외되므로 복원 후 모든 사용자가 다시 로그인해야 합니다.', '초기 관리자 등록 코드 해시는 제외됩니다.', '이 파일은 전체 데이터와 DB 스키마 백업이며 애플리케이션 소스코드는 별도로 보관해야 합니다.'],
        excludedTables: ['sessions'], schema, counts, data,
      }, 200, { 'Cache-Control': 'no-store', 'Content-Disposition': 'attachment; filename=cheolcity-full-database-backup.json' })
    },
  } },
})
