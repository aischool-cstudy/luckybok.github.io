-- =====================================================
-- 크레딧 사용/추가 원자적 RPC 함수
-- 트랜잭션 기록과 잔액 업데이트를 단일 트랜잭션으로 처리
-- =====================================================

-- =====================================================
-- 1. 크레딧 사용 (차감) 원자적 처리
-- =====================================================

CREATE OR REPLACE FUNCTION use_credit_atomic(
    p_user_id UUID,
    p_amount INTEGER,
    p_description TEXT
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
    -- 유효성 검사
    IF p_amount <= 0 THEN
        RETURN QUERY SELECT FALSE, 0, '유효하지 않은 크레딧 양입니다.'::TEXT;
        RETURN;
    END IF;

    -- 현재 잔액 조회 (FOR UPDATE로 락)
    SELECT credits_balance INTO v_current_balance
    FROM profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0, '사용자를 찾을 수 없습니다.'::TEXT;
        RETURN;
    END IF;

    -- 잔액 부족 확인
    IF COALESCE(v_current_balance, 0) < p_amount THEN
        RETURN QUERY SELECT FALSE, COALESCE(v_current_balance, 0), '크레딧이 부족합니다.'::TEXT;
        RETURN;
    END IF;

    v_new_balance := v_current_balance - p_amount;

    -- 1. 크레딧 트랜잭션 생성 (사용은 음수로 기록)
    INSERT INTO credit_transactions (
        user_id,
        type,
        amount,
        balance,
        description
    ) VALUES (
        p_user_id,
        'usage',
        -p_amount,
        v_new_balance,
        p_description
    );

    -- 2. 프로필 잔액 업데이트
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

COMMENT ON FUNCTION use_credit_atomic IS '크레딧 사용(차감)을 원자적으로 처리 (트랜잭션 생성 + 잔액 업데이트)';

-- =====================================================
-- 2. 크레딧 추가 원자적 처리
-- =====================================================

CREATE OR REPLACE FUNCTION add_credit_atomic(
    p_user_id UUID,
    p_amount INTEGER,
    p_type VARCHAR(30),
    p_description TEXT,
    p_payment_id UUID DEFAULT NULL,
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
    -- 유효성 검사
    IF p_amount <= 0 THEN
        RETURN QUERY SELECT FALSE, 0, '유효하지 않은 크레딧 양입니다.'::TEXT;
        RETURN;
    END IF;

    -- 타입 검사
    IF p_type NOT IN ('purchase', 'subscription_grant', 'refund', 'admin_adjustment') THEN
        RETURN QUERY SELECT FALSE, 0, '유효하지 않은 트랜잭션 타입입니다.'::TEXT;
        RETURN;
    END IF;

    -- 현재 잔액 조회 (FOR UPDATE로 락)
    SELECT credits_balance INTO v_current_balance
    FROM profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0, '사용자를 찾을 수 없습니다.'::TEXT;
        RETURN;
    END IF;

    v_new_balance := COALESCE(v_current_balance, 0) + p_amount;

    -- 1. 크레딧 트랜잭션 생성
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
        p_type,
        p_amount,
        v_new_balance,
        p_description,
        p_payment_id,
        p_expires_at
    );

    -- 2. 프로필 잔액 업데이트
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

COMMENT ON FUNCTION add_credit_atomic IS '크레딧 추가를 원자적으로 처리 (트랜잭션 생성 + 잔액 업데이트)';
