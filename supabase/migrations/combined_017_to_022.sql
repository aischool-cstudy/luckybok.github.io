-- =====================================================
-- 통합 마이그레이션 파일: 017 ~ 022
-- Supabase SQL Editor에서 실행하세요
-- 반드시 combined_006_to_022.sql 실행 후 실행!
-- =====================================================

-- =====================================================
-- 017_content_bookmarks.sql
-- =====================================================

CREATE TABLE IF NOT EXISTS bookmark_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#6366f1',
  icon VARCHAR(50) DEFAULT 'folder',
  parent_id UUID REFERENCES bookmark_folders(id) ON DELETE CASCADE,
  order_index INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmark_folders_unique_name
  ON bookmark_folders(user_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::UUID), name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmark_folders_default
  ON bookmark_folders(user_id) WHERE is_default = TRUE;
CREATE INDEX IF NOT EXISTS idx_bookmark_folders_user_id ON bookmark_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmark_folders_parent_id ON bookmark_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_bookmark_folders_order ON bookmark_folders(user_id, order_index);

CREATE TABLE IF NOT EXISTS content_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content_id UUID REFERENCES generated_contents(id) ON DELETE CASCADE NOT NULL,
  folder_id UUID REFERENCES bookmark_folders(id) ON DELETE SET NULL,
  note TEXT,
  tags TEXT[] DEFAULT '{}',
  is_favorite BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_content_bookmarks_unique ON content_bookmarks(user_id, content_id);
