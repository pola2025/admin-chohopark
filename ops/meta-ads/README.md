# 초호쉼터 Meta 광고 데이터

관리자 `/dashboard/meta-ads`에서 기존 관리자 로그인을 통해 저장된 광고 집계를 조회합니다. 광고 집행 설정을 변경하는 기능은 없습니다.

## 수집과 보관

- 계정 `639564975420619`, USD, Asia/Seoul로 고정합니다. 최초 대상은 `120250878150770043` 단체예약 프로모션입니다.
- 기존 맥미니 Meta 시스템 사용자 토큰을 읽고 기존 관리자 D1 프록시에 저장합니다. 토큰을 브라우저나 저장 원장에 넣지 않습니다.
- 매시간 최근 8일을 조회하고 일별 집계를 교체합니다. 같은 날짜를 재수집해도 누계가 증가하지 않습니다.
- Meta 웹사이트 문의 전환은 `offsite_conversion.fb_pixel_lead`의 `7d_click`만 사용합니다. `lead`, `omni_lead`, 조회 기여를 더하지 않습니다. 노출일 기준입니다.
- 사용액은 USD 백만분의 1 단위 정수로 보관합니다. CPC·CPL·CTR은 기간 합계에서 계산합니다. 일별 도달은 기간 또는 캠페인 간에 합산하지 않습니다.
- D1은 캠페인 메타정보, 일별 집계, 최근 동기화 상태와 변경 버전만 보관합니다. 개인 고객 정보는 수집하지 않습니다. 집계 이력은 프로젝트 운영 기간 동안 보관하며 이 기능에는 자동 삭제가 없습니다. 대용량 첨부나 내보내기를 만들지 않아 R2를 추가하지 않습니다.
- 실패하면 마지막 정상 데이터를 보존하고 수집 오류/지연을 표시합니다. 광고 활성화 직후 집계가 없을 때는 데이터 대기로 표시합니다.

## 저장·조회 경계

수집은 계정별 D1 lease를 확보합니다. Meta 요청은 최대 16회, 각 20초, 최대 100개 캠페인/1,000개 집계 행/2MiB 응답입니다. 원격 pagination cursor 반복이나 상한 초과는 부분 성공으로 저장하지 않습니다. 메타정보·기간 데이터 교체·완료 상태는 같은 D1 batch에서 원자적으로 처리합니다. 각 쓰기는 lease owner를 확인합니다. commit 응답이 불명확하면 run ID를 조회해 재대조합니다.

조회는 JWT HS256 서명·만료·admin 역할을 먼저 검증합니다. 고정 계정에 한해 7/30/90일, 한 페이지 31행으로 제한하며 date+campaign ID keyset cursor를 HMAC과 버전으로 보호합니다. 응답은 최대 256KiB입니다. 서버 캐시는 계정/권한/기간/캠페인/버전/cursor별 60초, LRU 32개이며 동시 집계를 최대 4개로 제한합니다. 인증된 조회는 isolate당 분당 120회로 제한합니다. 다중 isolate에서는 각 한도가 별도로 적용되며, 공유 캐시로 고객 개인정보를 저장하지 않습니다. 성공한 수집이 D1 버전을 바꾸므로 새 요청은 이전 집계 캐시를 사용하지 않습니다.

## 명령

기존 로컬 Node/Python만 사용합니다. 패키지 설치는 필요하지 않습니다.

```text
node --test ops/meta-ads/*.test.mjs
node --env-file=<관리자 프로젝트 환경 파일> ops/meta-ads/migrate.mjs --apply
node ops/meta-ads/collect.mjs --dry-run
node ops/meta-ads/collect.mjs --once
```

collector는 기존 macmini/polamini 실행 소유자에서만 동작합니다. 새 스케줄은 기존 GJC wrapper를 통해 실행하며 다른 발행기나 알림은 수정하지 않습니다.

공식 필드·매개변수 근거: [Meta Ads Insights SDK](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adsinsights.py), [Meta Insights request parameters](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/ad.py).
