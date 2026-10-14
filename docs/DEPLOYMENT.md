# GitHub 보관 및 다른 환경으로 배포하기

## 1. GitHub에 소스 올리기

1. GitHub에서 새 저장소를 만듭니다. 소스 공개가 부담되면 **Private**로 생성하세요.
2. 이 백업의 `cheolcity-source` 폴더 내용을 저장소 루트에 업로드합니다.
3. GitHub Actions가 `main` 브랜치 push 시 의존성 설치, 타입 검사, 빌드를 수행하도록 `.github/workflows/ci.yml`을 포함합니다.
4. `cheolcity-private-data-backup.json` 및 `cheolcity-private-data-backup.zip`은 절대로 저장소에 올리지 마세요.

## 2. Vercel용 데이터베이스: Turso

이 프로젝트는 Cloudflare D1(SQLite) API와 SQL을 사용하므로 첫 이전 대상은 PostgreSQL이 아니라 SQLite 호환 Turso Cloud로 정했습니다. 앱에는 D1의 `prepare/bind/first/all/run/batch` 호출을 Turso libSQL 클라이언트에 연결하는 어댑터가 포함되어 있습니다. Vercel 프로젝트의 Storage/Marketplace에서 Turso를 연결하면 `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` 환경 변수가 제공됩니다. 두 변수는 서버 전용으로 설정하고 `VITE_` 접두사를 붙이지 마세요.

## 3. 현재 운영 환경과 독립 배포의 차이

현재 앱은 Higgsfield가 제공하는 배포 파이프라인을 사용합니다. `app/app.manifest.json`의 `db: true` 선언으로 D1 데이터베이스가 프로비저닝되고, 요청 시 Cloudflare Worker의 `env.DB` 바인딩이 주입됩니다. `app/src/lib/bindings.server.ts`도 이 런타임 바인딩을 직접 사용합니다.

따라서 소스코드만 GitHub에 복사해도 독립 Cloudflare 계정에 DB가 자동 생성되거나 기존 데이터가 이동하지 않습니다. 별도 계정으로 완전히 독립 배포하려면 Cloudflare 계정, D1 데이터베이스, Worker 배포 설정 및 `env.DB` 바인딩을 새로 구성해야 합니다. 현재 `wrangler.jsonc`는 로컬 빌드용 placeholder 설정이며 운영 배포 설정이 아닙니다.

## 4. Vercel + Turso 배포 순서

1. GitHub에 저장소를 올리고 Vercel에서 해당 저장소를 Import합니다.
2. Project Settings에서 **Root Directory를 `app`**으로 지정합니다. `app/vercel.json`이 TanStack Start 프레임워크를 지정하며, Vercel이 `bun.lock`을 감지해 의존성을 설치합니다. Build Command는 `bun run build:vercel`을 사용합니다.
3. Vercel Marketplace에서 Turso를 프로젝트에 연결하고 Production/Preview 환경 변수에 DB URL과 토큰을 설정합니다.
4. Turso에서 새 빈 데이터베이스를 만들고 `cheolcity-restore.sql`을 로컬에서 `bun run restore:turso -- /절대경로/cheolcity-restore.sql`로 적용합니다. (실행 시 `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` 필요)
5. Vercel Preview URL에서 관리자 로그인, 회원 로그인, 선수/모임/출석/경기 기록, 전체 백업을 검증합니다.
6. 검증 완료 전에는 기존 Higgsfield 사이트를 계속 운영하고, 두 DB에 동시 쓰기를 하지 않습니다.

## 5. 독립 Cloudflare 배포의 기본 순서

1. Cloudflare 계정과 Workers 배포 권한을 준비합니다.
2. 새 D1 데이터베이스를 만듭니다.
3. `app/migrations/0001_init.sql`, `0002_signup_requests.sql`을 순서대로 적용합니다.
4. 백업 데이터 SQL을 새 D1에 적용합니다(데이터 백업 문서 참조).
5. Worker 설정에서 D1을 `DB` 이름으로 바인딩합니다.
6. Bun 의존성을 설치하고 `bun run build`로 빌드합니다.
7. TanStack Start/Cloudflare Worker 배포 어댑터와 호스팅 구성을 해당 계정에 맞게 연결한 뒤 배포합니다.
8. 관리자 로그인, 회원 로그인, 출석, 경기 기록, 백업 다운로드를 점검합니다.

> 주의: 현재 플랫폼에서 제공하는 `@higgsfield/*` workspace 패키지와 배포 자동화는 이 저장소에 일부 소스가 포함되어 있어도, Higgsfield 전용 런타임 서비스/배포 기능까지 외부로 이전되는 것은 아닙니다. 외부 계정에 독립 배포하려면 이 의존 경로를 교체하거나 호환 계층을 구현하고 실제 배포 테스트를 해야 합니다. 이 문서는 이전을 위한 소스·데이터 보관 안내이지, 원클릭 외부 배포가 검증됐다는 뜻은 아닙니다.

## 4. GitHub Actions

포함된 워크플로는 공개 GitHub의 `ubuntu-latest`에서 타입 검사와 빌드를 검증합니다. 이는 코드 검증용이며 Cloudflare 배포는 하지 않습니다. 실제 배포를 자동화하려면 Cloudflare API 토큰과 계정/DB 식별자를 GitHub Actions Secrets에 등록하고 별도 배포 단계를 구성해야 합니다.