CREATE INDEX IF NOT EXISTS idx_content_bookmarks_user_id ON content_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_content_bookmarks_folder_id ON content_bookmarks(folder_id);
CREATE INDEX IF NOT EXISTS idx_content_bookmarks_content_id ON content_bookmarks(content_id);
CREATE INDEX IF NOT EXISTS idx_content_bookmarks_favorite ON content_bookmarks(user_id, is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX IF NOT EXISTS idx_content_bookmarks_created_at ON content_bookmarks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_bookmarks_tags ON content_bookmarks USING GIN(tags);

ALTER TABLE bookmark_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own bookmark folders" ON bookmark_folders;
CREATE POLICY "Users can view own bookmark folders" ON bookmark_folders FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own bookmark folders" ON bookmark_folders;
CREATE POLICY "Users can insert own bookmark folders" ON bookmark_folders FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own bookmark folders" ON bookmark_folders;
CREATE POLICY "Users can update own bookmark folders" ON bookmark_folders FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own bookmark folders" ON bookmark_folders;
CREATE POLICY "Users can delete own bookmark folders" ON bookmark_folders FOR DELETE USING (auth.uid() = user_id AND is_default = FALSE);

DROP POLICY IF EXISTS "Users can view own bookmarks" ON content_bookmarks;
CREATE POLICY "Users can view own bookmarks" ON content_bookmarks FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own bookmarks" ON content_bookmarks;
CREATE POLICY "Users can insert own bookmarks" ON content_bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own bookmarks" ON content_bookmarks;
CREATE POLICY "Users can update own bookmarks" ON content_bookmarks FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own bookmarks" ON content_bookmarks;
CREATE POLICY "Users can delete own bookmarks" ON content_bookmarks FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_bookmark_folder_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_bookmark_folders_updated_at ON bookmark_folders;
CREATE TRIGGER trigger_bookmark_folders_updated_at BEFORE UPDATE ON bookmark_folders FOR EACH ROW EXECUTE FUNCTION update_bookmark_folder_updated_at();

CREATE OR REPLACE FUNCTION update_content_bookmark_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_content_bookmarks_updated_at ON content_bookmarks;
CREATE TRIGGER trigger_content_bookmarks_updated_at BEFORE UPDATE ON content_bookmarks FOR EACH ROW EXECUTE FUNCTION update_content_bookmark_updated_at();

CREATE OR REPLACE FUNCTION create_default_bookmark_folder()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO bookmark_folders (user_id, name, description, is_default, icon)
  VALUES (NEW.id, '전체 북마크', '기본 북마크 폴더입니다.', TRUE, 'bookmark')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_create_default_bookmark_folder ON profiles;
CREATE TRIGGER trigger_create_default_bookmark_folder AFTER INSERT ON profiles FOR EACH ROW EXECUTE FUNCTION create_default_bookmark_folder();

CREATE OR REPLACE FUNCTION toggle_bookmark(p_user_id UUID, p_content_id UUID, p_folder_id UUID DEFAULT NULL)
RETURNS TABLE (success BOOLEAN, action TEXT, bookmark_id UUID, error_message TEXT) AS $$
DECLARE v_existing_id UUID; v_new_id UUID; v_default_folder_id UUID;
BEGIN
  SELECT id INTO v_existing_id FROM content_bookmarks WHERE user_id = p_user_id AND content_id = p_content_id;
  IF v_existing_id IS NOT NULL THEN
    DELETE FROM content_bookmarks WHERE id = v_existing_id;
    RETURN QUERY SELECT TRUE, 'removed'::TEXT, v_existing_id, NULL::TEXT;
  ELSE
    IF p_folder_id IS NULL THEN
      SELECT id INTO v_default_folder_id FROM bookmark_folders WHERE user_id = p_user_id AND is_default = TRUE;
      p_folder_id := v_default_folder_id;
    END IF;
    INSERT INTO content_bookmarks (user_id, content_id, folder_id) VALUES (p_user_id, p_content_id, p_folder_id) RETURNING id INTO v_new_id;
    RETURN QUERY SELECT TRUE, 'added'::TEXT, v_new_id, NULL::TEXT;
  END IF;
EXCEPTION WHEN OTHERS THEN RETURN QUERY SELECT FALSE, 'error'::TEXT, NULL::UUID, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 018_content_feedback.sql
-- =====================================================

CREATE TABLE IF NOT EXISTS content_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content_id UUID REFERENCES generated_contents(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  accuracy_score INTEGER CHECK (accuracy_score >= 1 AND accuracy_score <= 5),
  clarity_score INTEGER CHECK (clarity_score >= 1 AND clarity_score <= 5),
  code_quality_score INTEGER CHECK (code_quality_score >= 1 AND code_quality_score <= 5),
  difficulty_match_score INTEGER CHECK (difficulty_match_score >= 1 AND difficulty_match_score <= 5),
  feedback_text TEXT,
  was_helpful BOOLEAN,
  would_recommend BOOLEAN,
  improvement_requests TEXT[] DEFAULT '{}',
  feedback_source VARCHAR(50) DEFAULT 'web',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_content_ratings_unique ON content_ratings(user_id, content_id);
CREATE INDEX IF NOT EXISTS idx_content_ratings_user_id ON content_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_content_ratings_content_id ON content_ratings(content_id);
CREATE INDEX IF NOT EXISTS idx_content_ratings_rating ON content_ratings(rating);

CREATE TABLE IF NOT EXISTS feedback_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rating_id UUID REFERENCES content_ratings(id) ON DELETE CASCADE NOT NULL,
  responder_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  response_text TEXT NOT NULL,
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feedback_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rating_id UUID REFERENCES content_ratings(id) ON DELETE CASCADE NOT NULL,
  reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason VARCHAR(50) NOT NULL CHECK (reason IN ('spam', 'inappropriate', 'misleading', 'harassment', 'other')),
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  resolution_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE content_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all ratings" ON content_ratings;
CREATE POLICY "Users can view all ratings" ON content_ratings FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "Users can insert own ratings" ON content_ratings;
CREATE POLICY "Users can insert own ratings" ON content_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own ratings" ON content_ratings;
CREATE POLICY "Users can update own ratings" ON content_ratings FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own ratings" ON content_ratings;
CREATE POLICY "Users can delete own ratings" ON content_ratings FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 019_learning_progress.sql
-- =====================================================

CREATE TABLE IF NOT EXISTS learning_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content_id UUID REFERENCES generated_contents(id) ON DELETE CASCADE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'revisiting')),
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  time_spent_seconds INTEGER DEFAULT 0 CHECK (time_spent_seconds >= 0),
  session_count INTEGER DEFAULT 0,
  quiz_score INTEGER CHECK (quiz_score >= 0 AND quiz_score <= 100),
  quiz_attempts INTEGER DEFAULT 0,
  exercises_completed INTEGER DEFAULT 0,
  exercises_total INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_learning_progress_unique ON learning_progress(user_id, content_id);
