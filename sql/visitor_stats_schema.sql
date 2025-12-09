-- =============================================
-- 초호쉼터 방문자 통계 테이블 스키마
-- 생성일: 2024-12-09
-- =============================================

-- 1. 일별 방문자 통계 테이블
-- GA4에서 가져온 데이터를 일별로 저장
CREATE TABLE IF NOT EXISTS daily_visitors (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,

    -- 핵심 지표
    total_users INTEGER DEFAULT 0,
    new_users INTEGER DEFAULT 0,
    sessions INTEGER DEFAULT 0,
    page_views INTEGER DEFAULT 0,

    -- 추가 지표
    avg_session_duration DECIMAL(10, 2) DEFAULT 0,
    bounce_rate DECIMAL(5, 2) DEFAULT 0,

    -- 메타데이터
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스: 날짜 기준 빠른 조회
CREATE INDEX IF NOT EXISTS idx_daily_visitors_date ON daily_visitors(date DESC);

-- 2. 주간 방문자 요약 테이블
CREATE TABLE IF NOT EXISTS weekly_visitors (
    id BIGSERIAL PRIMARY KEY,
    week_start DATE NOT NULL,  -- 해당 주의 월요일
    week_end DATE NOT NULL,    -- 해당 주의 일요일
    year INTEGER NOT NULL,
    week_number INTEGER NOT NULL,

    -- 주간 합계
    total_users INTEGER DEFAULT 0,
    new_users INTEGER DEFAULT 0,
    sessions INTEGER DEFAULT 0,
    page_views INTEGER DEFAULT 0,

    -- 주간 평균
    avg_daily_users DECIMAL(10, 2) DEFAULT 0,
    avg_session_duration DECIMAL(10, 2) DEFAULT 0,
    avg_bounce_rate DECIMAL(5, 2) DEFAULT 0,

    -- 메타데이터
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- 유니크 제약: 연도 + 주차
    UNIQUE(year, week_number)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_weekly_visitors_date ON weekly_visitors(week_start DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_visitors_year_week ON weekly_visitors(year, week_number);

-- 3. 월간 방문자 요약 테이블
CREATE TABLE IF NOT EXISTS monthly_visitors (
    id BIGSERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,

    -- 월간 합계
    total_users INTEGER DEFAULT 0,
    new_users INTEGER DEFAULT 0,
    sessions INTEGER DEFAULT 0,
    page_views INTEGER DEFAULT 0,

    -- 월간 평균
    avg_daily_users DECIMAL(10, 2) DEFAULT 0,
    avg_session_duration DECIMAL(10, 2) DEFAULT 0,
    avg_bounce_rate DECIMAL(5, 2) DEFAULT 0,

    -- 주차별 데이터 (JSON으로 저장)
    weekly_breakdown JSONB,

    -- 메타데이터
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- 유니크 제약: 연도 + 월
    UNIQUE(year, month)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_monthly_visitors_year_month ON monthly_visitors(year DESC, month DESC);

-- 4. 인기 페이지 일별 기록
CREATE TABLE IF NOT EXISTS daily_page_views (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    page_path VARCHAR(500) NOT NULL,
    page_title VARCHAR(500),
    views INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- 유니크 제약: 날짜 + 페이지 경로
    UNIQUE(date, page_path)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_daily_page_views_date ON daily_page_views(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_page_views_views ON daily_page_views(views DESC);

-- 5. 트래픽 소스 일별 기록
CREATE TABLE IF NOT EXISTS daily_traffic_sources (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    source VARCHAR(255) NOT NULL,
    users INTEGER DEFAULT 0,
    sessions INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- 유니크 제약: 날짜 + 소스
    UNIQUE(date, source)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_daily_traffic_sources_date ON daily_traffic_sources(date DESC);

-- =============================================
-- 자동 업데이트 트리거 (updated_at)
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 적용
DROP TRIGGER IF EXISTS update_daily_visitors_updated_at ON daily_visitors;
CREATE TRIGGER update_daily_visitors_updated_at
    BEFORE UPDATE ON daily_visitors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_weekly_visitors_updated_at ON weekly_visitors;
CREATE TRIGGER update_weekly_visitors_updated_at
    BEFORE UPDATE ON weekly_visitors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_monthly_visitors_updated_at ON monthly_visitors;
CREATE TRIGGER update_monthly_visitors_updated_at
    BEFORE UPDATE ON monthly_visitors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 주간 집계 함수
-- =============================================

CREATE OR REPLACE FUNCTION aggregate_weekly_visitors(p_week_start DATE)
RETURNS void AS $$
DECLARE
    v_week_end DATE;
    v_year INTEGER;
    v_week_number INTEGER;
    v_total_users INTEGER;
    v_new_users INTEGER;
    v_sessions INTEGER;
    v_page_views INTEGER;
    v_avg_daily_users DECIMAL(10,2);
    v_avg_session_duration DECIMAL(10,2);
    v_avg_bounce_rate DECIMAL(5,2);
    v_day_count INTEGER;
BEGIN
    -- 주 종료일 계산 (일요일)
    v_week_end := p_week_start + INTERVAL '6 days';
    v_year := EXTRACT(YEAR FROM p_week_start);
    v_week_number := EXTRACT(WEEK FROM p_week_start);

    -- 일별 데이터 집계
    SELECT
        COALESCE(SUM(total_users), 0),
        COALESCE(SUM(new_users), 0),
        COALESCE(SUM(sessions), 0),
        COALESCE(SUM(page_views), 0),
        COALESCE(AVG(avg_session_duration), 0),
        COALESCE(AVG(bounce_rate), 0),
        COUNT(*)
    INTO
        v_total_users, v_new_users, v_sessions, v_page_views,
        v_avg_session_duration, v_avg_bounce_rate, v_day_count
    FROM daily_visitors
    WHERE date >= p_week_start AND date <= v_week_end;

    -- 일 평균 사용자 계산
    v_avg_daily_users := CASE WHEN v_day_count > 0
        THEN v_total_users::DECIMAL / v_day_count
        ELSE 0 END;

    -- UPSERT
    INSERT INTO weekly_visitors (
        week_start, week_end, year, week_number,
        total_users, new_users, sessions, page_views,
        avg_daily_users, avg_session_duration, avg_bounce_rate
    ) VALUES (
        p_week_start, v_week_end, v_year, v_week_number,
        v_total_users, v_new_users, v_sessions, v_page_views,
        v_avg_daily_users, v_avg_session_duration, v_avg_bounce_rate
    )
    ON CONFLICT (year, week_number)
    DO UPDATE SET
        total_users = EXCLUDED.total_users,
        new_users = EXCLUDED.new_users,
        sessions = EXCLUDED.sessions,
        page_views = EXCLUDED.page_views,
        avg_daily_users = EXCLUDED.avg_daily_users,
        avg_session_duration = EXCLUDED.avg_session_duration,
        avg_bounce_rate = EXCLUDED.avg_bounce_rate,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 월간 집계 함수
-- =============================================

CREATE OR REPLACE FUNCTION aggregate_monthly_visitors(p_year INTEGER, p_month INTEGER)
RETURNS void AS $$
DECLARE
    v_month_start DATE;
    v_month_end DATE;
    v_total_users INTEGER;
    v_new_users INTEGER;
    v_sessions INTEGER;
    v_page_views INTEGER;
    v_avg_daily_users DECIMAL(10,2);
    v_avg_session_duration DECIMAL(10,2);
    v_avg_bounce_rate DECIMAL(5,2);
    v_day_count INTEGER;
    v_weekly_breakdown JSONB;
BEGIN
    -- 월 시작/종료일 계산
    v_month_start := make_date(p_year, p_month, 1);
    v_month_end := (v_month_start + INTERVAL '1 month - 1 day')::DATE;

    -- 일별 데이터 집계
    SELECT
        COALESCE(SUM(total_users), 0),
        COALESCE(SUM(new_users), 0),
        COALESCE(SUM(sessions), 0),
        COALESCE(SUM(page_views), 0),
        COALESCE(AVG(avg_session_duration), 0),
        COALESCE(AVG(bounce_rate), 0),
        COUNT(*)
    INTO
        v_total_users, v_new_users, v_sessions, v_page_views,
        v_avg_session_duration, v_avg_bounce_rate, v_day_count
    FROM daily_visitors
    WHERE date >= v_month_start AND date <= v_month_end;

    -- 일 평균 사용자 계산
    v_avg_daily_users := CASE WHEN v_day_count > 0
        THEN v_total_users::DECIMAL / v_day_count
        ELSE 0 END;

    -- 주차별 breakdown 생성
    SELECT jsonb_agg(jsonb_build_object(
        'week_number', week_number,
        'week_start', week_start,
        'week_end', week_end,
        'total_users', total_users,
        'sessions', sessions,
        'page_views', page_views
    ) ORDER BY week_start)
    INTO v_weekly_breakdown
    FROM weekly_visitors
    WHERE (week_start >= v_month_start AND week_start <= v_month_end)
       OR (week_end >= v_month_start AND week_end <= v_month_end);

    -- UPSERT
    INSERT INTO monthly_visitors (
        year, month,
        total_users, new_users, sessions, page_views,
        avg_daily_users, avg_session_duration, avg_bounce_rate,
        weekly_breakdown
    ) VALUES (
        p_year, p_month,
        v_total_users, v_new_users, v_sessions, v_page_views,
        v_avg_daily_users, v_avg_session_duration, v_avg_bounce_rate,
        v_weekly_breakdown
    )
    ON CONFLICT (year, month)
    DO UPDATE SET
        total_users = EXCLUDED.total_users,
        new_users = EXCLUDED.new_users,
        sessions = EXCLUDED.sessions,
        page_views = EXCLUDED.page_views,
        avg_daily_users = EXCLUDED.avg_daily_users,
        avg_session_duration = EXCLUDED.avg_session_duration,
        avg_bounce_rate = EXCLUDED.avg_bounce_rate,
        weekly_breakdown = EXCLUDED.weekly_breakdown,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 누적 통계 VIEW (빠른 조회용)
-- =============================================

CREATE OR REPLACE VIEW v_cumulative_stats AS
SELECT
    'daily' as period_type,
    date::TEXT as period,
    total_users,
    new_users,
    sessions,
    page_views,
    avg_session_duration,
    bounce_rate,
    -- 누적 합계 (해당 날짜까지)
    SUM(total_users) OVER (ORDER BY date) as cumulative_users,
    SUM(sessions) OVER (ORDER BY date) as cumulative_sessions,
    SUM(page_views) OVER (ORDER BY date) as cumulative_page_views
FROM daily_visitors
ORDER BY date DESC;

-- =============================================
-- RLS (Row Level Security) 정책
-- =============================================

-- RLS 비활성화 (관리자 전용 테이블이므로)
ALTER TABLE daily_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_traffic_sources ENABLE ROW LEVEL SECURITY;

-- Service Role은 모든 작업 허용
CREATE POLICY "Service role full access on daily_visitors" ON daily_visitors
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on weekly_visitors" ON weekly_visitors
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on monthly_visitors" ON monthly_visitors
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on daily_page_views" ON daily_page_views
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on daily_traffic_sources" ON daily_traffic_sources
    FOR ALL USING (true) WITH CHECK (true);
