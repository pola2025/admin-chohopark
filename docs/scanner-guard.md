# admin.chorigol.net 스캐너 차단 (2026-11-19)

홈페이지 chorigol.net 에 2026-11-12 넣은 장치(세움랩 · 위드오너 · 폴라애드와 같은 방식)를 관리자 사이트에도 붙였다. 차단 판단과 기록은 홈페이지와 같은 곳(choho-forms Worker, `api.chorigol.net`)이 맡는다. 관리자 사이트에는 별도 Worker 가 없다.

## 흐름

1. `src/middleware.ts` 가 미끼 경로(`/.env`, `/.git/config`, `wp-*`, `.php`, `config.json`, `*.yml` 등)에 요청마다 서명한 가짜 설정 파일(200) 또는 404 를 준다. 판별은 `src/lib/guard.ts`(chohopark 저장소 `src/lib/guard.ts` 복사본).
2. 접속 IP 를 `https://api.chorigol.net/guard-report` 로 서명해 신고한다(사이트 표기 `chorigol-admin`).
3. choho-forms Worker 가 D1 `choho-blog` 의 `guard_blocks` 에 기록하고, Vercel 방화벽 규칙 「chorigol-guard trap blocklist」(challenge)를 홈페이지 · 관리자 두 프로젝트에 올린다. api.chorigol.net 은 Cloudflare 존 IP 접근 규칙으로 막는다. 1회 7일 → 2회 30일 → 3회부터 영구. 대역 차단은 꺼져 있다.
4. 알림은 인프라봇 채널 `[chorigol/guard]`.

검색엔진 · AI 검색 · 링크 미리보기 UA 는 미끼 경로에서 404 만 받고 신고되지 않는다. 대시보드 · 로그인 · `/api` 요청은 미끼 판별에 걸리지 않는다(실제 경로 64개 대조, 오탐 0). 사무실 IP 182.214.41.78 은 Worker 허용 목록이라 차단되지 않는다.

## 같이 바뀐 것

- Vercel 환경변수 `GUARD_SECRET`(production, sensitive): 홈페이지 프로젝트 · Worker 와 같은 값. 없으면 미끼 경로는 404 만 준다.
- Worker 시크릿 `VERCEL_GUARD_PROJECTS` 에 이 프로젝트(`prj_7tEvpd681lKWZh1Izq84RsI4dUwR`)를 더했다. 재설정 스크립트 `F:\chohopark\.workspace\deploy-guard.sh` 도 같이 고쳤다.
- Vercel 방화벽 「chorigol-guard rate limit」: IP당 60초 300회 초과 시 429, `/_next/` 는 세지 않는다(홈페이지와 같은 값).

## 운영

- 차단 목록 · 해제 · 직접 차단: `GET/DELETE/POST https://api.chorigol.net/admin/guard/blocks?ip=<주소>`(Worker 관리 토큰). 정상 사용자가 막혔으면 해제하고 Worker 시크릿 `GUARD_ALLOW_IPS`(쉼표)에 넣는다.
- 되돌리기: Vercel 방화벽에서 두 규칙을 끄고, 미끼까지 끄려면 이 프로젝트의 `GUARD_SECRET` 을 지운 뒤 재배포한다.
- 운영에서 스캐너 경로를 한 주소로 3건 넘게 보내면 Vercel 시스템 방어가 그 주소를 검사 화면에 묶는다. 확인은 호스트당 2건만 한다.
