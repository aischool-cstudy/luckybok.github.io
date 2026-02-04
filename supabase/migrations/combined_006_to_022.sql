-- =====================================================
-- 통합 마이그레이션 파일: 006 ~ 022
-- Supabase SQL Editor에서 실행하세요
-- =====================================================

-- =====================================================
-- 006_transaction_functions.sql
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
    SELECT credits_balance INTO v_current_balance
    FROM profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0, '사용자를 찾을 수 없습니다'::TEXT;
        RETURN;
    END IF;

    v_new_balance := COALESCE(v_current_balance, 0) + p_credits_to_add;

    UPDATE payments
    SET
        status = 'completed',
        payment_key = p_payment_key,
        method = p_method,
        receipt_url = p_receipt_url,
        paid_at = p_paid_at,
        updated_at = NOW()
    WHERE id = p_payment_id;

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
    v_daily_limit := CASE p_plan
        WHEN 'pro' THEN 100
        WHEN 'team' THEN 500
        WHEN 'enterprise' THEN 999999
        ELSE 10
    END;

    UPDATE payments
    SET
        status = 'completed',
        payment_key = p_payment_key,
        method = p_method,
        receipt_url = p_receipt_url,
        paid_at = p_paid_at,
        updated_at = NOW()
    WHERE id = p_payment_id;

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

    UPDATE payments
    SET metadata = metadata || jsonb_build_object('subscriptionId', v_subscription_id)
    WHERE id = p_payment_id;

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
    UPDATE payments
    SET
        status = 'completed',
        payment_key = p_payment_key,
        method = p_method,
        receipt_url = p_receipt_url,
        paid_at = p_paid_at,
        updated_at = NOW()
    WHERE id = p_payment_id;

    UPDATE subscriptions
    SET
        current_period_start = p_new_period_start,
        current_period_end = p_new_period_end,
        status = 'active',
        updated_at = NOW()
    WHERE id = p_subscription_id;

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
        SELECT credits_balance INTO v_current_balance
        FROM profiles
        WHERE id = p_user_id
        FOR UPDATE;

        UPDATE profiles
        SET
            credits_balance = v_current_balance + 1,
            updated_at = NOW()
        WHERE id = p_user_id;

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

CREATE OR REPLACE FUNCTION reset_daily_generations_safe()
RETURNS TABLE (
    success BOOLEAN,
    updated_count INTEGER,
    error_message TEXT
) AS $$
DECLARE
    v_lock_id BIGINT := 1001;
    v_updated_count INTEGER;
BEGIN
    IF NOT pg_try_advisory_lock(v_lock_id) THEN
        RETURN QUERY SELECT FALSE, 0, '다른 프로세스가 실행 중입니다'::TEXT;
        RETURN;
    END IF;

    BEGIN
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

        PERFORM pg_advisory_unlock(v_lock_id);

        RETURN QUERY SELECT TRUE, v_updated_count, NULL::TEXT;

    EXCEPTION WHEN OTHERS THEN
        PERFORM pg_advisory_unlock(v_lock_id);
        RETURN QUERY SELECT FALSE, 0, SQLERRM::TEXT;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION expire_credits_safe()
RETURNS TABLE (
    success BOOLEAN,
    processed_count INTEGER,
    error_message TEXT
) AS $$
DECLARE
    v_lock_id BIGINT := 1002;
    v_processed_count INTEGER := 0;
    r RECORD;
    v_expired_amount INTEGER;
    v_current_balance INTEGER;
BEGIN
    IF NOT pg_try_advisory_lock(v_lock_id) THEN
        RETURN QUERY SELECT FALSE, 0, '다른 프로세스가 실행 중입니다'::TEXT;
        RETURN;
    END IF;

    BEGIN
        FOR r IN
            SELECT DISTINCT user_id
            FROM credit_transactions
            WHERE expires_at <= NOW()
            AND expires_at > NOW() - INTERVAL '1 day'
            AND type = 'purchase'
            AND amount > 0
        LOOP
            SELECT COALESCE(SUM(amount), 0) INTO v_expired_amount
            FROM credit_transactions
            WHERE user_id = r.user_id
            AND expires_at <= NOW()
            AND type = 'purchase'
            AND amount > 0;

            IF v_expired_amount > 0 THEN
                SELECT credits_balance INTO v_current_balance
                FROM profiles
                WHERE id = r.user_id
                FOR UPDATE;

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

                UPDATE profiles
                SET
                    credits_balance = GREATEST(0, COALESCE(credits_balance, 0) - v_expired_amount),
                    updated_at = NOW()
                WHERE id = r.user_id;

                v_processed_count := v_processed_count + 1;
            END IF;
        END LOOP;

        PERFORM pg_advisory_unlock(v_lock_id);

        RETURN QUERY SELECT TRUE, v_processed_count, NULL::TEXT;

    EXCEPTION WHEN OTHERS THEN
        PERFORM pg_advisory_unlock(v_lock_id);
        RETURN QUERY SELECT FALSE, 0, SQLERRM::TEXT;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
    AND s.current_period_end > NOW() - INTERVAL '1 day'
    ORDER BY s.current_period_end ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE webhook_logs
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'processed', 'failed', 'retrying'));

