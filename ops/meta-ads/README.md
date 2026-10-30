# 초호쉼터 Meta 광고 데이터

관리자 `/dashboard/meta-ads`에서 기존 관리자 로그인을 통해 저장된 광고 집계를 조회합니다. 광고 집행 설정을 변경하는 기능은 없습니다.

## 수집과 보관

- 계정 `639564975420619`, USD, Asia/Seoul로 고정합니다. 수집 대상은 계정 전체 캠페인입니다(`act_<id>/campaigns`, 최대 100개). 새로 켠 캠페인도 다음 정시 수집부터 들어옵니다. `config.json`에 `campaignIds`를 다시 넣으면 그 캠페인만(최대 10개) 수집합니다.
- 기존 맥미니 Meta 시스템 사용자 토큰을 읽고 기존 관리자 D1 프록시에 저장합니다. 토큰을 브라우저나 저장 원장에 넣지 않습니다.
- 매시간 최근 8일을 조회하고 일별 집계를 교체합니다. 같은 날짜를 재수집해도 누계가 증가하지 않습니다.
- Meta 웹사이트 문의 전환은 `offsite_conversion.fb_pixel_lead`의 `7d_click`만 사용합니다. `lead`, `omni_lead`, 조회 기여를 더하지 않습니다. 노출일 기준입니다.
- 사용액은 USD 백만분의 1 단위 정수로 보관합니다. CPC·CPL·CTR은 기간 합계에서 계산합니다. 일별 도달은 기간 또는 캠페인 간에 합산하지 않습니다.
- 캠페인 일별 집계와 함께 두 표를 같은 기간으로 교체합니다.
  - `meta_ads_breakdown_daily`: 캠페인·날짜별 분류 집계입니다. `dimension`은 `placement`(`instagram:instagram_reels`처럼 플랫폼:위치), `age`, `gender`(`male|female|unknown`), `region`, `device`(`device_platform`), `hour`(광고 계정 시간대 기준 두 자리 시, 예: `22`)입니다. `hour`는 Meta가 전환과 함께 주지 않아 문의 전환을 0으로 저장합니다.
  - `meta_ads_ad_daily`: 광고별 일별 집계입니다. 광고 이름, 사용액, 노출, 링크 클릭, 문의 전환, ThruPlay와 동영상 25/50/75/100% 시청 수를 저장합니다.
- D1은 캠페인 메타정보, 일별·분류별·광고별 집계, 최근 동기화 상태와 변경 버전만 보관합니다. 개인 고객 정보는 수집하지 않습니다. 집계 이력은 프로젝트 운영 기간 동안 보관하며 이 기능에는 자동 삭제가 없습니다. 대용량 첨부나 내보내기를 만들지 않아 R2를 추가하지 않습니다.
- 실패하면 마지막 정상 데이터를 보존하고 수집 오류/지연을 표시합니다. 광고 활성화 직후 집계가 없을 때는 데이터 대기로 표시합니다.

## 저장·조회 경계

수집은 계정별 D1 lease를 확보합니다. Meta 요청은 최대 40회, 각 20초, 최대 100개 캠페인/1,000개 캠페인 집계 행/2MiB 응답입니다. 분류 6종과 광고별 조회는 각각 한 번에 500행씩 받고 조회당 5,000행(`maxBreakdownRows`)을 넘으면 중단합니다. 분류 조회가 실패하면 `META_HTTP_100_REGION`처럼 오류 코드 끝에 분류 이름(광고별은 `_AD`)을 붙입니다. 원격 pagination cursor 반복이나 상한 초과는 부분 성공으로 저장하지 않습니다. 메타정보·기간 데이터 교체(세 표)·완료 상태는 같은 D1 batch(8문장, 최대 20문장·2MiB)에서 원자적으로 처리합니다. 상한을 넘으면 `COMMIT_BODY_LIMIT`으로 멈추고 아무것도 쓰지 않습니다. 각 쓰기는 lease owner를 확인합니다. commit 응답이 불명확하면 run ID를 조회해 재대조합니다.

조회는 JWT HS256 서명·만료·admin 역할을 먼저 검증합니다. 고정 계정에 한해 7/30/90일, 한 페이지 31행으로 제한하며 date+campaign ID keyset cursor를 HMAC과 버전으로 보호합니다. 응답은 최대 256KiB입니다. 서버 캐시는 계정/권한/기간/캠페인/버전/cursor별 60초, LRU 32개이며 동시 집계를 최대 4개로 제한합니다. 인증된 조회는 isolate당 분당 120회로 제한합니다. 다중 isolate에서는 각 한도가 별도로 적용되며, 공유 캐시로 고객 개인정보를 저장하지 않습니다. 성공한 수집이 D1 버전을 바꾸므로 새 요청은 이전 집계 캐시를 사용하지 않습니다.

## 명령

기존 로컬 Node/Python만 사용합니다. 패키지 설치는 필요하지 않습니다.

```text
node --test ops/meta-ads/*.test.mjs
node --env-file=<관리자 프로젝트 환경 파일> ops/meta-ads/migrate.mjs --apply
node ops/meta-ads/collect.mjs --dry-run
node ops/meta-ads/collect.mjs --once
node ops/meta-ads/collect.mjs --backfill
```

`--dry-run`과 `--once`는 최근 8일을 조회합니다. `--backfill`은 `availableSince`부터 오늘까지 한 번 수집해 저장합니다. 기간이 62일을 넘으면 Meta나 D1을 호출하지 않고 `BACKFILL_WINDOW_LIMIT`으로 멈춥니다. 결과 JSON에는 `rows`(캠페인 일별), `breakdownRows`, `breakdownRowsByDimension`, `adRows`가 들어갑니다.

collector는 기존 macmini/polamini 실행 소유자에서만 동작합니다. 새 스케줄은 기존 GJC wrapper를 통해 실행하며 다른 발행기나 알림은 수정하지 않습니다.

공식 필드·매개변수 근거: [Meta Ads Insights SDK](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adsinsights.py), [Meta Insights request parameters](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/ad.py).
