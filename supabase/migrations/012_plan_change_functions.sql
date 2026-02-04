-- =====================================================
-- 플랜 변경 (업그레이드/다운그레이드) 기능
-- 구독 플랜 변경을 위한 스키마 및 RPC 함수
-- =====================================================

-- =====================================================
-- 1. subscriptions 테이블에 예약 변경 컬럼 추가
-- =====================================================

ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS scheduled_plan VARCHAR(20)
    CHECK (scheduled_plan IS NULL OR scheduled_plan IN ('pro', 'team', 'enterprise'));

ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS scheduled_billing_cycle VARCHAR(10)
    CHECK (scheduled_billing_cycle IS NULL OR scheduled_billing_cycle IN ('monthly', 'yearly'));

ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS scheduled_change_at TIMESTAMP WITH TIME ZONE;

-- 예약 변경 인덱스
CREATE INDEX IF NOT EXISTS idx_subscriptions_scheduled_change
    ON subscriptions(scheduled_change_at)
    WHERE scheduled_change_at IS NOT NULL;

COMMENT ON COLUMN subscriptions.scheduled_plan IS '다운그레이드 시 예약된 새 플랜';
COMMENT ON COLUMN subscriptions.scheduled_billing_cycle IS '예약된 새 결제 주기';
COMMENT ON COLUMN subscriptions.scheduled_change_at IS '플랜 변경 예약 일시 (기간 종료 시점)';

-- =====================================================
-- 2. payments 테이블에 plan_change 타입 추가
-- =====================================================

-- 기존 CHECK 제약 조건 삭제 후 재생성
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_type_check;
ALTER TABLE payments ADD CONSTRAINT payments_type_check
    CHECK (type IN ('subscription', 'credit_purchase', 'plan_change'));

-- =====================================================
-- 3. 플랜 즉시 변경 (업그레이드) 원자적 함수
-- 빌링키 결제 성공 후 호출
-- =====================================================

CREATE OR REPLACE FUNCTION change_plan_immediate_atomic(
    p_payment_id UUID,
    p_payment_key VARCHAR(200),
    p_method VARCHAR(50),
    p_receipt_url TEXT,
    p_paid_at TIMESTAMP WITH TIME ZONE,
    p_subscription_id UUID,
    p_new_plan VARCHAR(20),
    p_new_billing_cycle VARCHAR(10),
    p_prorated_amount INTEGER
)
RETURNS TABLE (
    success BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    v_user_id UUID;
    v_daily_limit INTEGER;
BEGIN
    -- 구독에서 사용자 ID 조회
    SELECT user_id INTO v_user_id
    FROM subscriptions
    WHERE id = p_subscription_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, '구독을 찾을 수 없습니다'::TEXT;
        RETURN;
    END IF;

    -- 플랜별 일일 생성 횟수 설정
    v_daily_limit := CASE p_new_plan
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

    -- 2. 구독 플랜 즉시 변경 (기간 유지, 예약 정보 초기화)
    UPDATE subscriptions
    SET
        plan = p_new_plan,
        billing_cycle = p_new_billing_cycle,
        scheduled_plan = NULL,
        scheduled_billing_cycle = NULL,
        scheduled_change_at = NULL,
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'plan_change_history', COALESCE(metadata->'plan_change_history', '[]'::jsonb) || jsonb_build_array(
                jsonb_build_object(
                    'type', 'upgrade',
                    'from_plan', plan,
                    'to_plan', p_new_plan,
                    'prorated_amount', p_prorated_amount,
                    'changed_at', NOW()
                )
            )
        ),
        updated_at = NOW()
    WHERE id = p_subscription_id;

    -- 3. 프로필 업데이트 (플랜 + 일일 횟수)
    UPDATE profiles
    SET
        plan = p_new_plan,
        daily_generations_remaining = v_daily_limit,
        updated_at = NOW()
    WHERE id = v_user_id;

    RETURN QUERY SELECT TRUE, NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION change_plan_immediate_atomic IS '플랜 업그레이드 즉시 적용 (결제 확정 + 플랜 변경 + 프로필 업데이트)';

-- =====================================================
-- 4. 플랜 변경 예약 (다운그레이드) 원자적 함수
-- =====================================================

CREATE OR REPLACE FUNCTION schedule_plan_change_atomic(
    p_subscription_id UUID,
    p_new_plan VARCHAR(20),
    p_new_billing_cycle VARCHAR(10)
)
RETURNS TABLE (
    success BOOLEAN,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
) AS $$
DECLARE
    v_current_period_end TIMESTAMP WITH TIME ZONE;
    v_current_plan VARCHAR(20);
