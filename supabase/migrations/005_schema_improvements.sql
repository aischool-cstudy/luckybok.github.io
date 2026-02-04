-- =====================================================
-- 스키마 개선 마이그레이션
-- 누락된 FK 제약조건 및 컬럼 추가
-- =====================================================

-- =====================================================
-- 1. subscriptions.billing_key_id FK 제약조건 추가
-- =====================================================

ALTER TABLE subscriptions
ADD CONSTRAINT fk_subscriptions_billing_key_id
    FOREIGN KEY (billing_key_id) REFERENCES billing_keys(id) ON DELETE SET NULL;

-- =====================================================
-- 2. generated_contents에 updated_at 컬럼 추가
-- =====================================================

ALTER TABLE generated_contents
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- updated_at 트리거 적용
CREATE TRIGGER update_generated_contents_updated_at
    BEFORE UPDATE ON generated_contents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 3. generated_contents에 UPDATE RLS 정책 추가
-- =====================================================

CREATE POLICY "Users can update own contents"
    ON generated_contents FOR UPDATE
    USING (auth.uid() = user_id);

-- =====================================================
-- 4. 일일 생성 횟수 리셋 함수
-- =====================================================

CREATE OR REPLACE FUNCTION reset_daily_generations()
RETURNS void AS $$
BEGIN
    UPDATE profiles
    SET
        daily_generations_remaining = CASE
            WHEN plan = 'starter' THEN 10
            WHEN plan = 'pro' THEN 100
            WHEN plan = 'team' THEN 500
            WHEN plan = 'enterprise' THEN 999999
            ELSE 10
        END,
        daily_reset_at = NOW()
    WHERE daily_reset_at IS NULL
       OR daily_reset_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. 사용자 크레딧 차감 함수
-- =====================================================

CREATE OR REPLACE FUNCTION use_generation_credit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_remaining INTEGER;
BEGIN
    -- 현재 남은 횟수 조회
    SELECT daily_generations_remaining INTO v_remaining
    FROM profiles
    WHERE id = p_user_id;

    -- 횟수 부족 시 실패
    IF v_remaining <= 0 THEN
        RETURN FALSE;
    END IF;

    -- 횟수 차감
    UPDATE profiles
    SET daily_generations_remaining = daily_generations_remaining - 1
    WHERE id = p_user_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. 구독 만료 체크 함수
-- =====================================================

CREATE OR REPLACE FUNCTION check_expired_subscriptions()
RETURNS void AS $$
BEGIN
    -- 만료된 구독 상태 변경
    UPDATE subscriptions
    SET
        status = 'canceled',
        updated_at = NOW()
    WHERE status = 'active'
      AND cancel_at_period_end = TRUE
      AND current_period_end < NOW();

    -- 만료된 사용자 플랜 다운그레이드
    UPDATE profiles
    SET
        plan = 'starter',
        plan_expires_at = NULL,
        daily_generations_remaining = 10
    WHERE id IN (
        SELECT user_id FROM subscriptions
        WHERE status = 'canceled'
          AND current_period_end < NOW()
    )
    AND plan != 'starter';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. 결제 통계 뷰
-- =====================================================

CREATE OR REPLACE VIEW payment_stats AS
SELECT
    user_id,
    COUNT(*) FILTER (WHERE status = 'completed') as total_payments,
    SUM(amount) FILTER (WHERE status = 'completed') as total_amount,
    COUNT(*) FILTER (WHERE status = 'refunded' OR status = 'partial_refunded') as total_refunds,
    MAX(paid_at) as last_payment_at
FROM payments
GROUP BY user_id;

-- =====================================================
-- 8. 콘텐츠 생성 통계 뷰
-- =====================================================

CREATE OR REPLACE VIEW generation_stats AS
SELECT
    user_id,
    COUNT(*) as total_generations,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as today_generations,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as week_generations,
    array_agg(DISTINCT language) as used_languages,
    MAX(created_at) as last_generation_at
FROM generated_contents
GROUP BY user_id;

-- =====================================================
-- 9. 인덱스 최적화
-- =====================================================

-- 복합 인덱스: 사용자별 최근 콘텐츠 조회 최적화
CREATE INDEX IF NOT EXISTS idx_generated_contents_user_created
    ON generated_contents(user_id, created_at DESC);

-- 복합 인덱스: 활성 구독 조회 최적화
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_active
    ON subscriptions(user_id, status)
    WHERE status = 'active';

-- 복합 인덱스: 결제 내역 조회 최적화
CREATE INDEX IF NOT EXISTS idx_payments_user_status_created
    ON payments(user_id, status, created_at DESC);

-- 복합 인덱스: 만료 예정 구독 조회
CREATE INDEX IF NOT EXISTS idx_subscriptions_expiring
    ON subscriptions(current_period_end, status)
    WHERE cancel_at_period_end = TRUE;

-- =====================================================
-- 10. 코멘트 추가 (문서화)
-- =====================================================

COMMENT ON TABLE profiles IS '사용자 프로필 - Supabase Auth 확장';
COMMENT ON TABLE generated_contents IS 'AI 생성 교육 콘텐츠';
COMMENT ON TABLE subscriptions IS '정기 구독 정보';
COMMENT ON TABLE payments IS '결제 이력 (단건 + 정기)';
COMMENT ON TABLE billing_keys IS '토스페이먼츠 빌링키 (AES-256 암호화)';
COMMENT ON TABLE credit_transactions IS '크레딧 거래 내역';
COMMENT ON TABLE webhook_logs IS '토스페이먼츠 웹훅 로그';
COMMENT ON TABLE teams IS 'Team 플랜 팀 정보';
COMMENT ON TABLE team_members IS '팀 멤버 관계';
COMMENT ON TABLE team_invitations IS '팀 초대';
COMMENT ON TABLE team_api_keys IS 'Team API 키';
COMMENT ON TABLE team_api_usage IS 'API 사용량 로그';

COMMENT ON FUNCTION reset_daily_generations() IS '일일 생성 횟수 리셋 (cron job용)';
COMMENT ON FUNCTION use_generation_credit(UUID) IS '콘텐츠 생성 시 크레딧 차감';
COMMENT ON FUNCTION check_expired_subscriptions() IS '만료 구독 처리 (cron job용)';
COMMENT ON FUNCTION expire_credits() IS '만료 크레딧 정리 (cron job용)';
