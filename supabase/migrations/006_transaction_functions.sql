-- =====================================================
-- 트랜잭션 원자성을 위한 RPC 함수들
-- 결제, 구독, 크레딧 관련 복합 연산의 원자적 처리
-- =====================================================

-- =====================================================
-- 1. 크레딧 결제 원자적 처리
-- 결제 승인 → 크레딧 트랜잭션 → 프로필 업데이트를 단일 트랜잭션으로
-- =====================================================

CREATE OR REPLACE FUNCTION confirm_credit_payment_atomic(
    p_payment_id UUID,
    p_payment_key VARCHAR(200),
    p_method VARCHAR(50),
    p_receipt_url TEXT,
    p_paid_at TIMESTAMP WITH TIME ZONE,
    p_user_id UUID,
    p_credits_to_add INTEGER,
    p_description TEXT,
    p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    new_balance INTEGER,
    error_message TEXT
) AS $$
DECLARE
    v_current_balance INTEGER;
    v_new_balance INTEGER;
BEGIN
    -- 1. 현재 잔액 조회 (FOR UPDATE로 락)
    SELECT credits_balance INTO v_current_balance
    FROM profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0, '사용자를 찾을 수 없습니다'::TEXT;
        RETURN;
    END IF;

    v_new_balance := COALESCE(v_current_balance, 0) + p_credits_to_add;

    -- 2. 결제 상태 업데이트
    UPDATE payments
    SET
        status = 'completed',
        payment_key = p_payment_key,
        method = p_method,
        receipt_url = p_receipt_url,
        paid_at = p_paid_at,
        updated_at = NOW()
    WHERE id = p_payment_id;

    -- 3. 크레딧 트랜잭션 생성
    INSERT INTO credit_transactions (
        user_id,
        type,
        amount,
        balance,
        description,
        payment_id,
        expires_at
    ) VALUES (
        p_user_id,
        'purchase',
        p_credits_to_add,
        v_new_balance,
        p_description,
        p_payment_id,
        p_expires_at
    );

    -- 4. 프로필 크레딧 잔액 업데이트
    UPDATE profiles
    SET
        credits_balance = v_new_balance,
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN QUERY SELECT TRUE, v_new_balance, NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, 0, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION confirm_credit_payment_atomic IS '크레딧 결제 승인을 원자적으로 처리 (결제 업데이트 + 트랜잭션 생성 + 잔액 업데이트)';

-- =====================================================
-- 2. 구독 확정 원자적 처리
-- 결제 완료 → 구독 생성 → 프로필 업데이트를 단일 트랜잭션으로
-- =====================================================

CREATE OR REPLACE FUNCTION confirm_subscription_atomic(
    p_payment_id UUID,
    p_payment_key VARCHAR(200),
    p_method VARCHAR(50),
    p_receipt_url TEXT,
    p_paid_at TIMESTAMP WITH TIME ZONE,
    p_user_id UUID,
    p_plan VARCHAR(20),
    p_billing_cycle VARCHAR(10),
    p_billing_key_id UUID,
    p_period_start TIMESTAMP WITH TIME ZONE,
    p_period_end TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
    success BOOLEAN,
    subscription_id UUID,
    error_message TEXT
) AS $$
DECLARE
    v_subscription_id UUID;
    v_daily_limit INTEGER;
BEGIN
    -- 플랜별 일일 생성 횟수 설정
    v_daily_limit := CASE p_plan
        WHEN 'pro' THEN 100
        WHEN 'team' THEN 500
        WHEN 'enterprise' THEN 999999
        ELSE 10
    END;

    -- 1. 결제 상태 업데이트
    UPDATE payments
    SET
        status = 'completed',
        payment_key = p_payment_key,
        method = p_method,
        receipt_url = p_receipt_url,
        paid_at = p_paid_at,
        updated_at = NOW()
    WHERE id = p_payment_id;

    -- 2. 구독 레코드 생성
    INSERT INTO subscriptions (
        user_id,
        plan,
        billing_cycle,
        status,
        current_period_start,
        current_period_end,
        billing_key_id
    ) VALUES (
        p_user_id,
        p_plan,
        p_billing_cycle,
        'active',
        p_period_start,
        p_period_end,
        p_billing_key_id
    )
    RETURNING id INTO v_subscription_id;

    -- 3. 결제 메타데이터에 구독 ID 추가
    UPDATE payments
    SET metadata = metadata || jsonb_build_object('subscriptionId', v_subscription_id)
    WHERE id = p_payment_id;

    -- 4. 프로필 업데이트 (플랜 + 일일 횟수)
    UPDATE profiles
    SET
        plan = p_plan,
        plan_expires_at = p_period_end,
        daily_generations_remaining = v_daily_limit,
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN QUERY SELECT TRUE, v_subscription_id, NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION confirm_subscription_atomic IS '구독 확정을 원자적으로 처리 (결제 업데이트 + 구독 생성 + 프로필 업데이트)';