CREATE INDEX IF NOT EXISTS idx_learning_progress_user_id ON learning_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_progress_status ON learning_progress(user_id, status);

CREATE TABLE IF NOT EXISTS learning_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  streak_start_date DATE,
  last_activity_date DATE,
  weekly_goal_days INTEGER DEFAULT 5 CHECK (weekly_goal_days >= 1 AND weekly_goal_days <= 7),
  weekly_completed_days INTEGER DEFAULT 0,
  total_learning_days INTEGER DEFAULT 0,
  total_contents_completed INTEGER DEFAULT 0,
  total_time_spent_seconds BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_learning_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  contents_started INTEGER DEFAULT 0,
  contents_completed INTEGER DEFAULT 0,
  time_spent_seconds INTEGER DEFAULT 0,
  sessions_count INTEGER DEFAULT 0,
  content_ids UUID[] DEFAULT '{}',
  time_by_language JSONB DEFAULT '{}',
  daily_goal_met BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_learning_logs_unique ON daily_learning_logs(user_id, log_date);

CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  achievement_type VARCHAR(50) NOT NULL,
  achievement_level INTEGER DEFAULT 1,
  achieved_at TIMESTAMPTZ DEFAULT NOW(),
  achievement_value INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_achievements_unique ON achievements(user_id, achievement_type, achievement_level);

