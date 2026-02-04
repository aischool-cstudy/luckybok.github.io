-- =====================================================
-- 환불 처리 원자적 RPC 함수
-- 토스페이먼츠 환불 성공 후 DB 상태 업데이트를 단일 트랜잭션으로 처리
-- =====================================================

-- =====================================================
-- 1. 크레딧 구매 환불 처리 함수
-- 결제 상태 업데이트 → 크레딧 차감 트랜잭션 → 잔액 업데이트
-- =====================================================

CREATE OR REPLACE FUNCTION process_credit_refund_atomic(
    p_payment_id UUID,
    p_user_id UUID,
    p_refund_amount INTEGER,
    p_is_partial BOOLEAN,
    p_credits_to_deduct INTEGER,
    p_reason TEXT DEFAULT '고객 요청'
)
RETURNS TABLE (
    success BOOLEAN,
    new_balance INTEGER,
    error_message TEXT
) AS $$
DECLARE
    v_current_balance INTEGER;
    v_new_balance INTEGER;
    v_now TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
    -- 1. 현재 크레딧 잔액 조회 (FOR UPDATE로 락)
    SELECT credits_balance INTO v_current_balance
    FROM profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0, '사용자를 찾을 수 없습니다'::TEXT;
        RETURN;
    END IF;

    v_new_balance := GREATEST(0, COALESCE(v_current_balance, 0) - p_credits_to_deduct);

    -- 2. 결제 상태 업데이트
    UPDATE payments
    SET
        status = CASE WHEN p_is_partial THEN 'partial_refunded' ELSE 'refunded' END,
        refunded_amount = p_refund_amount,
        refunded_at = v_now,
        refund_reason = p_reason,
        updated_at = v_now
    WHERE id = p_payment_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0, '결제 정보를 찾을 수 없습니다'::TEXT;
        RETURN;
    END IF;

    -- 3. 크레딧 차감 트랜잭션 생성
    INSERT INTO credit_transactions (
        user_id,
        type,
        amount,
        balance,
        description,
        payment_id
    ) VALUES (
        p_user_id,
        'refund',
        -p_credits_to_deduct,
        v_new_balance,
        '환불로 인한 크레딧 차감 (' || p_credits_to_deduct || '개)',
        p_payment_id
    );

    -- 4. 프로필 크레딧 잔액 업데이트
    UPDATE profiles
    SET
        credits_balance = v_new_balance,
        updated_at = v_now
    WHERE id = p_user_id;

    RETURN QUERY SELECT TRUE, v_new_balance, NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, 0, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION process_credit_refund_atomic IS '크레딧 구매 환불을 원자적으로 처리 (결제 업데이트 + 크레딧 차감 + 잔액 업데이트)';

-- =====================================================
-- 2. 구독 환불 처리 함수
-- 결제 상태 업데이트 → 구독 취소 → 플랜 변경
-- =====================================================

CREATE OR REPLACE FUNCTION process_subscription_refund_atomic(
    p_payment_id UUID,
    p_subscription_id UUID,
    p_user_id UUID,
    p_refund_amount INTEGER,
    p_is_partial BOOLEAN,
    p_reason TEXT DEFAULT '고객 요청'
)
RETURNS TABLE (
    success BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    v_now TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
    -- 1. 결제 상태 업데이트
    UPDATE payments
    SET
        status = CASE WHEN p_is_partial THEN 'partial_refunded' ELSE 'refunded' END,
        refunded_amount = p_refund_amount,
        refunded_at = v_now,
        refund_reason = p_reason,
        updated_at = v_now
    WHERE id = p_payment_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, '결제 정보를 찾을 수 없습니다'::TEXT;
        RETURN;
    END IF;

    -- 2. 구독 취소 처리
    UPDATE subscriptions
    SET
        status = 'canceled',
        canceled_at = v_now,
        updated_at = v_now
    WHERE id = p_subscription_id;

    -- 3. 프로필 플랜을 starter로 변경
    UPDATE profiles
    SET
        plan = 'starter',
        plan_expires_at = NULL,
        daily_generations_remaining = 10,
        updated_at = v_now
    WHERE id = p_user_id;

    RETURN QUERY SELECT TRUE, NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION process_subscription_refund_atomic IS '구독 환불을 원자적으로 처리 (결제 업데이트 + 구독 취소 + 플랜 변경)';

-- =====================================================
-- 3. 일반 결제 환불 처리 함수 (크레딧/구독 외)
-- 결제 상태만 업데이트
-- =====================================================

CREATE OR REPLACE FUNCTION process_simple_refund_atomic(
    p_payment_id UUID,
    p_refund_amount INTEGER,
    p_is_partial BOOLEAN,
    p_reason TEXT DEFAULT '고객 요청'
)
RETURNS TABLE (
    success BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    v_now TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
    -- 결제 상태 업데이트
    UPDATE payments
    SET
        status = CASE WHEN p_is_partial THEN 'partial_refunded' ELSE 'refunded' END,
        refunded_amount = p_refund_amount,
        refunded_at = v_now,
        refund_reason = p_reason,
        updated_at = v_now
    WHERE id = p_payment_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, '결제 정보를 찾을 수 없습니다'::TEXT;
        RETURN;
    END IF;

    RETURN QUERY SELECT TRUE, NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION process_simple_refund_atomic IS '일반 결제 환불을 원자적으로 처리 (결제 상태만 업데이트)';
