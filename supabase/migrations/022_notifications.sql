-- ─────────────────────────────────────────────────────────
-- 022_notifications.sql
-- 알림 및 알림 설정 시스템
-- ─────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────
-- 1. 알림 유형 ENUM
-- ─────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    'payment_success',      -- 결제 성공
    'payment_failed',       -- 결제 실패
    'subscription_started', -- 구독 시작
    'subscription_renewed', -- 구독 갱신
    'subscription_cancelled', -- 구독 취소
    'subscription_expiring', -- 구독 만료 예정
    'credits_low',          -- 크레딧 부족 경고
    'credits_added',        -- 크레딧 추가
    'content_generated',    -- 콘텐츠 생성 완료
    'content_failed',       -- 콘텐츠 생성 실패
    'achievement_unlocked', -- 업적 달성
    'streak_reminder',      -- 연속 학습 리마인더
    'streak_broken',        -- 연속 학습 끊김
    'level_up',             -- 레벨업
    'system_announcement',  -- 시스템 공지
    'maintenance',          -- 점검 안내
    'feature_update',       -- 기능 업데이트 안내
    'welcome',              -- 가입 환영
    'feedback_response'     -- 피드백 답변
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 알림 카테고리 ENUM
DO $$ BEGIN
  CREATE TYPE notification_category AS ENUM (
    'payment',    -- 결제 관련
    'subscription', -- 구독 관련
    'content',    -- 콘텐츠 관련
    'learning',   -- 학습 관련
    'system'      -- 시스템 관련
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 알림 채널 ENUM
DO $$ BEGIN
  CREATE TYPE notification_channel AS ENUM (
    'in_app',     -- 앱 내 알림
    'email',      -- 이메일
    'push'        -- 푸시 알림 (향후 확장)
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────
-- 2. 알림 테이블
-- ─────────────────────────────────────────────────────────
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

  -- 알림 내용
  type notification_type NOT NULL,
  category notification_category NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,

  -- 메타데이터 (관련 리소스 ID, 추가 정보 등)
  metadata JSONB DEFAULT '{}',

  -- 액션 링크 (클릭 시 이동할 URL)
  action_url TEXT,
  action_label VARCHAR(50),

  -- 상태
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,

  -- 이메일 발송 여부
  email_sent BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMPTZ,

  -- 만료 (일정 기간 후 자동 삭제용)
  expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_category ON notifications(category);
CREATE INDEX idx_notifications_expires ON notifications(expires_at) WHERE expires_at IS NOT NULL;

-- ─────────────────────────────────────────────────────────
-- 3. 알림 설정 테이블
-- ─────────────────────────────────────────────────────────
CREATE TABLE notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

  -- 카테고리별 설정
  category notification_category NOT NULL,

  -- 채널별 활성화 여부
  in_app_enabled BOOLEAN DEFAULT TRUE,
  email_enabled BOOLEAN DEFAULT TRUE,
  push_enabled BOOLEAN DEFAULT FALSE, -- 향후 확장

  -- 빈도 설정 (이메일용)
  email_frequency VARCHAR(20) DEFAULT 'instant'
    CHECK (email_frequency IN ('instant', 'daily', 'weekly', 'never')),

  -- 조용한 시간 (방해금지 모드)
  quiet_hours_start TIME,  -- 예: 22:00
  quiet_hours_end TIME,    -- 예: 08:00

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, category)
);

-- 인덱스
CREATE INDEX idx_notification_settings_user ON notification_settings(user_id);

