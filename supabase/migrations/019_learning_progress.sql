-- ─────────────────────────────────────────────────────────
-- 019_learning_progress.sql
-- 학습 진행 추적 시스템
-- ─────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────
-- 1. 콘텐츠별 학습 진행 테이블
-- ─────────────────────────────────────────────────────────
CREATE TABLE learning_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content_id UUID REFERENCES generated_contents(id) ON DELETE CASCADE NOT NULL,

  -- 진행 상태
  status VARCHAR(20) NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'completed', 'revisiting')),
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),

  -- 시간 추적
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  time_spent_seconds INTEGER DEFAULT 0 CHECK (time_spent_seconds >= 0),

  -- 학습 세션 카운트
  session_count INTEGER DEFAULT 0,

  -- 퀴즈/연습문제 진행
  quiz_score INTEGER CHECK (quiz_score >= 0 AND quiz_score <= 100),
  quiz_attempts INTEGER DEFAULT 0,
  exercises_completed INTEGER DEFAULT 0,
  exercises_total INTEGER DEFAULT 0,

  -- 사용자 메모
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 사용자별 콘텐츠별 하나의 진행 기록만
CREATE UNIQUE INDEX idx_learning_progress_unique
  ON learning_progress(user_id, content_id);

-- 인덱스
CREATE INDEX idx_learning_progress_user_id ON learning_progress(user_id);
CREATE INDEX idx_learning_progress_content_id ON learning_progress(content_id);
CREATE INDEX idx_learning_progress_status ON learning_progress(user_id, status);
CREATE INDEX idx_learning_progress_last_accessed ON learning_progress(user_id, last_accessed_at DESC);
CREATE INDEX idx_learning_progress_completed ON learning_progress(user_id, completed_at DESC)
  WHERE completed_at IS NOT NULL;

-- ─────────────────────────────────────────────────────────
-- 2. 연속 학습 기록 테이블 (스트릭)
-- ─────────────────────────────────────────────────────────
CREATE TABLE learning_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,

  -- 현재 스트릭
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,

  -- 날짜 추적
  streak_start_date DATE,
  last_activity_date DATE,

  -- 주간/월간 목표
  weekly_goal_days INTEGER DEFAULT 5 CHECK (weekly_goal_days >= 1 AND weekly_goal_days <= 7),
  weekly_completed_days INTEGER DEFAULT 0,

  -- 통계
  total_learning_days INTEGER DEFAULT 0,
  total_contents_completed INTEGER DEFAULT 0,
  total_time_spent_seconds BIGINT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_learning_streaks_current ON learning_streaks(current_streak DESC);
CREATE INDEX idx_learning_streaks_longest ON learning_streaks(longest_streak DESC);

-- ─────────────────────────────────────────────────────────
-- 3. 일일 학습 로그 테이블
-- ─────────────────────────────────────────────────────────
CREATE TABLE daily_learning_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- 일일 통계
  contents_started INTEGER DEFAULT 0,
  contents_completed INTEGER DEFAULT 0,
  time_spent_seconds INTEGER DEFAULT 0,
  sessions_count INTEGER DEFAULT 0,

  -- 학습한 콘텐츠 ID 목록
  content_ids UUID[] DEFAULT '{}',

  -- 언어별 학습 시간 (JSONB)
  time_by_language JSONB DEFAULT '{}',

  -- 목표 달성 여부
  daily_goal_met BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 사용자별 날짜별 하나의 로그만
CREATE UNIQUE INDEX idx_daily_learning_logs_unique
  ON daily_learning_logs(user_id, log_date);

-- 인덱스
CREATE INDEX idx_daily_learning_logs_user_date ON daily_learning_logs(user_id, log_date DESC);
CREATE INDEX idx_daily_learning_logs_date ON daily_learning_logs(log_date DESC);

-- ─────────────────────────────────────────────────────────
-- 4. 업적/배지 테이블
-- ─────────────────────────────────────────────────────────
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

  -- 업적 정보
  achievement_type VARCHAR(50) NOT NULL,
  achievement_level INTEGER DEFAULT 1, -- 동일 업적의 레벨 (예: 브론즈, 실버, 골드)

  -- 달성 정보
  achieved_at TIMESTAMPTZ DEFAULT NOW(),
  achievement_value INTEGER, -- 달성 시점의 값 (예: 연속 7일)

  -- 메타데이터
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 사용자별 업적 유형별 레벨별 하나만
CREATE UNIQUE INDEX idx_achievements_unique
  ON achievements(user_id, achievement_type, achievement_level);