BEGIN
    -- 구독 정보 조회
    SELECT current_period_end, plan INTO v_current_period_end, v_current_plan
    FROM subscriptions
    WHERE id = p_subscription_id
    AND status = 'active'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::TIMESTAMP WITH TIME ZONE, '활성 구독을 찾을 수 없습니다'::TEXT;
        RETURN;
    END IF;

    -- 예약 변경 설정
    UPDATE subscriptions
    SET
        scheduled_plan = p_new_plan,
        scheduled_billing_cycle = p_new_billing_cycle,
        scheduled_change_at = v_current_period_end,
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'scheduled_change', jsonb_build_object(
                'from_plan', v_current_plan,
                'to_plan', p_new_plan,
                'to_billing_cycle', p_new_billing_cycle,
                'scheduled_at', NOW(),
                'effective_at', v_current_period_end
            )
        ),
        updated_at = NOW()
    WHERE id = p_subscription_id;

    RETURN QUERY SELECT TRUE, v_current_period_end, NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, NULL::TIMESTAMP WITH TIME ZONE, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION schedule_plan_change_atomic IS '플랜 다운그레이드 예약 (기간 종료 시 적용)';

-- =====================================================
-- 5. 예약된 플랜 변경 취소 함수
-- =====================================================

CREATE OR REPLACE FUNCTION cancel_scheduled_plan_change(
    p_subscription_id UUID
)
RETURNS TABLE (
    success BOOLEAN,
    error_message TEXT
) AS $$
BEGIN
    UPDATE subscriptions
    SET
        scheduled_plan = NULL,
        scheduled_billing_cycle = NULL,
        scheduled_change_at = NULL,
        metadata = metadata - 'scheduled_change',
        updated_at = NOW()
    WHERE id = p_subscription_id
    AND scheduled_plan IS NOT NULL;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, '예약된 플랜 변경이 없습니다'::TEXT;
        RETURN;
    END IF;

    RETURN QUERY SELECT TRUE, NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cancel_scheduled_plan_change IS '예약된 플랜 변경 취소';

-- =====================================================
-- 6. 예약된 플랜 변경 적용 함수 (Cron에서 호출)
-- =====================================================

CREATE OR REPLACE FUNCTION apply_scheduled_plan_changes()
RETURNS TABLE (
    success BOOLEAN,
    processed_count INTEGER,
    error_message TEXT
) AS $$
DECLARE
    v_lock_id BIGINT := 1003;  -- 고유 락 ID
    v_processed_count INTEGER := 0;
    v_subscription RECORD;
    v_daily_limit INTEGER;
BEGIN
    -- Advisory lock 획득 시도 (논블로킹)
    IF NOT pg_try_advisory_lock(v_lock_id) THEN
        RETURN QUERY SELECT FALSE, 0, '다른 프로세스가 실행 중입니다'::TEXT;
        RETURN;
    END IF;

    BEGIN
        -- 예약된 변경이 있고, 변경 시점이 지난 구독들 처리
        FOR v_subscription IN
            SELECT
                s.id AS subscription_id,
                s.user_id,
                s.scheduled_plan,
                s.scheduled_billing_cycle,
                s.current_period_end
            FROM subscriptions s
            WHERE s.status = 'active'
            AND s.scheduled_plan IS NOT NULL
            AND s.scheduled_change_at <= NOW()
            FOR UPDATE
        LOOP
            -- 플랜별 일일 생성 횟수 설정
            v_daily_limit := CASE v_subscription.scheduled_plan
                WHEN 'pro' THEN 100
                WHEN 'team' THEN 500
                WHEN 'enterprise' THEN 999999
                ELSE 10
            END;

            -- 구독 플랜 변경 적용
            UPDATE subscriptions
            SET
                plan = scheduled_plan,
                billing_cycle = scheduled_billing_cycle,
                scheduled_plan = NULL,
                scheduled_billing_cycle = NULL,
                scheduled_change_at = NULL,
                metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                    'plan_change_history', COALESCE(metadata->'plan_change_history', '[]'::jsonb) || jsonb_build_array(
                        jsonb_build_object(
                            'type', 'downgrade',
                            'from_plan', plan,
                            'to_plan', scheduled_plan,
                            'applied_at', NOW()
                        )
                    )
                ) - 'scheduled_change',
                updated_at = NOW()
            WHERE id = v_subscription.subscription_id;

            -- 프로필 업데이트
            UPDATE profiles
            SET
                plan = v_subscription.scheduled_plan,
                daily_generations_remaining = v_daily_limit,
                updated_at = NOW()
            WHERE id = v_subscription.user_id;

            v_processed_count := v_processed_count + 1;
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

COMMENT ON FUNCTION apply_scheduled_plan_changes IS '예약된 플랜 변경 일괄 적용 (Cron에서 호출)';

-- =====================================================
-- 7. 예약된 플랜 변경 조회 함수
-- =====================================================

CREATE OR REPLACE FUNCTION get_scheduled_plan_change(
    p_subscription_id UUID
)
RETURNS TABLE (
    has_scheduled_change BOOLEAN,
    current_plan VARCHAR(20),
    current_billing_cycle VARCHAR(10),
    scheduled_plan VARCHAR(20),
    scheduled_billing_cycle VARCHAR(10),
    scheduled_change_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.scheduled_plan IS NOT NULL,
        s.plan,
        s.billing_cycle,
        s.scheduled_plan,
        s.scheduled_billing_cycle,
        s.scheduled_change_at
    FROM subscriptions s
    WHERE s.id = p_subscription_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_scheduled_plan_change IS '예약된 플랜 변경 정보 조회';