-- =====================================================
-- 3. 구독 갱신 원자적 처리
-- 결제 완료 → 구독 기간 연장을 단일 트랜잭션으로
-- =====================================================

CREATE OR REPLACE FUNCTION renew_subscription_atomic(
    p_payment_id UUID,
    p_payment_key VARCHAR(200),
    p_method VARCHAR(50),
    p_receipt_url TEXT,
    p_paid_at TIMESTAMP WITH TIME ZONE,
    p_subscription_id UUID,
    p_new_period_start TIMESTAMP WITH TIME ZONE,
    p_new_period_end TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
    success BOOLEAN,
    error_message TEXT
) AS $$
BEGIN
    -- 1. 결제 상태 업데이트
    UPDATE payments
    SET
        status = 'completed',
        payment_key = p_payment_key,
        method = p_method,
        receipt_url = p_receipt_url,
        paid_at = p_paid_at,
        updated_at = NOW()
    WHERE id = p_payment_id;

    -- 2. 구독 기간 연장
    UPDATE subscriptions
    SET
        current_period_start = p_new_period_start,
        current_period_end = p_new_period_end,
        status = 'active',  -- past_due 상태에서 복구 가능
        updated_at = NOW()
    WHERE id = p_subscription_id;

    -- 3. 프로필 만료일 업데이트
    UPDATE profiles
    SET
        plan_expires_at = p_new_period_end,
        updated_at = NOW()
    WHERE id = (SELECT user_id FROM subscriptions WHERE id = p_subscription_id);

    RETURN QUERY SELECT TRUE, NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION renew_subscription_atomic IS '구독 갱신을 원자적으로 처리 (결제 업데이트 + 구독 기간 연장)';

-- =====================================================
-- 4. 생성 횟수/크레딧 복구 함수
-- AI 생성 실패 시 차감된 크레딧 또는 횟수 복구
-- =====================================================

CREATE OR REPLACE FUNCTION restore_generation_credit(
    p_user_id UUID,
    p_use_credits BOOLEAN,
    p_topic TEXT DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    restored_value INTEGER,
    error_message TEXT
) AS $$
DECLARE
    v_current_balance INTEGER;
    v_current_remaining INTEGER;
BEGIN
    IF p_use_credits THEN
        -- 크레딧 복구
        SELECT credits_balance INTO v_current_balance
        FROM profiles
        WHERE id = p_user_id
        FOR UPDATE;

        UPDATE profiles
        SET
            credits_balance = v_current_balance + 1,
            updated_at = NOW()
        WHERE id = p_user_id;

        -- 복구 트랜잭션 기록
        INSERT INTO credit_transactions (
            user_id,
            type,
            amount,
            balance,
            description
        ) VALUES (
            p_user_id,
            'admin_adjustment',
            1,
            v_current_balance + 1,
            COALESCE('콘텐츠 생성 실패로 인한 크레딧 복구: ' || p_topic, '콘텐츠 생성 실패로 인한 크레딧 복구')
        );

        RETURN QUERY SELECT TRUE, v_current_balance + 1, NULL::TEXT;
    ELSE
        -- 일일 생성 횟수 복구
        SELECT daily_generations_remaining INTO v_current_remaining
        FROM profiles
        WHERE id = p_user_id
        FOR UPDATE;

        UPDATE profiles
        SET
            daily_generations_remaining = v_current_remaining + 1,
            updated_at = NOW()
        WHERE id = p_user_id;

        RETURN QUERY SELECT TRUE, v_current_remaining + 1, NULL::TEXT;
    END IF;

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, 0, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION restore_generation_credit IS 'AI 콘텐츠 생성 실패 시 크레딧 또는 일일 횟수 복구';