-- ─────────────────────────────────────────────────────────
-- 4. 이메일 다이제스트 큐 (일간/주간 요약용)
-- ─────────────────────────────────────────────────────────
CREATE TABLE email_digest_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE NOT NULL,

  digest_type VARCHAR(20) NOT NULL CHECK (digest_type IN ('daily', 'weekly')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_email_digest_queue_pending ON email_digest_queue(scheduled_at, sent) WHERE sent = FALSE;
CREATE INDEX idx_email_digest_queue_user ON email_digest_queue(user_id);

-- ─────────────────────────────────────────────────────────
-- 5. RLS 정책
-- ─────────────────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_digest_queue ENABLE ROW LEVEL SECURITY;

-- notifications 정책
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- 시스템만 알림 생성 가능 (service role)
CREATE POLICY "Service role can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- notification_settings 정책
CREATE POLICY "Users can view own notification settings"
  ON notification_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification settings"
  ON notification_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification settings"
  ON notification_settings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- email_digest_queue 정책 (서비스 전용)
CREATE POLICY "Service role can manage email digest queue"
  ON email_digest_queue FOR ALL
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────
-- 6. 트리거: updated_at 자동 갱신
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_notification_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notification_settings_updated_at
  BEFORE UPDATE ON notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_settings_updated_at();

-- ─────────────────────────────────────────────────────────
-- 7. 함수: 기본 알림 설정 생성
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_default_notification_settings()
RETURNS TRIGGER AS $$
BEGIN
  -- 모든 카테고리에 대한 기본 설정 생성
  INSERT INTO notification_settings (user_id, category, in_app_enabled, email_enabled)
  VALUES
    (NEW.id, 'payment', TRUE, TRUE),
    (NEW.id, 'subscription', TRUE, TRUE),
    (NEW.id, 'content', TRUE, FALSE),
    (NEW.id, 'learning', TRUE, FALSE),
    (NEW.id, 'system', TRUE, TRUE)
  ON CONFLICT (user_id, category) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 새 사용자 가입 시 기본 알림 설정 생성
CREATE TRIGGER trigger_create_default_notification_settings
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_default_notification_settings();

-- ─────────────────────────────────────────────────────────
-- 8. 함수: 알림 생성
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type notification_type,
  p_title VARCHAR(200),
  p_message TEXT,
  p_metadata JSONB DEFAULT '{}',
  p_action_url TEXT DEFAULT NULL,
  p_action_label VARCHAR(50) DEFAULT NULL,
  p_expires_in_days INTEGER DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  notification_id UUID,
  should_send_email BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_notification_id UUID;
  v_category notification_category;
  v_email_enabled BOOLEAN := FALSE;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- 카테고리 결정
  v_category := CASE
    WHEN p_type IN ('payment_success', 'payment_failed', 'credits_low', 'credits_added')
      THEN 'payment'::notification_category
    WHEN p_type IN ('subscription_started', 'subscription_renewed', 'subscription_cancelled', 'subscription_expiring')
      THEN 'subscription'::notification_category
    WHEN p_type IN ('content_generated', 'content_failed')
      THEN 'content'::notification_category
    WHEN p_type IN ('achievement_unlocked', 'streak_reminder', 'streak_broken', 'level_up')
      THEN 'learning'::notification_category
    ELSE 'system'::notification_category
  END;

  -- 만료일 계산
  IF p_expires_in_days IS NOT NULL THEN
    v_expires_at := NOW() + (p_expires_in_days || ' days')::INTERVAL;
  END IF;

  -- 알림 생성
  INSERT INTO notifications (
    user_id, type, category, title, message,
    metadata, action_url, action_label, expires_at
  )
  VALUES (
    p_user_id, p_type, v_category, p_title, p_message,
    p_metadata, p_action_url, p_action_label, v_expires_at
  )
  RETURNING id INTO v_notification_id;

  -- 이메일 설정 확인
  SELECT ns.email_enabled INTO v_email_enabled
  FROM notification_settings ns
  WHERE ns.user_id = p_user_id AND ns.category = v_category;

  RETURN QUERY SELECT TRUE, v_notification_id, COALESCE(v_email_enabled, FALSE), NULL::TEXT;

EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, FALSE, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────
-- 9. 함수: 알림 읽음 처리
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION mark_notification_read(
  p_notification_id UUID,
  p_user_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  error_message TEXT
) AS $$
BEGIN
  UPDATE notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE id = p_notification_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, '알림을 찾을 수 없습니다.'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────
-- 10. 함수: 모든 알림 읽음 처리
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION mark_all_notifications_read(
  p_user_id UUID,
  p_category notification_category DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  updated_count INTEGER,
  error_message TEXT
) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE user_id = p_user_id
    AND is_read = FALSE
    AND (p_category IS NULL OR category = p_category);

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN QUERY SELECT TRUE, v_count, NULL::TEXT;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, 0, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────
-- 11. 함수: 읽지 않은 알림 수 조회
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_unread_notification_count(
  p_user_id UUID
)
RETURNS TABLE (
  total_unread BIGINT,
  payment_unread BIGINT,
  subscription_unread BIGINT,
  content_unread BIGINT,
  learning_unread BIGINT,
  system_unread BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE TRUE)::BIGINT AS total_unread,
    COUNT(*) FILTER (WHERE category = 'payment')::BIGINT AS payment_unread,
    COUNT(*) FILTER (WHERE category = 'subscription')::BIGINT AS subscription_unread,
    COUNT(*) FILTER (WHERE category = 'content')::BIGINT AS content_unread,
    COUNT(*) FILTER (WHERE category = 'learning')::BIGINT AS learning_unread,
    COUNT(*) FILTER (WHERE category = 'system')::BIGINT AS system_unread
  FROM notifications
  WHERE user_id = p_user_id AND is_read = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────
-- 12. 함수: 알림 목록 조회 (페이지네이션)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_notifications(
  p_user_id UUID,
  p_category notification_category DEFAULT NULL,
  p_unread_only BOOLEAN DEFAULT FALSE,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  type notification_type,
  category notification_category,
  title VARCHAR(200),
  message TEXT,
  metadata JSONB,
  action_url TEXT,
  action_label VARCHAR(50),
  is_read BOOLEAN,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.type,
    n.category,
    n.title,
    n.message,
    n.metadata,
    n.action_url,
    n.action_label,
    n.is_read,
    n.read_at,
    n.created_at
  FROM notifications n
  WHERE n.user_id = p_user_id
    AND (p_category IS NULL OR n.category = p_category)
    AND (p_unread_only = FALSE OR n.is_read = FALSE)
    AND (n.expires_at IS NULL OR n.expires_at > NOW())
  ORDER BY n.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────
-- 13. 함수: 알림 설정 업데이트
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_notification_settings(
  p_user_id UUID,
  p_category notification_category,
  p_in_app_enabled BOOLEAN DEFAULT NULL,
  p_email_enabled BOOLEAN DEFAULT NULL,
  p_email_frequency VARCHAR(20) DEFAULT NULL,
  p_quiet_hours_start TIME DEFAULT NULL,
  p_quiet_hours_end TIME DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  error_message TEXT
) AS $$
BEGIN
  UPDATE notification_settings
  SET
    in_app_enabled = COALESCE(p_in_app_enabled, in_app_enabled),
    email_enabled = COALESCE(p_email_enabled, email_enabled),
    email_frequency = COALESCE(p_email_frequency, email_frequency),
    quiet_hours_start = COALESCE(p_quiet_hours_start, quiet_hours_start),
    quiet_hours_end = COALESCE(p_quiet_hours_end, quiet_hours_end),
    updated_at = NOW()
  WHERE user_id = p_user_id AND category = p_category;

  IF NOT FOUND THEN
    -- 설정이 없으면 생성
    INSERT INTO notification_settings (
      user_id, category, in_app_enabled, email_enabled,
      email_frequency, quiet_hours_start, quiet_hours_end
    )
    VALUES (
      p_user_id, p_category,
      COALESCE(p_in_app_enabled, TRUE),
      COALESCE(p_email_enabled, TRUE),
      COALESCE(p_email_frequency, 'instant'),
      p_quiet_hours_start,
      p_quiet_hours_end
    );
  END IF;

  RETURN QUERY SELECT TRUE, NULL::TEXT;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────
-- 14. 함수: 오래된 알림 정리 (Cron Job용)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cleanup_old_notifications(
  p_read_days_old INTEGER DEFAULT 30,
  p_unread_days_old INTEGER DEFAULT 90
)
RETURNS TABLE (
  deleted_count INTEGER
) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM notifications
  WHERE
    -- 만료된 알림
    (expires_at IS NOT NULL AND expires_at < NOW())
    -- 읽은 알림 중 오래된 것
    OR (is_read = TRUE AND created_at < NOW() - (p_read_days_old || ' days')::INTERVAL)
    -- 읽지 않은 알림 중 매우 오래된 것
    OR (is_read = FALSE AND created_at < NOW() - (p_unread_days_old || ' days')::INTERVAL);

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────
-- 15. 함수: 사용자 알림 설정 전체 조회
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_notification_settings(
  p_user_id UUID
)
RETURNS TABLE (
  category notification_category,
  in_app_enabled BOOLEAN,
  email_enabled BOOLEAN,
  push_enabled BOOLEAN,
  email_frequency VARCHAR(20),
  quiet_hours_start TIME,
  quiet_hours_end TIME
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ns.category,
    ns.in_app_enabled,
    ns.email_enabled,
    ns.push_enabled,
    ns.email_frequency,
    ns.quiet_hours_start,
    ns.quiet_hours_end
  FROM notification_settings ns
  WHERE ns.user_id = p_user_id
  ORDER BY ns.category;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────
-- 16. 뷰: 알림 통계 대시보드
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW notification_stats AS
SELECT
  user_id,
  COUNT(*) AS total_notifications,
  COUNT(*) FILTER (WHERE is_read = FALSE) AS unread_count,
  COUNT(*) FILTER (WHERE is_read = TRUE) AS read_count,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS last_24h_count,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS last_7d_count,
  MAX(created_at) AS last_notification_at,
  MAX(read_at) AS last_read_at
FROM notifications
GROUP BY user_id;

-- ─────────────────────────────────────────────────────────
-- 17. 코멘트
-- ─────────────────────────────────────────────────────────
COMMENT ON TABLE notifications IS '사용자 알림 (결제, 구독, 콘텐츠, 학습, 시스템)';
COMMENT ON TABLE notification_settings IS '카테고리별 알림 설정 (채널, 빈도, 방해금지)';
COMMENT ON TABLE email_digest_queue IS '이메일 다이제스트 발송 대기열';
COMMENT ON FUNCTION create_notification IS '새 알림 생성 (카테고리 자동 분류)';
COMMENT ON FUNCTION mark_notification_read IS '단일 알림 읽음 처리';
COMMENT ON FUNCTION mark_all_notifications_read IS '모든/카테고리별 알림 읽음 처리';
COMMENT ON FUNCTION get_unread_notification_count IS '카테고리별 읽지 않은 알림 수';
COMMENT ON FUNCTION get_notifications IS '알림 목록 조회 (페이지네이션)';
COMMENT ON FUNCTION update_notification_settings IS '알림 설정 업데이트';
COMMENT ON FUNCTION cleanup_old_notifications IS '오래된 알림 정리 (Cron용)';
