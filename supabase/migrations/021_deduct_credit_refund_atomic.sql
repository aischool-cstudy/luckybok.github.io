-- =====================================================
-- 환불 시 크레딧 차감 원자적 RPC 함수
-- 결제 취소로 인한 크레딧 차감을 안전하게 처리
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
    -- 유효성 검사
    IF p_amount <= 0 THEN
        RETURN QUERY SELECT FALSE, 0, 0, '유효하지 않은 크레딧 양입니다.'::TEXT;
        RETURN;
    END IF;

    IF p_payment_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, 0, '결제 ID가 필요합니다.'::TEXT;
        RETURN;
    END IF;

    -- 이미 처리된 환불인지 확인
    IF EXISTS (
        SELECT 1 FROM credit_transactions
        WHERE payment_id = p_payment_id AND type = 'refund'
    ) THEN
        RETURN QUERY SELECT FALSE, 0, 0, '이미 처리된 환불입니다.'::TEXT;
        RETURN;
    END IF;

    -- 현재 잔액 조회 (FOR UPDATE로 락)
    SELECT credits_balance INTO v_current_balance
    FROM profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0, 0, '사용자를 찾을 수 없습니다.'::TEXT;
        RETURN;
    END IF;

    -- 차감 가능한 실제 금액 계산 (잔액 이하로 제한, 음수 방지)
    v_actual_deduction := LEAST(p_amount, COALESCE(v_current_balance, 0));
    v_new_balance := COALESCE(v_current_balance, 0) - v_actual_deduction;

    -- 1. 크레딧 트랜잭션 생성 (차감은 음수로 기록)
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
        -v_actual_deduction,
        v_new_balance,
        p_description,
        p_payment_id
    );

    -- 2. 프로필 잔액 업데이트
    UPDATE profiles
    SET
        credits_balance = v_new_balance,
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN QUERY SELECT TRUE, v_new_balance, v_actual_deduction, NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, 0, 0, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 함수 실행 권한 설정
GRANT EXECUTE ON FUNCTION deduct_credit_for_refund_atomic(UUID, INTEGER, UUID, TEXT) TO service_role;

COMMENT ON FUNCTION deduct_credit_for_refund_atomic IS
'환불 시 크레딧 차감을 원자적으로 처리합니다.
- 잔액이 차감 금액보다 적으면 잔액만큼만 차감 (음수 방지)
- 중복 환불 방지 (payment_id로 확인)
- deducted_amount: 실제 차감된 금액 반환';