CREATE TABLE IF NOT EXISTS achievement_definitions (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  icon VARCHAR(50) DEFAULT 'trophy',
  category VARCHAR(30) NOT NULL CHECK (category IN ('streak', 'completion', 'time', 'language', 'quiz', 'social')),
  levels JSONB NOT NULL DEFAULT '[]',
  points_per_level INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE learning_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_learning_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievement_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own learning progress" ON learning_progress;
CREATE POLICY "Users can view own learning progress" ON learning_progress FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can manage own learning progress" ON learning_progress;
CREATE POLICY "Users can manage own learning progress" ON learning_progress FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own streaks" ON learning_streaks;
CREATE POLICY "Users can view own streaks" ON learning_streaks FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can manage own streaks" ON learning_streaks;
CREATE POLICY "Users can manage own streaks" ON learning_streaks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view achievement definitions" ON achievement_definitions;
CREATE POLICY "Anyone can view achievement definitions" ON achievement_definitions FOR SELECT USING (TRUE);

-- 기본 업적 정의
INSERT INTO achievement_definitions (id, name, description, icon, category, levels, points_per_level, display_order)
SELECT 'streak_beginner', '꾸준한 학습자', '연속 학습 일수 달성', 'flame', 'streak',
  '[{"level": 1, "value": 3, "name": "3일 연속"}, {"level": 2, "value": 7, "name": "7일 연속"}]', 10, 1
WHERE NOT EXISTS (SELECT 1 FROM achievement_definitions WHERE id = 'streak_beginner');

INSERT INTO achievement_definitions (id, name, description, icon, category, levels, points_per_level, display_order)
SELECT 'completion_master', '콘텐츠 마스터', '콘텐츠 학습 완료', 'check-circle', 'completion',
  '[{"level": 1, "value": 5, "name": "5개 완료"}, {"level": 2, "value": 20, "name": "20개 완료"}]', 15, 2
WHERE NOT EXISTS (SELECT 1 FROM achievement_definitions WHERE id = 'completion_master');

-- =====================================================
-- 020_webhook_atomic_upsert.sql
-- =====================================================

CREATE OR REPLACE FUNCTION upsert_webhook_log_atomic(
    p_idempotency_key VARCHAR(128),
    p_event_type VARCHAR(50),
    p_payload JSONB
) RETURNS TABLE (
    action TEXT,
    log_id UUID,
    existing_status TEXT
) LANGUAGE plpgsql AS $$
DECLARE
    v_existing_id UUID;
    v_existing_status TEXT;
    v_new_id UUID;
BEGIN
    INSERT INTO webhook_logs (idempotency_key, event_type, payload, status, created_at)
    VALUES (p_idempotency_key, p_event_type, p_payload, 'pending', NOW())
    ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL
    DO NOTHING
    RETURNING id INTO v_new_id;

    IF v_new_id IS NOT NULL THEN
        RETURN QUERY SELECT 'created'::TEXT, v_new_id, NULL::TEXT;
        RETURN;
    END IF;

    SELECT id, status INTO v_existing_id, v_existing_status
    FROM webhook_logs WHERE idempotency_key = p_idempotency_key;

    IF v_existing_status = 'processed' THEN
        RETURN QUERY SELECT 'already_processed'::TEXT, v_existing_id, v_existing_status;
        RETURN;
    END IF;

    UPDATE webhook_logs SET status = 'pending', error = NULL, payload = p_payload WHERE id = v_existing_id;
    RETURN QUERY SELECT 'reprocessing'::TEXT, v_existing_id, v_existing_status;
END;
$$;

-- =====================================================
-- 021_deduct_credit_refund_atomic.sql
-- =====================================================

CREATE OR REPLACE FUNCTION deduct_credit_for_refund_atomic(
    p_user_id UUID,
    p_amount INTEGER,
    p_payment_id UUID,
    p_description TEXT DEFAULT '결제 취소로 인한 크레딧 차감'
)
RETURNS TABLE (
    success BOOLEAN,
    new_balance INTEGER,
    deducted_amount INTEGER,
    error_message TEXT
) AS $$
DECLARE
    v_current_balance INTEGER;
    v_new_balance INTEGER;
    v_actual_deduction INTEGER;
BEGIN
    IF p_amount <= 0 THEN
        RETURN QUERY SELECT FALSE, 0, 0, '유효하지 않은 크레딧 양입니다.'::TEXT;
        RETURN;
    END IF;

    IF p_payment_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, 0, '결제 ID가 필요합니다.'::TEXT;
        RETURN;
    END IF;

    IF EXISTS (SELECT 1 FROM credit_transactions WHERE payment_id = p_payment_id AND type = 'refund') THEN
        RETURN QUERY SELECT FALSE, 0, 0, '이미 처리된 환불입니다.'::TEXT;
        RETURN;
    END IF;

    SELECT credits_balance INTO v_current_balance FROM profiles WHERE id = p_user_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0, 0, '사용자를 찾을 수 없습니다.'::TEXT;
        RETURN;
    END IF;

    v_actual_deduction := LEAST(p_amount, COALESCE(v_current_balance, 0));
    v_new_balance := COALESCE(v_current_balance, 0) - v_actual_deduction;

    INSERT INTO credit_transactions (user_id, type, amount, balance, description, payment_id)
    VALUES (p_user_id, 'refund', -v_actual_deduction, v_new_balance, p_description, p_payment_id);

    UPDATE profiles SET credits_balance = v_new_balance, updated_at = NOW() WHERE id = p_user_id;

    RETURN QUERY SELECT TRUE, v_new_balance, v_actual_deduction, NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, 0, 0, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 022_notifications.sql
-- =====================================================

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    'payment_success', 'payment_failed', 'subscription_started', 'subscription_renewed',
    'subscription_cancelled', 'subscription_expiring', 'credits_low', 'credits_added',
    'content_generated', 'content_failed', 'achievement_unlocked', 'streak_reminder',
    'streak_broken', 'level_up', 'system_announcement', 'maintenance', 'feature_update',
    'welcome', 'feedback_response'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_category AS ENUM ('payment', 'subscription', 'content', 'learning', 'system');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_channel AS ENUM ('in_app', 'email', 'push');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type notification_type NOT NULL,
  category notification_category NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  action_url TEXT,
  action_label VARCHAR(50),
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  email_sent BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  category notification_category NOT NULL,
  in_app_enabled BOOLEAN DEFAULT TRUE,
  email_enabled BOOLEAN DEFAULT TRUE,
  push_enabled BOOLEAN DEFAULT FALSE,
  email_frequency VARCHAR(20) DEFAULT 'instant' CHECK (email_frequency IN ('instant', 'daily', 'weekly', 'never')),
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category)
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications" ON notifications FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role can insert notifications" ON notifications;
CREATE POLICY "Service role can insert notifications" ON notifications FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own notification settings" ON notification_settings;
CREATE POLICY "Users can view own notification settings" ON notification_settings FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own notification settings" ON notification_settings;
CREATE POLICY "Users can insert own notification settings" ON notification_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own notification settings" ON notification_settings;
CREATE POLICY "Users can update own notification settings" ON notification_settings FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION create_default_notification_settings()
RETURNS TRIGGER AS $$
BEGIN
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