ALTER TABLE webhook_logs
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

ALTER TABLE webhook_logs
ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status_created ON webhook_logs(status, created_at DESC);

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
    AND w.retry_count < 3
    ORDER BY w.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- =====================================================
-- 007_payment_refund_columns.sql
-- =====================================================

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS refunded_amount INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS refund_reason TEXT,
ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_subscription_id ON payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_refunded_at ON payments(refunded_at) WHERE refunded_at IS NOT NULL;

CREATE OR REPLACE FUNCTION set_refunded_at()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.status IN ('refunded', 'partial_refunded') AND OLD.status NOT IN ('refunded', 'partial_refunded')) THEN
    NEW.refunded_at = COALESCE(NEW.refunded_at, NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_refunded_at ON payments;
CREATE TRIGGER trigger_set_refunded_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION set_refunded_at();

DROP VIEW IF EXISTS payment_stats;
CREATE VIEW payment_stats AS
SELECT
  user_id,
  COUNT(*) FILTER (WHERE status = 'completed') AS total_payments,
  SUM(amount) FILTER (WHERE status = 'completed') AS total_amount,
  COUNT(*) FILTER (WHERE status IN ('refunded', 'partial_refunded')) AS total_refunds,
  SUM(refunded_amount) FILTER (WHERE refunded_amount > 0) AS total_refunded_amount,
  MAX(paid_at) AS last_payment_at,
  MAX(refunded_at) AS last_refund_at
FROM payments
GROUP BY user_id;

-- =====================================================
-- 008_refund_transaction_function.sql
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
    SELECT credits_balance INTO v_current_balance
    FROM profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0, '사용자를 찾을 수 없습니다'::TEXT;
        RETURN;
    END IF;

    v_new_balance := GREATEST(0, COALESCE(v_current_balance, 0) - p_credits_to_deduct);

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

    UPDATE subscriptions
    SET
        status = 'canceled',
        canceled_at = v_now,
        updated_at = v_now
    WHERE id = p_subscription_id;

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

-- =====================================================
-- 009_index_optimization.sql
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_profiles_plan ON profiles(plan);
CREATE INDEX IF NOT EXISTS idx_profiles_daily_reset ON profiles(daily_reset_at) WHERE daily_reset_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_plan_expires ON profiles(plan_expires_at) WHERE plan_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_team_id ON profiles(team_id) WHERE team_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_generated_contents_difficulty ON generated_contents(difficulty);
CREATE INDEX IF NOT EXISTS idx_generated_contents_target ON generated_contents(target_audience);
CREATE INDEX IF NOT EXISTS idx_generated_contents_user_lang_created ON generated_contents(user_id, language, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_contents_user_diff_created ON generated_contents(user_id, difficulty, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_payment_id ON credit_transactions(payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_type_created ON credit_transactions(user_id, type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_pending_expiry ON credit_transactions(expires_at, user_id) WHERE expires_at IS NOT NULL AND type = 'purchase' AND amount > 0;

CREATE INDEX IF NOT EXISTS idx_subscriptions_billing_key_id ON subscriptions(billing_key_id) WHERE billing_key_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_renewal_due ON subscriptions(current_period_end, status, billing_key_id) WHERE status = 'active' AND cancel_at_period_end = FALSE;

CREATE INDEX IF NOT EXISTS idx_payments_type ON payments(type);
CREATE INDEX IF NOT EXISTS idx_payments_user_type_created ON payments(user_id, type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_refundable ON payments(user_id, status, paid_at DESC) WHERE status = 'completed';
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at DESC) WHERE paid_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_logs_processed_at ON webhook_logs(processed_at DESC) WHERE processed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_logs_retry_candidates ON webhook_logs(retry_count, created_at) WHERE status = 'failed' AND retry_count < 3;

CREATE INDEX IF NOT EXISTS idx_team_invitations_expires ON team_invitations(expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_team_invitations_team_pending ON team_invitations(team_id, status, created_at DESC) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_team_api_usage_team_created ON team_api_usage(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_api_usage_key_created ON team_api_usage(api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_api_usage_status_code ON team_api_usage(status_code) WHERE status_code >= 400;

CREATE INDEX IF NOT EXISTS idx_team_api_keys_team_active ON team_api_keys(team_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_team_api_keys_expires ON team_api_keys(expires_at) WHERE expires_at IS NOT NULL AND is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_teams_active ON teams(is_active, created_at DESC) WHERE is_active = TRUE;

-- =====================================================
-- 010_webhook_idempotency.sql
-- =====================================================

ALTER TABLE webhook_logs
ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_logs_idempotency_key
    ON webhook_logs(idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_idempotency
    ON webhook_logs(event_type, idempotency_key);

UPDATE webhook_logs
SET status = CASE
    WHEN processed_at IS NOT NULL AND error IS NULL THEN 'processed'
    WHEN error IS NOT NULL THEN 'failed'
    ELSE 'pending'
END
WHERE status IS NULL OR status = 'pending';

-- =====================================================
-- 011_credit_atomic_functions.sql
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
    IF p_amount <= 0 THEN
        RETURN QUERY SELECT FALSE, 0, '유효하지 않은 크레딧 양입니다.'::TEXT;
        RETURN;
    END IF;

    SELECT credits_balance INTO v_current_balance
    FROM profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0, '사용자를 찾을 수 없습니다.'::TEXT;
        RETURN;
    END IF;

    IF COALESCE(v_current_balance, 0) < p_amount THEN
        RETURN QUERY SELECT FALSE, COALESCE(v_current_balance, 0), '크레딧이 부족합니다.'::TEXT;
        RETURN;
    END IF;

    v_new_balance := v_current_balance - p_amount;

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
    IF p_amount <= 0 THEN
        RETURN QUERY SELECT FALSE, 0, '유효하지 않은 크레딧 양입니다.'::TEXT;
        RETURN;
    END IF;

    IF p_type NOT IN ('purchase', 'subscription_grant', 'refund', 'admin_adjustment') THEN
        RETURN QUERY SELECT FALSE, 0, '유효하지 않은 트랜잭션 타입입니다.'::TEXT;
        RETURN;
    END IF;

    SELECT credits_balance INTO v_current_balance
    FROM profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0, '사용자를 찾을 수 없습니다.'::TEXT;
        RETURN;
    END IF;

    v_new_balance := COALESCE(v_current_balance, 0) + p_amount;

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

-- =====================================================
-- 012_plan_change_functions.sql
-- =====================================================

ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS scheduled_plan VARCHAR(20)
    CHECK (scheduled_plan IS NULL OR scheduled_plan IN ('pro', 'team', 'enterprise'));

ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS scheduled_billing_cycle VARCHAR(10)
    CHECK (scheduled_billing_cycle IS NULL OR scheduled_billing_cycle IN ('monthly', 'yearly'));

ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS scheduled_change_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_subscriptions_scheduled_change
    ON subscriptions(scheduled_change_at)
    WHERE scheduled_change_at IS NOT NULL;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_type_check;
ALTER TABLE payments ADD CONSTRAINT payments_type_check
    CHECK (type IN ('subscription', 'credit_purchase', 'plan_change'));

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
    SELECT user_id INTO v_user_id
    FROM subscriptions
    WHERE id = p_subscription_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, '구독을 찾을 수 없습니다'::TEXT;
        RETURN;
    END IF;

    v_daily_limit := CASE p_new_plan
        WHEN 'pro' THEN 100
        WHEN 'team' THEN 500
        WHEN 'enterprise' THEN 999999
        ELSE 10
    END;

    UPDATE payments
    SET
        status = 'completed',
        payment_key = p_payment_key,
        method = p_method,
        receipt_url = p_receipt_url,
        paid_at = p_paid_at,
        updated_at = NOW()
    WHERE id = p_payment_id;

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
    SELECT current_period_end, plan INTO v_current_period_end, v_current_plan
    FROM subscriptions
    WHERE id = p_subscription_id
    AND status = 'active'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::TIMESTAMP WITH TIME ZONE, '활성 구독을 찾을 수 없습니다'::TEXT;
        RETURN;
    END IF;

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

CREATE OR REPLACE FUNCTION apply_scheduled_plan_changes()
RETURNS TABLE (
    success BOOLEAN,
    processed_count INTEGER,
    error_message TEXT
) AS $$
DECLARE
    v_lock_id BIGINT := 1003;
    v_processed_count INTEGER := 0;
    v_subscription RECORD;
    v_daily_limit INTEGER;
BEGIN
    IF NOT pg_try_advisory_lock(v_lock_id) THEN
        RETURN QUERY SELECT FALSE, 0, '다른 프로세스가 실행 중입니다'::TEXT;
        RETURN;
    END IF;

    BEGIN
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
            v_daily_limit := CASE v_subscription.scheduled_plan
                WHEN 'pro' THEN 100
                WHEN 'team' THEN 500
                WHEN 'enterprise' THEN 999999
                ELSE 10
            END;

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

            UPDATE profiles
            SET
                plan = v_subscription.scheduled_plan,
                daily_generations_remaining = v_daily_limit,
                updated_at = NOW()
            WHERE id = v_subscription.user_id;

            v_processed_count := v_processed_count + 1;
        END LOOP;

        PERFORM pg_advisory_unlock(v_lock_id);

        RETURN QUERY SELECT TRUE, v_processed_count, NULL::TEXT;

    EXCEPTION WHEN OTHERS THEN
        PERFORM pg_advisory_unlock(v_lock_id);
        RETURN QUERY SELECT FALSE, 0, SQLERRM::TEXT;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- =====================================================
-- 013_payment_stats_function.sql
-- =====================================================

CREATE OR REPLACE FUNCTION get_payment_stats(
    p_user_id UUID
)
RETURNS TABLE (
    total_amount BIGINT,
    refunded_amount BIGINT,
    this_month_amount BIGINT,
    completed_count INTEGER,
    refunded_count INTEGER
) AS $$
DECLARE
    v_this_month_start TIMESTAMP WITH TIME ZONE;
BEGIN
    v_this_month_start := date_trunc('month', NOW());

    RETURN QUERY
    SELECT
        COALESCE(SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END), 0)::BIGINT AS total_amount,
        COALESCE(SUM(p.refunded_amount), 0)::BIGINT AS refunded_amount,
        COALESCE(SUM(CASE
            WHEN p.status = 'completed' AND p.created_at >= v_this_month_start
            THEN p.amount ELSE 0
        END), 0)::BIGINT AS this_month_amount,
        COALESCE(COUNT(CASE WHEN p.status = 'completed' THEN 1 END), 0)::INTEGER AS completed_count,
        COALESCE(COUNT(CASE WHEN p.status IN ('refunded', 'partial_refunded') THEN 1 END), 0)::INTEGER AS refunded_count
    FROM payments p
    WHERE p.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 014_refund_request_tracking.sql
-- =====================================================

CREATE TABLE IF NOT EXISTS refund_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    requested_amount INTEGER NOT NULL,
    approved_amount INTEGER,
    refund_type VARCHAR(20) NOT NULL DEFAULT 'full' CHECK (refund_type IN ('full', 'partial', 'prorated')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'completed', 'failed', 'rejected', 'canceled'
    )),
    reason TEXT NOT NULL,
    admin_note TEXT,
    rejection_reason TEXT,
    processed_by UUID REFERENCES profiles(id),
    processed_at TIMESTAMPTZ,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    last_retry_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,
    last_error TEXT,
    original_credits INTEGER,
    used_credits INTEGER,
    refundable_credits INTEGER,
    proration_details JSONB,
    toss_response JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refund_requests_user_id ON refund_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_payment_id ON refund_requests(payment_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON refund_requests(status);
CREATE INDEX IF NOT EXISTS idx_refund_requests_next_retry ON refund_requests(next_retry_at)
    WHERE status = 'failed' AND retry_count < max_retries;
CREATE INDEX IF NOT EXISTS idx_refund_requests_created_at ON refund_requests(created_at);

CREATE OR REPLACE FUNCTION create_refund_request(
    p_payment_id UUID,
    p_user_id UUID,
    p_requested_amount INTEGER,
    p_refund_type VARCHAR(20),
    p_reason TEXT,
    p_original_credits INTEGER DEFAULT NULL,
    p_used_credits INTEGER DEFAULT NULL,
    p_refundable_credits INTEGER DEFAULT NULL,
    p_proration_details JSONB DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    request_id UUID,
    error_message TEXT
) AS $$
DECLARE
    v_request_id UUID;
    v_existing_pending UUID;
BEGIN
    SELECT id INTO v_existing_pending
    FROM refund_requests
    WHERE payment_id = p_payment_id
    AND status IN ('pending', 'processing')
    LIMIT 1;

    IF v_existing_pending IS NOT NULL THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, '이미 처리 중인 환불 요청이 있습니다'::TEXT;
        RETURN;
    END IF;

    INSERT INTO refund_requests (
        payment_id,
        user_id,
        requested_amount,
        refund_type,
        reason,
        original_credits,
        used_credits,
        refundable_credits,
        proration_details
    ) VALUES (
        p_payment_id,
        p_user_id,
        p_requested_amount,
        p_refund_type,
        p_reason,
        p_original_credits,
        p_used_credits,
        p_refundable_credits,
        p_proration_details
    )
    RETURNING id INTO v_request_id;

    RETURN QUERY SELECT TRUE, v_request_id, NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_refund_request_status(
    p_request_id UUID,
    p_status VARCHAR(20),
    p_approved_amount INTEGER DEFAULT NULL,
    p_processed_by UUID DEFAULT NULL,
    p_admin_note TEXT DEFAULT NULL,
    p_rejection_reason TEXT DEFAULT NULL,
    p_toss_response JSONB DEFAULT NULL,
    p_error TEXT DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW();
    v_current_retry INTEGER;
    v_max_retries INTEGER;
BEGIN
    SELECT retry_count, max_retries INTO v_current_retry, v_max_retries
    FROM refund_requests
    WHERE id = p_request_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, '환불 요청을 찾을 수 없습니다'::TEXT;
        RETURN;
    END IF;

    UPDATE refund_requests
    SET
        status = p_status,
        approved_amount = COALESCE(p_approved_amount, approved_amount),
        processed_by = COALESCE(p_processed_by, processed_by),
        processed_at = CASE WHEN p_status IN ('completed', 'rejected') THEN v_now ELSE processed_at END,
        admin_note = COALESCE(p_admin_note, admin_note),
        rejection_reason = COALESCE(p_rejection_reason, rejection_reason),
        toss_response = COALESCE(p_toss_response, toss_response),
        last_error = COALESCE(p_error, last_error),
        retry_count = CASE WHEN p_status = 'failed' THEN v_current_retry + 1 ELSE retry_count END,
        last_retry_at = CASE WHEN p_status = 'failed' THEN v_now ELSE last_retry_at END,
        next_retry_at = CASE
            WHEN p_status = 'failed' AND v_current_retry + 1 < v_max_retries
            THEN v_now + (POWER(2, v_current_retry + 1) * INTERVAL '1 minute')
            ELSE NULL
        END,
        updated_at = v_now
    WHERE id = p_request_id;

    RETURN QUERY SELECT TRUE, NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_pending_refund_retries()
RETURNS TABLE (
    request_id UUID,
    payment_id UUID,
    user_id UUID,
    requested_amount INTEGER,
    refund_type VARCHAR(20),
    reason TEXT,
    retry_count INTEGER,
    payment_key TEXT,
    order_id TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        rr.id AS request_id,
        rr.payment_id,
        rr.user_id,
        rr.requested_amount,
        rr.refund_type,
        rr.reason,
        rr.retry_count,
        p.payment_key,
        p.order_id
    FROM refund_requests rr
    JOIN payments p ON rr.payment_id = p.id
    WHERE rr.status = 'failed'
    AND rr.retry_count < rr.max_retries
    AND rr.next_retry_at <= NOW()
    ORDER BY rr.next_retry_at ASC
    LIMIT 10
    FOR UPDATE OF rr SKIP LOCKED;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION calculate_prorated_refund(
    p_payment_id UUID,
    p_user_id UUID
)
RETURNS TABLE (
    success BOOLEAN,
    original_amount INTEGER,
    refundable_amount INTEGER,
    original_credits INTEGER,
    used_credits INTEGER,
    refundable_credits INTEGER,
    days_since_purchase INTEGER,
    is_within_refund_period BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    v_payment RECORD;
    v_metadata JSONB;
    v_purchased_credits INTEGER;
    v_used_credits INTEGER;
    v_refundable_credits INTEGER;
    v_refundable_amount INTEGER;
    v_days_since INTEGER;
BEGIN
    SELECT * INTO v_payment
    FROM payments
    WHERE id = p_payment_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0, 0, 0, 0, 0, 0, FALSE, '결제 정보를 찾을 수 없습니다'::TEXT;
        RETURN;
    END IF;

    v_days_since := EXTRACT(DAY FROM (NOW() - v_payment.created_at))::INTEGER;

    IF v_payment.type = 'credit_purchase' THEN
        v_metadata := v_payment.metadata;
        v_purchased_credits := COALESCE((v_metadata->>'credits')::INTEGER, 0);

        SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_used_credits
        FROM credit_transactions
        WHERE user_id = p_user_id
        AND type = 'usage'
        AND created_at >= v_payment.created_at;

        v_refundable_credits := GREATEST(0, v_purchased_credits - LEAST(v_used_credits, v_purchased_credits));

        IF v_purchased_credits > 0 THEN
            v_refundable_amount := (v_payment.amount * v_refundable_credits / v_purchased_credits);
        ELSE
            v_refundable_amount := 0;
        END IF;

        RETURN QUERY SELECT
            TRUE,
            v_payment.amount,
            v_refundable_amount,
            v_purchased_credits,
            LEAST(v_used_credits, v_purchased_credits),
            v_refundable_credits,
            v_days_since,
            v_days_since <= 7;
        RETURN;
    END IF;

    IF v_payment.type = 'subscription' THEN
        RETURN QUERY SELECT
            TRUE,
            v_payment.amount,
            v_payment.amount - COALESCE(v_payment.refunded_amount, 0),
            0,
            0,
            0,
            v_days_since,
            v_days_since <= 7;
        RETURN;
    END IF;

    RETURN QUERY SELECT
        TRUE,
        v_payment.amount,
        v_payment.amount - COALESCE(v_payment.refunded_amount, 0),
        0,
        0,
        0,
        v_days_since,
        v_days_since <= 7;

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, 0, 0, 0, 0, 0, 0, FALSE, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE VIEW admin_refund_stats AS
SELECT
    DATE_TRUNC('day', rr.created_at) AS date,
    COUNT(*) AS total_requests,
    COUNT(*) FILTER (WHERE rr.status = 'completed') AS completed_count,
    COUNT(*) FILTER (WHERE rr.status = 'pending') AS pending_count,
    COUNT(*) FILTER (WHERE rr.status = 'failed') AS failed_count,
    COUNT(*) FILTER (WHERE rr.status = 'rejected') AS rejected_count,
    SUM(rr.approved_amount) FILTER (WHERE rr.status = 'completed') AS total_refunded_amount,
    AVG(EXTRACT(EPOCH FROM (rr.processed_at - rr.created_at))/60) FILTER (WHERE rr.status = 'completed') AS avg_processing_minutes
FROM refund_requests rr
GROUP BY DATE_TRUNC('day', rr.created_at)
ORDER BY date DESC;

CREATE OR REPLACE FUNCTION update_refund_request_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_refund_request_updated_at ON refund_requests;
CREATE TRIGGER trigger_update_refund_request_updated_at
    BEFORE UPDATE ON refund_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_refund_request_updated_at();

ALTER TABLE refund_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own refund requests" ON refund_requests;
CREATE POLICY "Users can view own refund requests"
    ON refund_requests
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own refund requests" ON refund_requests;
CREATE POLICY "Users can create own refund requests"
    ON refund_requests
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all refund requests" ON refund_requests;
CREATE POLICY "Admins can manage all refund requests"
    ON refund_requests
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

DROP POLICY IF EXISTS "Service role can manage refund requests" ON refund_requests;
CREATE POLICY "Service role can manage refund requests"
    ON refund_requests
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- 015_admin_role.sql
-- =====================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role) WHERE role != 'user';

CREATE OR REPLACE FUNCTION is_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = p_user_id
        AND role IN ('admin', 'super_admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 016_learning_onboarding.sql
-- =====================================================

CREATE TABLE IF NOT EXISTS learner_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  experience_level TEXT CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
  learning_goals TEXT[] DEFAULT '{}',
  preferred_languages TEXT[] DEFAULT '{}',
  weekly_time_commitment INTEGER DEFAULT 5 CHECK (weekly_time_commitment >= 1 AND weekly_time_commitment <= 40),
  onboarding_completed BOOLEAN DEFAULT FALSE,
  onboarding_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learner_profiles_user_id ON learner_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_learner_profiles_onboarding_completed ON learner_profiles(onboarding_completed) WHERE NOT onboarding_completed;

CREATE TABLE IF NOT EXISTS level_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('python', 'javascript', 'sql', 'java', 'typescript', 'go')),
  score INTEGER NOT NULL CHECK (score >= 0),
  total_questions INTEGER NOT NULL CHECK (total_questions > 0),
  determined_level TEXT NOT NULL CHECK (determined_level IN ('beginner', 'intermediate', 'advanced')),
  time_taken_seconds INTEGER CHECK (time_taken_seconds >= 0),
  answers JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_level_tests_user_id ON level_tests(user_id);
CREATE INDEX IF NOT EXISTS idx_level_tests_user_language ON level_tests(user_id, language);
CREATE INDEX IF NOT EXISTS idx_level_tests_created_at ON level_tests(created_at DESC);

CREATE TABLE IF NOT EXISTS level_test_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language TEXT NOT NULL CHECK (language IN ('python', 'javascript', 'sql', 'java', 'typescript', 'go')),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  question TEXT NOT NULL,
  code_snippet TEXT,
  options JSONB NOT NULL,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  topic TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_level_test_questions_language ON level_test_questions(language);
CREATE INDEX IF NOT EXISTS idx_level_test_questions_language_difficulty ON level_test_questions(language, difficulty);
CREATE INDEX IF NOT EXISTS idx_level_test_questions_active ON level_test_questions(is_active) WHERE is_active;

ALTER TABLE learner_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE level_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE level_test_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own learner profile" ON learner_profiles;
CREATE POLICY "Users can view own learner profile"
  ON learner_profiles FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own learner profile" ON learner_profiles;
CREATE POLICY "Users can insert own learner profile"
  ON learner_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own learner profile" ON learner_profiles;
CREATE POLICY "Users can update own learner profile"
  ON learner_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own level tests" ON level_tests;
CREATE POLICY "Users can view own level tests"
  ON level_tests FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own level tests" ON level_tests;
CREATE POLICY "Users can insert own level tests"
  ON level_tests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can view active questions" ON level_test_questions;
CREATE POLICY "Authenticated users can view active questions"
  ON level_test_questions FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = TRUE);

DROP POLICY IF EXISTS "Admins can manage questions" ON level_test_questions;
CREATE POLICY "Admins can manage questions"
  ON level_test_questions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE OR REPLACE FUNCTION update_learner_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_learner_profiles_updated_at ON learner_profiles;
CREATE TRIGGER trigger_learner_profiles_updated_at
  BEFORE UPDATE ON learner_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_learner_profile_updated_at();

CREATE OR REPLACE FUNCTION update_level_test_question_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_level_test_questions_updated_at ON level_test_questions;
CREATE TRIGGER trigger_level_test_questions_updated_at
  BEFORE UPDATE ON level_test_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_level_test_question_updated_at();

CREATE OR REPLACE FUNCTION determine_level(
  p_score INTEGER,
  p_total_questions INTEGER
)
RETURNS TEXT AS $$
DECLARE
  v_percentage DECIMAL(5,2);
BEGIN
  IF p_total_questions = 0 THEN
    RETURN 'beginner';
  END IF;

  v_percentage := (p_score::DECIMAL / p_total_questions) * 100;

  IF v_percentage >= 80 THEN
    RETURN 'advanced';
  ELSIF v_percentage >= 50 THEN
    RETURN 'intermediate';
  ELSE
    RETURN 'beginner';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION submit_level_test(
  p_user_id UUID,
  p_language TEXT,
  p_answers JSONB,
  p_time_taken_seconds INTEGER DEFAULT NULL
)
RETURNS TABLE (
  test_id UUID,
  score INTEGER,
  total_questions INTEGER,
  determined_level TEXT,
  percentage DECIMAL(5,2)
) AS $$
DECLARE
  v_test_id UUID;
  v_score INTEGER := 0;
  v_total INTEGER := 0;
  v_level TEXT;
  v_answer RECORD;
  v_correct_answer TEXT;
BEGIN
  FOR v_answer IN SELECT * FROM jsonb_to_recordset(p_answers) AS x(question_id UUID, selected_answer TEXT)
  LOOP
    SELECT ltq.correct_answer INTO v_correct_answer
    FROM level_test_questions ltq
    WHERE ltq.id = v_answer.question_id;

    IF FOUND THEN
      v_total := v_total + 1;
      IF v_correct_answer = v_answer.selected_answer THEN
        v_score := v_score + 1;
      END IF;
    END IF;
  END LOOP;

  v_level := determine_level(v_score, v_total);

  INSERT INTO level_tests (user_id, language, score, total_questions, determined_level, time_taken_seconds, answers)
  VALUES (p_user_id, p_language, v_score, v_total, v_level, p_time_taken_seconds, p_answers)
  RETURNING id INTO v_test_id;

  RETURN QUERY SELECT
    v_test_id,
    v_score,
    v_total,
    v_level,
    CASE WHEN v_total > 0 THEN (v_score::DECIMAL / v_total) * 100 ELSE 0.00 END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_level_by_language(
  p_user_id UUID,
  p_language TEXT
)
RETURNS TABLE (
  determined_level TEXT,
  score INTEGER,
  total_questions INTEGER,
  tested_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT lt.determined_level, lt.score, lt.total_questions, lt.created_at
  FROM level_tests lt
  WHERE lt.user_id = p_user_id AND lt.language = p_language
  ORDER BY lt.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION complete_onboarding(
  p_user_id UUID,
  p_experience_level TEXT,
  p_learning_goals TEXT[],
  p_preferred_languages TEXT[],
  p_weekly_time_commitment INTEGER DEFAULT 5
)
RETURNS TABLE (
  success BOOLEAN,
  profile_id UUID,
  error_message TEXT
) AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  INSERT INTO learner_profiles (
    user_id,
    experience_level,
    learning_goals,
    preferred_languages,
    weekly_time_commitment,
    onboarding_completed,
    onboarding_completed_at
  )
  VALUES (
    p_user_id,
    p_experience_level,
    p_learning_goals,
    p_preferred_languages,
    p_weekly_time_commitment,
    TRUE,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    experience_level = EXCLUDED.experience_level,
    learning_goals = EXCLUDED.learning_goals,
    preferred_languages = EXCLUDED.preferred_languages,
    weekly_time_commitment = EXCLUDED.weekly_time_commitment,
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

CREATE OR REPLACE FUNCTION get_level_test_questions(
  p_language TEXT,
  p_questions_per_level INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  difficulty TEXT,
  question TEXT,
  code_snippet TEXT,
  options JSONB,
  topic TEXT,
  order_index INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH ranked_questions AS (
    SELECT
      ltq.id,
      ltq.difficulty,
      ltq.question,
      ltq.code_snippet,
      ltq.options,
      ltq.topic,
      ltq.order_index,
      ROW_NUMBER() OVER (PARTITION BY ltq.difficulty ORDER BY RANDOM()) as rn
    FROM level_test_questions ltq
    WHERE ltq.language = p_language AND ltq.is_active = TRUE
  )
  SELECT
    rq.id,
    rq.difficulty,
    rq.question,
    rq.code_snippet,
    rq.options,
    rq.topic,
    rq.order_index
  FROM ranked_questions rq
  WHERE rq.rn <= p_questions_per_level
  ORDER BY
    CASE rq.difficulty
      WHEN 'beginner' THEN 1
      WHEN 'intermediate' THEN 2
      WHEN 'advanced' THEN 3
    END,
    rq.order_index,
    RANDOM();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Python/JavaScript 기본 문제는 이미 있으면 스킵
INSERT INTO level_test_questions (language, difficulty, question, code_snippet, options, correct_answer, explanation, topic, order_index)
SELECT 'python', 'beginner', '다음 코드의 출력 결과는 무엇인가요?', 'print(type(42))',
  '["<class ''int''>", "<class ''str''>", "<class ''float''>", "42"]',
  '<class ''int''>', '42는 정수(int)이므로 type() 함수는 <class ''int''>를 반환합니다.', 'data_types', 1
WHERE NOT EXISTS (SELECT 1 FROM level_test_questions WHERE language = 'python' AND topic = 'data_types' AND order_index = 1);

-- =====================================================
-- 017 - 022는 파일 크기 제한으로 별도 실행 필요
-- 나머지 마이그레이션은 개별 파일로 실행하세요:
-- - 017_content_bookmarks.sql
-- - 018_content_feedback.sql
-- - 019_learning_progress.sql
-- - 020_webhook_atomic_upsert.sql
-- - 021_deduct_credit_refund_atomic.sql
-- - 022_notifications.sql
-- =====================================================
