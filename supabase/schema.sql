-- =============================================
-- 초호쉼터 관리자 대시보드 테이블 스키마
-- Supabase SQL Editor에서 실행
-- =============================================

-- 1. 예약 테이블
CREATE TABLE reservations (
  id SERIAL PRIMARY KEY,
  use_date DATE NOT NULL,
  product_type VARCHAR(20) NOT NULL,
  people_count INTEGER NOT NULL,
  company_name VARCHAR(100),
  manager_name VARCHAR(50) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(100),
  deposit_amount INTEGER NOT NULL,
  payment_status VARCHAR(20) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SMS 발송 스케줄 테이블
CREATE TABLE sms_schedules (
  id SERIAL PRIMARY KEY,
  reservation_id INTEGER REFERENCES reservations(id) ON DELETE CASCADE,
  schedule_type VARCHAR(20) NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 메시지 템플릿 테이블
CREATE TABLE message_templates (
  id SERIAL PRIMARY KEY,
  product_type VARCHAR(20) NOT NULL,
  schedule_type VARCHAR(20) NOT NULL,
  message_content TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_type, schedule_type)
);

-- 4. SMS 발송 로그 테이블
CREATE TABLE sms_logs (
  id SERIAL PRIMARY KEY,
  reservation_id INTEGER REFERENCES reservations(id) ON DELETE SET NULL,
  phone VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) NOT NULL,
  response_data JSONB,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 견적문의 테이블 (웹사이트 연동용)
CREATE TABLE inquiries (
  id SERIAL PRIMARY KEY,
  product_name VARCHAR(50) NOT NULL,
  people_count INTEGER NOT NULL,
  customer_name VARCHAR(50) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  customer_email VARCHAR(100),
  customer_company VARCHAR(100),
  customer_memo TEXT,
  total_amount VARCHAR(50),
  deposit_amount VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_reservations_use_date ON reservations(use_date);
CREATE INDEX idx_reservations_payment_status ON reservations(payment_status);
CREATE INDEX idx_sms_schedules_scheduled_at ON sms_schedules(scheduled_at);
CREATE INDEX idx_sms_schedules_status ON sms_schedules(status);

-- 기본 메시지 템플릿 삽입
INSERT INTO message_templates (product_type, schedule_type, message_content) VALUES
-- 1박2일 워크샵
('overnight', 'd_minus_1', '[초호쉼터] {company_name} {manager_name}님, 내일 워크샵이 예정되어 있습니다. 입실시간: 오후 3시. 문의: 031-123-4567'),
('overnight', 'd_day_morning', '[초호쉼터] {company_name} {manager_name}님, 오늘 워크샵 당일입니다! 입실시간: 오후 3시. 안전 운행하세요!'),
('overnight', 'before_meal', '[초호쉼터] {company_name}님, 저녁식사가 18:30부터 시작됩니다. 바베큐장으로 모여주세요!'),
('overnight', 'before_close', '[초호쉼터] {company_name}님, 퇴실시간은 오전 11시입니다. 이용해 주셔서 감사합니다!'),
-- 당일 야유회
('daytrip', 'd_minus_1', '[초호쉼터] {company_name} {manager_name}님, 내일 야유회가 예정되어 있습니다. 시작시간: 오전 10시. 문의: 031-123-4567'),
('daytrip', 'd_day_morning', '[초호쉼터] {company_name} {manager_name}님, 오늘 야유회 당일입니다! 시작시간: 오전 10시. 안전 운행하세요!'),
('daytrip', 'before_meal', '[초호쉼터] {company_name}님, 점심 BBQ가 12:30부터 시작됩니다. 바베큐장으로 모여주세요!'),
('daytrip', 'before_close', '[초호쉼터] {company_name}님, 이용 종료시간 17:00 1시간 전입니다. 정리 부탁드립니다!'),
-- 2박3일 수련회
('training', 'd_minus_1', '[초호쉼터] {company_name} {manager_name}님, 내일 수련회가 예정되어 있습니다. 입실시간: 오후 3시. 문의: 031-123-4567'),
('training', 'd_day_morning', '[초호쉼터] {company_name} {manager_name}님, 오늘 수련회 첫날입니다! 입실시간: 오후 3시. 안전 운행하세요!'),
('training', 'before_meal', '[초호쉼터] {company_name}님, 저녁식사가 18:30부터 시작됩니다. 바베큐장으로 모여주세요!'),
('training', 'before_close', '[초호쉼터] {company_name}님, 마지막날 퇴실시간은 오전 11시입니다. 감사합니다!');

-- RLS (Row Level Security) 정책 설정
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

-- Service Role에서만 접근 가능하도록 정책 생성
CREATE POLICY "Service role access" ON reservations FOR ALL USING (true);
CREATE POLICY "Service role access" ON sms_schedules FOR ALL USING (true);
CREATE POLICY "Service role access" ON message_templates FOR ALL USING (true);
CREATE POLICY "Service role access" ON sms_logs FOR ALL USING (true);
CREATE POLICY "Service role access" ON inquiries FOR ALL USING (true);