DROP TRIGGER IF EXISTS trigger_create_default_notification_settings ON profiles;
CREATE TRIGGER trigger_create_default_notification_settings AFTER INSERT ON profiles FOR EACH ROW EXECUTE FUNCTION create_default_notification_settings();

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
RETURNS TABLE (success BOOLEAN, notification_id UUID, should_send_email BOOLEAN, error_message TEXT) AS $$
DECLARE
  v_notification_id UUID;
  v_category notification_category;
  v_email_enabled BOOLEAN := FALSE;
  v_expires_at TIMESTAMPTZ;
BEGIN
  v_category := CASE
    WHEN p_type IN ('payment_success', 'payment_failed', 'credits_low', 'credits_added') THEN 'payment'::notification_category
    WHEN p_type IN ('subscription_started', 'subscription_renewed', 'subscription_cancelled', 'subscription_expiring') THEN 'subscription'::notification_category
    WHEN p_type IN ('content_generated', 'content_failed') THEN 'content'::notification_category
    WHEN p_type IN ('achievement_unlocked', 'streak_reminder', 'streak_broken', 'level_up') THEN 'learning'::notification_category
    ELSE 'system'::notification_category
  END;

  IF p_expires_in_days IS NOT NULL THEN
    v_expires_at := NOW() + (p_expires_in_days || ' days')::INTERVAL;
  END IF;

  INSERT INTO notifications (user_id, type, category, title, message, metadata, action_url, action_label, expires_at)
  VALUES (p_user_id, p_type, v_category, p_title, p_message, p_metadata, p_action_url, p_action_label, v_expires_at)
  RETURNING id INTO v_notification_id;

  SELECT ns.email_enabled INTO v_email_enabled FROM notification_settings ns WHERE ns.user_id = p_user_id AND ns.category = v_category;

  RETURN QUERY SELECT TRUE, v_notification_id, COALESCE(v_email_enabled, FALSE), NULL::TEXT;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, NULL::UUID, FALSE, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID, p_user_id UUID)
RETURNS TABLE (success BOOLEAN, error_message TEXT) AS $$
BEGIN
  UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE id = p_notification_id AND user_id = p_user_id;
  IF NOT FOUND THEN RETURN QUERY SELECT FALSE, '알림을 찾을 수 없습니다.'::TEXT; RETURN; END IF;
  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS TABLE (total_unread BIGINT, payment_unread BIGINT, subscription_unread BIGINT, content_unread BIGINT, learning_unread BIGINT, system_unread BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE category = 'payment')::BIGINT,
    COUNT(*) FILTER (WHERE category = 'subscription')::BIGINT,
    COUNT(*) FILTER (WHERE category = 'content')::BIGINT,
    COUNT(*) FILTER (WHERE category = 'learning')::BIGINT,
    COUNT(*) FILTER (WHERE category = 'system')::BIGINT
  FROM notifications WHERE user_id = p_user_id AND is_read = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 마이그레이션 완료!
-- =====================================================