-- =====================================================
-- 5. 일일 생성 횟수 리셋 함수 (개선 버전)
-- Advisory lock으로 중복 실행 방지
-- =====================================================

CREATE OR REPLACE FUNCTION reset_daily_generations_safe()
RETURNS TABLE (
    success BOOLEAN,
    updated_count INTEGER,
    error_message TEXT
) AS $$
DECLARE
    v_lock_id BIGINT := 1001;  -- 고유 락 ID
    v_updated_count INTEGER;
BEGIN
    -- Advisory lock 획득 시도 (논블로킹)
    IF NOT pg_try_advisory_lock(v_lock_id) THEN
        RETURN QUERY SELECT FALSE, 0, '다른 프로세스가 실행 중입니다'::TEXT;
        RETURN;
    END IF;

    BEGIN
        -- 일일 생성 횟수 리셋
        WITH updated AS (
            UPDATE profiles
            SET
                daily_generations_remaining = CASE
                    WHEN plan = 'starter' THEN 10
                    WHEN plan = 'pro' THEN 100
                    WHEN plan = 'team' THEN 500
                    WHEN plan = 'enterprise' THEN 999999
                    ELSE 10
                END,
                daily_reset_at = NOW(),
                updated_at = NOW()
            WHERE daily_reset_at IS NULL
               OR daily_reset_at < NOW() - INTERVAL '24 hours'
            RETURNING 1
        )
        SELECT COUNT(*) INTO v_updated_count FROM updated;

        -- 락 해제
        PERFORM pg_advisory_unlock(v_lock_id);

        RETURN QUERY SELECT TRUE, v_updated_count, NULL::TEXT;

    EXCEPTION WHEN OTHERS THEN
        -- 에러 발생 시에도 락 해제
        PERFORM pg_advisory_unlock(v_lock_id);
        RETURN QUERY SELECT FALSE, 0, SQLERRM::TEXT;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION reset_daily_generations_safe IS '일일 생성 횟수 리셋 (Advisory lock으로 중복 실행 방지)';

-- =====================================================
-- 6. 만료 크레딧 처리 함수 (개선 버전)
-- Advisory lock으로 중복 실행 방지
-- =====================================================

CREATE OR REPLACE FUNCTION expire_credits_safe()
RETURNS TABLE (
    success BOOLEAN,
    processed_count INTEGER,
    error_message TEXT
) AS $$
DECLARE
    v_lock_id BIGINT := 1002;  -- 고유 락 ID
    v_processed_count INTEGER := 0;
    r RECORD;
    v_expired_amount INTEGER;
    v_current_balance INTEGER;
BEGIN
    -- Advisory lock 획득 시도 (논블로킹)
    IF NOT pg_try_advisory_lock(v_lock_id) THEN
        RETURN QUERY SELECT FALSE, 0, '다른 프로세스가 실행 중입니다'::TEXT;
        RETURN;
    END IF;

    BEGIN
        FOR r IN
            SELECT DISTINCT user_id
            FROM credit_transactions
            WHERE expires_at <= NOW()
            AND expires_at > NOW() - INTERVAL '1 day'  -- 오늘 만료되는 것만
            AND type = 'purchase'
            AND amount > 0
        LOOP
            -- 만료된 크레딧 금액 계산
            SELECT COALESCE(SUM(amount), 0) INTO v_expired_amount
            FROM credit_transactions
            WHERE user_id = r.user_id
            AND expires_at <= NOW()
            AND type = 'purchase'
            AND amount > 0;

            IF v_expired_amount > 0 THEN
                -- 현재 잔액 조회
                SELECT credits_balance INTO v_current_balance
                FROM profiles
                WHERE id = r.user_id
                FOR UPDATE;

                -- 만료 트랜잭션 생성
                INSERT INTO credit_transactions (
                    user_id,
                    type,
                    amount,
                    balance,
                    description
                ) VALUES (
                    r.user_id,
                    'expiry',
                    -v_expired_amount,
                    GREATEST(0, COALESCE(v_current_balance, 0) - v_expired_amount),
                    '크레딧 만료'
                );

                -- 잔액 업데이트 (트리거가 처리하지만 명시적으로도 수행)
                UPDATE profiles
                SET
                    credits_balance = GREATEST(0, COALESCE(credits_balance, 0) - v_expired_amount),
                    updated_at = NOW()
                WHERE id = r.user_id;

                v_processed_count := v_processed_count + 1;
            END IF;
        END LOOP;

        -- 락 해제
        PERFORM pg_advisory_unlock(v_lock_id);

        RETURN QUERY SELECT TRUE, v_processed_count, NULL::TEXT;

    EXCEPTION WHEN OTHERS THEN
        -- 에러 발생 시에도 락 해제
        PERFORM pg_advisory_unlock(v_lock_id);
        RETURN QUERY SELECT FALSE, 0, SQLERRM::TEXT;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION expire_credits_safe IS '만료된 크레딧 처리 (Advisory lock으로 중복 실행 방지)';

