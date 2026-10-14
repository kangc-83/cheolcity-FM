# 철시티 풋볼 매니저 (Cheol City Football Manager)

학교/동호회 축구 모임 운영을 위한 웹 앱입니다. 선수 명단, 회원 계정, 모임·출석, 경기별 팀 배정, 경기 결과(득점·도움·출전시간·MVP), 통계와 데이터 백업 기능을 제공합니다.

## 프로젝트 구성

- `app/` — TanStack Start + React + TypeScript 애플리케이션
- `app/src/routes/` — 화면 및 API 라우트
- `app/migrations/` — Cloudflare D1(SQLite) 스키마 마이그레이션
- `app/packages/` — 앱이 사용하는 로컬 workspace 패키지
- `app/app.manifest.json` — 현재 호스팅 플랫폼의 D1 바인딩 선언

## 로컬 개발 환경

현재 프로젝트는 Bun 기반입니다. Bun 설치 후:

```bash
cd app
bun install --frozen-lockfile
bun run dev
```

검사 및 빌드:

```bash
bun run typecheck
bun run build
```

## 배포

현재 운영 사이트는 Higgsfield 호스팅 환경에서 실행됩니다. 이 환경은 `app.manifest.json`의 DB 선언을 읽어 Cloudflare D1 바인딩을 자동으로 주입합니다. 따라서 이 저장소만 GitHub에 올리는 것으로 다른 호스팅 사업자에 자동 배포되는 것은 아닙니다.

Vercel 병행 배포 준비 설정은 `app/vercel.json`, `app/vite.config.ts`, `app/src/lib/bindings.vercel.server.ts`에 있습니다. Vercel 환경에서는 Turso Cloud(libSQL)를 데이터베이스로 사용합니다. 다른 계정/환경으로 옮기는 절차와 주의사항은 [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)를 참고하세요. 운영 데이터 백업과 복원은 [`docs/DATA_BACKUP.md`](docs/DATA_BACKUP.md)를 참고하세요.

## 보안

- 운영 데이터 백업에는 사용자 비밀번호 해시가 포함될 수 있습니다. 공개 GitHub 저장소에 올리지 마세요.
- `.env`, API 토큰, 계정 비밀번호, 실제 운영 DB 파일은 커밋하지 마세요.
- 복원 후에는 모든 사용자가 다시 로그인해야 합니다.
