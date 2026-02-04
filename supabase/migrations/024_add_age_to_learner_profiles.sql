-- ─────────────────────────────────────────────────────────
-- 024_add_age_to_learner_profiles.sql
-- learner_profiles 테이블에 나이 필드 추가
-- ─────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────
-- 나이 컬럼 추가
-- ─────────────────────────────────────────────────────────
ALTER TABLE learner_profiles
ADD COLUMN IF NOT EXISTS age INTEGER CHECK (age >= 10 AND age <= 100);

-- ─────────────────────────────────────────────────────────
-- complete_onboarding 함수 업데이트 (나이 포함)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION complete_onboarding(
  p_user_id UUID,
  p_experience_level TEXT,
  p_learning_goals TEXT[],
  p_preferred_languages TEXT[],
  p_weekly_time_commitment INTEGER DEFAULT 5,
  p_age INTEGER DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  profile_id UUID,
  error_message TEXT
) AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  -- 나이 유효성 검사
  IF p_age IS NOT NULL AND (p_age < 10 OR p_age > 100) THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, '나이는 10세에서 100세 사이여야 합니다.'::TEXT;
    RETURN;
  END IF;

  -- 기존 프로필 확인 및 업데이트/생성
  INSERT INTO learner_profiles (
    user_id,
    experience_level,
    learning_goals,
    preferred_languages,
    weekly_time_commitment,
    age,
    onboarding_completed,
    onboarding_completed_at
  )
  VALUES (
    p_user_id,
    p_experience_level,
    p_learning_goals,
    p_preferred_languages,
    p_weekly_time_commitment,
    p_age,
    TRUE,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    experience_level = EXCLUDED.experience_level,
    learning_goals = EXCLUDED.learning_goals,
    preferred_languages = EXCLUDED.preferred_languages,
    weekly_time_commitment = EXCLUDED.weekly_time_commitment,
    age = EXCLUDED.age,
    onboarding_completed = TRUE,
    onboarding_completed_at = NOW(),
    updated_at = NOW()
  RETURNING id INTO v_profile_id;

  RETURN QUERY SELECT TRUE, v_profile_id, NULL::TEXT;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────
-- 나이만 업데이트하는 별도 함수 추가
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_learner_age(
  p_user_id UUID,
  p_age INTEGER
)
RETURNS TABLE (
  success BOOLEAN,
  error_message TEXT
) AS $$
BEGIN
  -- 나이 유효성 검사
  IF p_age IS NULL THEN
    RETURN QUERY SELECT FALSE, '나이를 입력해주세요.'::TEXT;
    RETURN;
  END IF;

  IF p_age < 10 OR p_age > 100 THEN
    RETURN QUERY SELECT FALSE, '나이는 10세에서 100세 사이여야 합니다.'::TEXT;
    RETURN;
  END IF;

  -- 프로필 업데이트 또는 생성
  INSERT INTO learner_profiles (user_id, age)
  VALUES (p_user_id, p_age)
  ON CONFLICT (user_id) DO UPDATE SET
    age = EXCLUDED.age,
    updated_at = NOW();

  RETURN QUERY SELECT TRUE, NULL::TEXT;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────
-- 코멘트 추가
-- ─────────────────────────────────────────────────────────
COMMENT ON COLUMN learner_profiles.age IS '학습자 나이 (10-100세)';
COMMENT ON FUNCTION update_learner_age IS '학습자 나이 개별 업데이트';