-- =====================================================
-- 7. 구독 갱신 대상 조회 함수
-- 갱신이 필요한 구독 목록 반환
-- =====================================================

CREATE OR REPLACE FUNCTION get_subscriptions_due_for_renewal(
    p_hours_ahead INTEGER DEFAULT 24
)
RETURNS TABLE (
    subscription_id UUID,
    user_id UUID,
    plan VARCHAR(20),
    billing_cycle VARCHAR(10),
    current_period_end TIMESTAMP WITH TIME ZONE,
    billing_key_id UUID,
    cancel_at_period_end BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        s.user_id,
        s.plan,
        s.billing_cycle,
        s.current_period_end,
        s.billing_key_id,
        COALESCE(s.cancel_at_period_end, FALSE)
    FROM subscriptions s
    WHERE s.status = 'active'
    AND s.current_period_end <= NOW() + (p_hours_ahead || ' hours')::INTERVAL
    AND s.current_period_end > NOW() - INTERVAL '1 day'  -- 최근 1일 이내
    ORDER BY s.current_period_end ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_subscriptions_due_for_renewal IS '갱신이 필요한 구독 목록 조회';

-- =====================================================
-- 8. webhook_logs 테이블에 status 컬럼 추가
-- 재처리 기능을 위한 상태 관리
-- =====================================================

ALTER TABLE webhook_logs
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'processed', 'failed', 'retrying'));

ALTER TABLE webhook_logs
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

ALTER TABLE webhook_logs
ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMP WITH TIME ZONE;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status_created ON webhook_logs(status, created_at DESC);

-- =====================================================
-- 9. 실패한 웹훅 조회 함수
-- =====================================================

CREATE OR REPLACE FUNCTION get_failed_webhooks(
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    event_type VARCHAR(50),
    payload JSONB,
    error TEXT,
    retry_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    last_retry_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        w.id,
        w.event_type,
        w.payload,
        w.error,
        w.retry_count,
        w.created_at,
        w.last_retry_at
    FROM webhook_logs w
    WHERE w.status = 'failed'
    AND w.retry_count < 3  -- 최대 재시도 횟수 미만
    ORDER BY w.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_failed_webhooks IS '재처리가 필요한 실패 웹훅 목록 조회';

-- =====================================================
-- 10. 웹훅 재처리 상태 업데이트 함수
-- =====================================================

CREATE OR REPLACE FUNCTION mark_webhook_for_retry(
    p_webhook_id UUID
)
RETURNS TABLE (
    success BOOLEAN,
    error_message TEXT
) AS $$
BEGIN
    UPDATE webhook_logs
    SET
        status = 'retrying',
        retry_count = retry_count + 1,
        last_retry_at = NOW()
    WHERE id = p_webhook_id
    AND status = 'failed'
    AND retry_count < 3;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, '웹훅을 찾을 수 없거나 재시도 횟수 초과'::TEXT;
        RETURN;
    END IF;

    RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION mark_webhook_for_retry IS '웹훅 재처리 상태로 변경';
