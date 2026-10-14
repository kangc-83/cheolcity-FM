# 운영 데이터 백업 및 복원

## 현재 운영 데이터 백업

현재 Higgsfield의 운영 D1 데이터베이스를 읽어 생성한 `cheolcity-full-database-backup.json` 및 `cheolcity-restore.sql`을 별도 비공개 데이터 백업 ZIP으로 보관합니다. 소스 ZIP과 데이터 ZIP은 분리합니다.

백업에는 다음 테이블이 포함됩니다.

- `players`, `users`, `seasons`, `gatherings`, `attendance`
- `matches`, `team_assignments`, `match_players`
- `signup_requests`, `app_config` (초기 등록 코드 해시는 제외)

현재 백업 스냅샷의 레코드 수는 선수 54명, 사용자 8명, 시즌 1개, 모임 2개, 출석 31건, 경기 1건, 팀 배정 17건, 경기별 선수 기록 19건입니다. 가입 신청은 0건입니다.

## Vercel/Turso로 복원

1. Turso에서 새 빈 데이터베이스를 만듭니다.
2. Turso의 URL과 인증 토큰을 `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` 환경 변수로 준비합니다.
3. 프로젝트 `app/` 폴더에서 다음 명령을 실행합니다.

```bash
TURSO_DATABASE_URL='libsql://...' \
TURSO_AUTH_TOKEN='...' \
bun run restore:turso -- /절대경로/cheolcity-restore.sql
```

복원 스크립트는 스키마와 레코드를 적용한 뒤 각 테이블의 건수를 출력합니다. **새 빈 DB에만 실행하세요.** 기존 데이터베이스에 적용하면 중복 키나 데이터 충돌이 발생할 수 있습니다.

## 보안 및 제외 항목

- `users.password_hash` 및 가입 신청의 비밀번호 해시는 계정 유지 목적으로 백업에 포함됩니다. 비밀번호 원문은 포함되지 않지만 해시도 민감정보입니다.
- `sessions` 테이블은 보안상 제외됩니다. 이전 후 모든 사용자가 다시 로그인해야 합니다.
- `app_config.setup_code_hash`는 보안상 제외하고, 복원 SQL에서는 초기 등록 코드가 이미 사용된 것으로 표시합니다.
- 전화번호 등 개인정보가 포함될 수 있으므로 데이터 ZIP/JSON/SQL은 공개 GitHub에 올리지 마세요.
- 소스코드와 운영 데이터는 반드시 별도 파일로 보관하세요.
