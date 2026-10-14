import type { D1Database } from '@cloudflare/workers-types'
import { createFileRoute } from '@tanstack/react-router'
import { bindings } from '../../lib/bindings.server'
const COOKIE = 'cheolcity_session'
const encoder = new TextEncoder()
const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
const b64 = (bytes: Uint8Array) => btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''))
const unb64 = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0))
async function digest(value: string) { return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))) }
async function passwordHash(password: string, setStage: (stage: string) => void = () => {}) {
  setStage('setup-password-random-salt')
  const salt = crypto.getRandomValues(new Uint8Array(16)), rounds = 100000
  setStage('setup-password-import-key')
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  setStage('setup-password-derive-bits')
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: rounds, hash: 'SHA-256' }, key, 256))
  setStage('setup-password-encode')
  return 'pbkdf2$' + rounds + '$' + b64(salt) + '$' + b64(bits)
}
async function verifyPassword(password: string, stored: string) {
  const [kind, rounds, saltText, hashText] = stored.split('$')
  if (kind !== 'pbkdf2' || !rounds || !saltText || !hashText) return false
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: unb64(saltText), iterations: Number(rounds), hash: 'SHA-256' }, key, 256))
  const expected = unb64(hashText)
  if (bits.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < bits.length; i++) diff |= bits[i] ^ expected[i]
  return diff === 0
}
function tokenFrom(request: Request) { return request.headers.get('cookie')?.split(';').map((p) => p.trim()).find((p) => p.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1) ?? null }
function json(data: unknown, status = 200, headers?: HeadersInit) { return Response.json(data, { status, headers }) }
async function ensureSignupTable(db: D1Database) { await db.prepare('CREATE TABLE IF NOT EXISTS signup_requests (id TEXT PRIMARY KEY, number INTEGER NOT NULL UNIQUE, name TEXT NOT NULL, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run() }
async function currentUser(request: Request, db: D1Database) {
  const token = tokenFrom(request)
  if (!token) return null
  return db.prepare("SELECT u.id,u.username,u.display_name,u.role,u.player_id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at > datetime('now') AND u.active=1").bind(await digest(token)).first<any>()
}
async function createSession(userId: string, db: D1Database) {
  const token = b64(crypto.getRandomValues(new Uint8Array(32))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  await db.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,datetime('now','+14 days'))").bind(await digest(token), userId).run()
  return COOKIE + '=' + token + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=1209600'
}
export const Route = createFileRoute('/api/auth')({
  server: { handlers: {
    GET: async ({ request }) => {
      const db = bindings().DB
      if (!db) return json({ error: '데이터베이스가 아직 준비되지 않았습니다.' }, 503)
      await ensureSignupTable(db)
      const user = await currentUser(request, db)
      const admin = await db.prepare("SELECT COUNT(*) AS count FROM users WHERE role='admin'").first<{count:number}>()
      return json({ user, setupRequired: !admin?.count })
    },
    POST: async ({ request }) => {
      let stage = 'request'
      try {
      stage = 'check-origin'
      if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: '요청 출처를 확인할 수 없습니다.' }, 403)
      stage = 'load-database'
      const db = bindings().DB
      if (!db) return json({ error: '데이터베이스가 아직 준비되지 않았습니다.' }, 503)
      await ensureSignupTable(db)
      stage = 'read-request'
      const body = await request.json().catch(() => null) as any
      if (!body || typeof body.action !== 'string') return json({ error: '잘못된 요청입니다.' }, 400)
      if (body.action === 'change-password') {
        stage = 'change-password-authenticate'
        const user = await currentUser(request, db)
        if (!user) return json({ error: '로그인이 만료되었습니다. 다시 로그인해 주세요.' }, 401)
        const currentPassword = String(body.currentPassword ?? '')
        const newPassword = String(body.newPassword ?? '')
        if (newPassword.length < 10 || newPassword.length > 128) return json({ error: '새 비밀번호는 10자 이상 128자 이하로 입력해 주세요.' }, 400)
        const stored = await db.prepare('SELECT password_hash FROM users WHERE id=? AND active=1').bind(user.id).first<{password_hash:string}>()
        if (!stored || !(await verifyPassword(currentPassword, stored.password_hash))) return json({ error: '현재 비밀번호가 올바르지 않습니다.' }, 400)
        if (currentPassword === newPassword) return json({ error: '현재 비밀번호와 다른 비밀번호를 입력해 주세요.' }, 400)
        stage = 'change-password-save'
        const token = tokenFrom(request)
        const tokenHash = token ? await digest(token) : ''
        await db.batch([
          db.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(await passwordHash(newPassword), user.id),
          db.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').bind(user.id, tokenHash),
        ])
        return json({ ok: true })
      }
      if (body.action === 'signup') {
        const number = Number(body.number), name = String(body.name ?? '').trim(), username = String(body.username ?? '').trim().toLowerCase(), password = String(body.password ?? '')
        if (String(body.number ?? '').trim() === '' || !Number.isInteger(number) || number < 0 || number > 999 || name.length < 2 || name.length > 50 || !/^[a-z0-9._-]{3,24}$/.test(username) || password.length < 10 || password.length > 128) return json({ error: '등번호, 이름, 아이디를 확인해 주세요. 비밀번호는 10자 이상이어야 합니다.' }, 400)
        const [player, user, pendingNumber, pendingUser] = await Promise.all([
          db.prepare('SELECT id FROM players WHERE number=?').bind(number).first(),
          db.prepare('SELECT id FROM users WHERE username=?').bind(username).first(),
          db.prepare('SELECT id FROM signup_requests WHERE number=?').bind(number).first(),
          db.prepare('SELECT id FROM signup_requests WHERE username=?').bind(username).first(),
        ])
        if (player || pendingNumber) return json({ error: '이미 사용 중이거나 승인 대기 중인 등번호입니다.' }, 409)
        if (user || pendingUser) return json({ error: '이미 사용 중이거나 승인 대기 중인 아이디입니다.' }, 409)
        stage = 'signup-password-hash'
        const hashedPassword = await passwordHash(password)
        stage = 'signup-save-request'
        await db.prepare('INSERT INTO signup_requests(id,number,name,username,password_hash) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(), number, name, username, hashedPassword).run()
        return json({ ok: true, pending: true })
      }
      if (body.action === 'logout') {
        stage = 'logout-session'
        const token = tokenFrom(request)
        if (token) await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run()
        return json({ ok: true }, 200, { 'Set-Cookie': COOKIE + '=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0' })
      }
      if (body.action === 'setup') {
        stage = 'setup-check-admin'
        const admin = await db.prepare("SELECT COUNT(*) AS count FROM users WHERE role='admin'").first<{count:number}>()
        if (admin?.count) return json({ error: '초기 관리자 등록이 이미 완료되었습니다.' }, 409)
        const code = String(body.setupCode ?? '').trim(), username = String(body.username ?? '').trim().toLowerCase()
        const displayName = String(body.displayName ?? '').trim(), password = String(body.password ?? '')
        if (code.length < 12 || !/^[a-z0-9._-]{3,24}$/.test(username) || displayName.length < 2 || password.length < 10) return json({ error: '초기 코드, 아이디, 이름을 확인하고 비밀번호는 10자 이상 입력해 주세요.' }, 400)
        stage = 'setup-check-code'
        const stored = await db.prepare("SELECT value FROM app_config WHERE key='setup_code_hash'").first<{value:string}>()
        if (!stored?.value || stored.value !== await digest(code)) return json({ error: '초기 등록 코드가 올바르지 않습니다.' }, 403)
        stage = 'setup-password-hash'
        const hashedPassword = await passwordHash(password, (nextStage) => { stage = nextStage })
        const id = crypto.randomUUID()
        stage = 'setup-insert-admin'
        await db.prepare('INSERT INTO users(id,username,display_name,password_hash,role) VALUES(?,?,?,?,?)').bind(id, username, displayName, hashedPassword, 'admin').run()
        stage = 'setup-mark-code-used'
        await db.prepare("UPDATE app_config SET value='used' WHERE key='setup_code_hash'").run()
        stage = 'setup-create-session'
        const cookie = await createSession(id, db)
        return json({ ok: true }, 200, { 'Set-Cookie': cookie })
      }
      if (body.action === 'login') {
        stage = 'login-read-user'
        const username = String(body.username ?? '').trim().toLowerCase(), password = String(body.password ?? '')
        const user = await db.prepare('SELECT id,password_hash,active FROM users WHERE username=?').bind(username).first<any>()
        if (!user || !user.active || !(await verifyPassword(password, user.password_hash))) return json({ error: '아이디 또는 비밀번호를 확인해 주세요.' }, 401)
        stage = 'login-create-session'
        return json({ ok: true }, 200, { 'Set-Cookie': await createSession(user.id, db) })
      }
      return json({ error: '지원하지 않는 요청입니다.' }, 400)
      } catch (error) {
        if (error instanceof Error && /UNIQUE constraint failed/.test(error.message)) return json({ error: '이미 등록된 등번호 또는 아이디입니다.' }, 409)
        console.error('Cheol City authentication request failed at', stage, error)
        return json({ error: '요청 처리 중 서버 오류가 발생했습니다. 오류 위치: ' + stage + '. 이 문구를 운영진에게 전달해 주세요.' }, 500)
      }
    },
  } },
})