-- 인덱스
CREATE INDEX idx_achievements_user_id ON achievements(user_id);
CREATE INDEX idx_achievements_type ON achievements(achievement_type);
CREATE INDEX idx_achievements_achieved_at ON achievements(achieved_at DESC);

-- ─────────────────────────────────────────────────────────
-- 5. 업적 정의 테이블 (마스터 데이터)
-- ─────────────────────────────────────────────────────────
CREATE TABLE achievement_definitions (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  icon VARCHAR(50) DEFAULT 'trophy',
  category VARCHAR(30) NOT NULL CHECK (category IN (
    'streak', 'completion', 'time', 'language', 'quiz', 'social'
  )),

  -- 레벨별 요구사항 (JSONB 배열)
  -- 예: [{"level": 1, "value": 7, "name": "브론즈"}, {"level": 2, "value": 30, "name": "실버"}]
  levels JSONB NOT NULL DEFAULT '[]',

  -- 포인트/보상
  points_per_level INTEGER DEFAULT 10,

  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────
-- 6. RLS 정책
-- ─────────────────────────────────────────────────────────
ALTER TABLE learning_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_learning_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievement_definitions ENABLE ROW LEVEL SECURITY;

-- learning_progress 정책
CREATE POLICY "Users can view own learning progress"
  ON learning_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own learning progress"
  ON learning_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- learning_streaks 정책
CREATE POLICY "Users can view own streaks"
  ON learning_streaks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own streaks"
  ON learning_streaks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- daily_learning_logs 정책
CREATE POLICY "Users can view own daily logs"
  ON daily_learning_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own daily logs"
  ON daily_learning_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- achievements 정책
CREATE POLICY "Users can view all achievements"
  ON achievements FOR SELECT
  USING (TRUE); -- 업적은 공개

CREATE POLICY "System manages achievements"
  ON achievements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- achievement_definitions 정책
CREATE POLICY "Anyone can view achievement definitions"
  ON achievement_definitions FOR SELECT
  USING (TRUE);

CREATE POLICY "Admins can manage definitions"
  ON achievement_definitions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- ─────────────────────────────────────────────────────────
-- 7. 트리거: updated_at 자동 갱신
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_learning_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_learning_progress_updated_at
  BEFORE UPDATE ON learning_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_learning_progress_updated_at();

CREATE TRIGGER trigger_learning_streaks_updated_at
  BEFORE UPDATE ON learning_streaks
  FOR EACH ROW
  EXECUTE FUNCTION update_learning_progress_updated_at();

CREATE TRIGGER trigger_daily_learning_logs_updated_at
  BEFORE UPDATE ON daily_learning_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_learning_progress_updated_at();

-- ─────────────────────────────────────────────────────────
-- 8. 함수: 학습 진행 업데이트
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_learning_progress(
  p_user_id UUID,
  p_content_id UUID,
  p_status VARCHAR DEFAULT NULL,
  p_progress_percentage INTEGER DEFAULT NULL,
  p_time_spent_seconds INTEGER DEFAULT 0,
  p_quiz_score INTEGER DEFAULT NULL,
  p_exercises_completed INTEGER DEFAULT NULL,
  p_exercises_total INTEGER DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  progress_id UUID,
  new_status VARCHAR,
  streak_updated BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_progress_id UUID;
  v_current_status VARCHAR;
  v_new_status VARCHAR;
  v_streak_updated BOOLEAN := FALSE;
BEGIN
  -- 진행 기록 Upsert
  INSERT INTO learning_progress (
    user_id, content_id, status, progress_percentage,
    time_spent_seconds, quiz_score, exercises_completed, exercises_total, notes,
    started_at, session_count, last_accessed_at
  )
  VALUES (
    p_user_id, p_content_id,
    COALESCE(p_status, 'in_progress'),
    COALESCE(p_progress_percentage, 0),
    p_time_spent_seconds,
    p_quiz_score,
    p_exercises_completed,
    p_exercises_total,
    p_notes,
    NOW(),
    1,
    NOW()
  )
  ON CONFLICT (user_id, content_id) DO UPDATE SET
    status = COALESCE(p_status, learning_progress.status),
    progress_percentage = COALESCE(p_progress_percentage, learning_progress.progress_percentage),
    time_spent_seconds = learning_progress.time_spent_seconds + p_time_spent_seconds,
    quiz_score = COALESCE(p_quiz_score, learning_progress.quiz_score),
    quiz_attempts = CASE WHEN p_quiz_score IS NOT NULL THEN learning_progress.quiz_attempts + 1 ELSE learning_progress.quiz_attempts END,
    exercises_completed = COALESCE(p_exercises_completed, learning_progress.exercises_completed),
    exercises_total = COALESCE(p_exercises_total, learning_progress.exercises_total),
    notes = COALESCE(p_notes, learning_progress.notes),
    session_count = learning_progress.session_count + 1,
    last_accessed_at = NOW(),
    completed_at = CASE
      WHEN COALESCE(p_status, learning_progress.status) = 'completed' AND learning_progress.completed_at IS NULL
      THEN NOW()
      ELSE learning_progress.completed_at
    END,
    updated_at = NOW()
  RETURNING id, status INTO v_progress_id, v_new_status;

  -- 일일 학습 로그 업데이트
  INSERT INTO daily_learning_logs (user_id, log_date, time_spent_seconds, sessions_count, content_ids)
  VALUES (
    p_user_id,
    CURRENT_DATE,
    p_time_spent_seconds,
    1,
    ARRAY[p_content_id]
  )
  ON CONFLICT (user_id, log_date) DO UPDATE SET
    time_spent_seconds = daily_learning_logs.time_spent_seconds + p_time_spent_seconds,
    sessions_count = daily_learning_logs.sessions_count + 1,
    content_ids = CASE
      WHEN NOT (p_content_id = ANY(daily_learning_logs.content_ids))
      THEN array_append(daily_learning_logs.content_ids, p_content_id)
      ELSE daily_learning_logs.content_ids
    END,
    contents_completed = CASE
      WHEN v_new_status = 'completed' THEN daily_learning_logs.contents_completed + 1
      ELSE daily_learning_logs.contents_completed
    END,
    updated_at = NOW();

  -- 스트릭 업데이트
  PERFORM update_learning_streak(p_user_id);
  v_streak_updated := TRUE;

  RETURN QUERY SELECT TRUE, v_progress_id, v_new_status, v_streak_updated, NULL::TEXT;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, FALSE, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────
-- 9. 함수: 스트릭 업데이트
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_learning_streak(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_last_activity DATE;
  v_current_streak INTEGER;
  v_longest_streak INTEGER;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- 기존 스트릭 조회 또는 생성
  INSERT INTO learning_streaks (user_id, last_activity_date, streak_start_date, current_streak)
  VALUES (p_user_id, v_today, v_today, 1)
  ON CONFLICT (user_id) DO UPDATE SET
    current_streak = CASE
      -- 오늘 이미 활동했으면 유지
      WHEN learning_streaks.last_activity_date = v_today THEN learning_streaks.current_streak
      -- 어제 활동했으면 스트릭 증가
      WHEN learning_streaks.last_activity_date = v_today - 1 THEN learning_streaks.current_streak + 1
      -- 그 외에는 스트릭 리셋
      ELSE 1
    END,
    streak_start_date = CASE
      WHEN learning_streaks.last_activity_date = v_today THEN learning_streaks.streak_start_date
      WHEN learning_streaks.last_activity_date = v_today - 1 THEN learning_streaks.streak_start_date
      ELSE v_today
    END,
    longest_streak = GREATEST(
      learning_streaks.longest_streak,
      CASE
        WHEN learning_streaks.last_activity_date = v_today THEN learning_streaks.current_streak
        WHEN learning_streaks.last_activity_date = v_today - 1 THEN learning_streaks.current_streak + 1
        ELSE 1
      END
    ),
    last_activity_date = v_today,
    total_learning_days = CASE
      WHEN learning_streaks.last_activity_date != v_today THEN learning_streaks.total_learning_days + 1
      ELSE learning_streaks.total_learning_days
    END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────
-- 10. 함수: 사용자 학습 통계 조회
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_user_learning_stats(p_user_id UUID)
RETURNS TABLE (
  total_contents_started BIGINT,
  total_contents_completed BIGINT,
  total_time_spent_seconds BIGINT,
  average_completion_rate NUMERIC(5,2),
  current_streak INTEGER,
  longest_streak INTEGER,
  total_learning_days INTEGER,
  this_week_time_seconds BIGINT,
  this_month_time_seconds BIGINT,
  favorite_language TEXT,
  last_activity_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  WITH progress_stats AS (
    SELECT
      COUNT(*)::BIGINT AS started,
      COUNT(*) FILTER (WHERE lp.status = 'completed')::BIGINT AS completed,
      COALESCE(SUM(lp.time_spent_seconds), 0)::BIGINT AS total_time,
      COALESCE(AVG(lp.progress_percentage), 0)::NUMERIC(5,2) AS avg_progress,
      MAX(lp.last_accessed_at) AS last_access
    FROM learning_progress lp
    WHERE lp.user_id = p_user_id
  ),
  streak_stats AS (
    SELECT
      COALESCE(ls.current_streak, 0) AS curr_streak,
      COALESCE(ls.longest_streak, 0) AS long_streak,
      COALESCE(ls.total_learning_days, 0) AS total_days
    FROM learning_streaks ls
    WHERE ls.user_id = p_user_id
  ),
  weekly_stats AS (
    SELECT COALESCE(SUM(dll.time_spent_seconds), 0)::BIGINT AS week_time
    FROM daily_learning_logs dll
    WHERE dll.user_id = p_user_id
      AND dll.log_date >= CURRENT_DATE - INTERVAL '7 days'
  ),
  monthly_stats AS (
    SELECT COALESCE(SUM(dll.time_spent_seconds), 0)::BIGINT AS month_time
    FROM daily_learning_logs dll
    WHERE dll.user_id = p_user_id
      AND dll.log_date >= CURRENT_DATE - INTERVAL '30 days'
  ),
  language_stats AS (
    SELECT gc.language
    FROM learning_progress lp
    JOIN generated_contents gc ON lp.content_id = gc.id
    WHERE lp.user_id = p_user_id
    GROUP BY gc.language
    ORDER BY SUM(lp.time_spent_seconds) DESC
    LIMIT 1
  )
  SELECT
    ps.started,
    ps.completed,
    ps.total_time,
    ps.avg_progress,
    COALESCE(ss.curr_streak, 0),
    COALESCE(ss.long_streak, 0),
    COALESCE(ss.total_days, 0),
    ws.week_time,
    ms.month_time,
    ls.language,
    ps.last_access
  FROM progress_stats ps
  CROSS JOIN LATERAL (SELECT * FROM streak_stats LIMIT 1) ss
  CROSS JOIN weekly_stats ws
  CROSS JOIN monthly_stats ms
  LEFT JOIN language_stats ls ON TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────
-- 11. 함수: 최근 학습 콘텐츠 조회
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_recent_learning(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 10,
  p_status VARCHAR DEFAULT NULL
)
RETURNS TABLE (
  progress_id UUID,
  content_id UUID,
  content_title TEXT,
  content_language TEXT,
  content_topic TEXT,
  status VARCHAR,
  progress_percentage INTEGER,
  time_spent_seconds INTEGER,
  last_accessed_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    lp.id,
    lp.content_id,
    gc.title,
    gc.language,
    gc.topic,
    lp.status,
    lp.progress_percentage,
    lp.time_spent_seconds,
    lp.last_accessed_at
  FROM learning_progress lp
  JOIN generated_contents gc ON lp.content_id = gc.id
  WHERE lp.user_id = p_user_id
    AND (p_status IS NULL OR lp.status = p_status)
  ORDER BY lp.last_accessed_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────
-- 12. 함수: 업적 확인 및 부여
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_and_grant_achievements(p_user_id UUID)
RETURNS TABLE (
  achievement_type VARCHAR,
  achievement_level INTEGER,
  newly_granted BOOLEAN
) AS $$
DECLARE
  v_streak INTEGER;
  v_completed INTEGER;
  v_total_time BIGINT;
  v_total_days INTEGER;
  v_def RECORD;
  v_level RECORD;
  v_existing BOOLEAN;
BEGIN
  -- 사용자 통계 조회
  SELECT
    COALESCE(ls.current_streak, 0),
    COALESCE(ls.total_contents_completed, 0),
    COALESCE(ls.total_time_spent_seconds, 0),
    COALESCE(ls.total_learning_days, 0)
  INTO v_streak, v_completed, v_total_time, v_total_days
  FROM learning_streaks ls
  WHERE ls.user_id = p_user_id;

  -- 업적 정의 순회
  FOR v_def IN SELECT * FROM achievement_definitions WHERE is_active = TRUE
  LOOP
    -- 레벨 순회
    FOR v_level IN SELECT * FROM jsonb_to_recordset(v_def.levels) AS x(level INTEGER, value INTEGER, name TEXT)
    LOOP
      -- 이미 달성했는지 확인
      SELECT EXISTS (
        SELECT 1 FROM achievements a
        WHERE a.user_id = p_user_id
          AND a.achievement_type = v_def.id
          AND a.achievement_level = v_level.level
      ) INTO v_existing;

      -- 아직 달성하지 않은 경우에만 확인
      IF NOT v_existing THEN
        -- 카테고리별 조건 확인
        IF (v_def.category = 'streak' AND v_streak >= v_level.value) OR
           (v_def.category = 'completion' AND v_completed >= v_level.value) OR
           (v_def.category = 'time' AND v_total_time >= v_level.value * 3600) OR -- 시간을 시간 단위로 변환
           (v_def.id = 'learning_days' AND v_total_days >= v_level.value)
        THEN
          -- 업적 부여
          INSERT INTO achievements (user_id, achievement_type, achievement_level, achievement_value)
          VALUES (p_user_id, v_def.id, v_level.level, v_level.value);

          RETURN QUERY SELECT v_def.id::VARCHAR, v_level.level, TRUE;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────
-- 13. 기본 업적 정의 데이터
-- ─────────────────────────────────────────────────────────
INSERT INTO achievement_definitions (id, name, description, icon, category, levels, points_per_level, display_order) VALUES
-- 스트릭 업적
('streak_beginner', '꾸준한 학습자', '연속 학습 일수 달성', 'flame', 'streak',
  '[{"level": 1, "value": 3, "name": "3일 연속"}, {"level": 2, "value": 7, "name": "7일 연속"}, {"level": 3, "value": 14, "name": "14일 연속"}, {"level": 4, "value": 30, "name": "30일 연속"}]',
  10, 1),

-- 완료 업적
('completion_master', '콘텐츠 마스터', '콘텐츠 학습 완료', 'check-circle', 'completion',
  '[{"level": 1, "value": 5, "name": "5개 완료"}, {"level": 2, "value": 20, "name": "20개 완료"}, {"level": 3, "value": 50, "name": "50개 완료"}, {"level": 4, "value": 100, "name": "100개 완료"}]',
  15, 2),

-- 시간 업적
('time_investor', '시간 투자자', '총 학습 시간 달성', 'clock', 'time',
  '[{"level": 1, "value": 10, "name": "10시간"}, {"level": 2, "value": 50, "name": "50시간"}, {"level": 3, "value": 100, "name": "100시간"}, {"level": 4, "value": 500, "name": "500시간"}]',
  20, 3),

-- 학습일 업적
('learning_days', '열정적인 학습자', '총 학습 일수 달성', 'calendar', 'completion',
  '[{"level": 1, "value": 10, "name": "10일"}, {"level": 2, "value": 30, "name": "30일"}, {"level": 3, "value": 100, "name": "100일"}, {"level": 4, "value": 365, "name": "365일"}]',
  15, 4);

-- ─────────────────────────────────────────────────────────
-- 14. 뷰: 리더보드
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW learning_leaderboard AS
SELECT
  p.id AS user_id,
  p.name AS user_name,
  ls.current_streak,
  ls.longest_streak,
  ls.total_contents_completed,
  ls.total_learning_days,
  ls.total_time_spent_seconds,
  (SELECT COUNT(*) FROM achievements a WHERE a.user_id = p.id)::INTEGER AS achievement_count
FROM profiles p
JOIN learning_streaks ls ON p.id = ls.user_id
WHERE ls.total_learning_days > 0
ORDER BY ls.current_streak DESC, ls.total_contents_completed DESC;

-- ─────────────────────────────────────────────────────────
-- 15. 코멘트
-- ─────────────────────────────────────────────────────────
COMMENT ON TABLE learning_progress IS '콘텐츠별 학습 진행 상태';
COMMENT ON TABLE learning_streaks IS '사용자 연속 학습 기록';
COMMENT ON TABLE daily_learning_logs IS '일일 학습 활동 로그';
COMMENT ON TABLE achievements IS '사용자 업적/배지';
COMMENT ON TABLE achievement_definitions IS '업적 정의 (마스터 데이터)';

COMMENT ON FUNCTION update_learning_progress IS '학습 진행 업데이트 (스트릭 자동 갱신)';
COMMENT ON FUNCTION update_learning_streak IS '스트릭 계산 및 업데이트';
COMMENT ON FUNCTION get_user_learning_stats IS '사용자 학습 통계 조회';
COMMENT ON FUNCTION get_recent_learning IS '최근 학습 콘텐츠 조회';
COMMENT ON FUNCTION check_and_grant_achievements IS '업적 확인 및 자동 부여';
