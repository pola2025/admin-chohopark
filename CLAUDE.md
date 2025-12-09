# 초호쉼터 관리자 대시보드

## 프로젝트 정보

- **관리자 대시보드**: admin-chohopark (이 프로젝트)
- **홈페이지 주소**: https://chorigol.net (chohopark.com 아님!)
- **Supabase 프로젝트**: qhwrwjutyameadpcfggx

## 중요 사항

### 홈페이지 도메인
**절대 잊지 말 것**: 홈페이지는 `chorigol.net` 입니다.
- ❌ chohopark.com (틀림)
- ✅ chorigol.net (정확)

## 데이터 흐름

### 현재 구조 ✅ (정상 연동됨)
```
홈페이지 폼 제출 → /api/inquiry
  ├─→ GAS → 스프레드시트 저장
  ├─→ Supabase inquiries 테이블 저장
  └─→ 텔레그램 알림
```

홈페이지(chorigol.net)에서 문의 접수 시:
1. **GAS** → Google 스프레드시트 저장 (기존 유지)
2. **Supabase** → `inquiries` 테이블 INSERT (관리자 대시보드 연동)
3. **텔레그램** → 새 문의 알림 전송

## 주요 테이블

- `inquiries`: 홈페이지에서 접수된 견적 문의
- `reservations`: 확정된 예약
- `sms_schedules`: SMS 발송 스케줄
- `templates`: SMS 템플릿

## 상품 타입

- `overnight`: 1박2일 워크샵 (99,000원/인)
- `daytrip`: 당일 수련회/야유회 (66,000원/인)
- `training`: 2박3일 수련회 (165,000원/인)
