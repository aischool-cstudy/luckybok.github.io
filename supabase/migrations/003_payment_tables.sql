-- =====================================================
-- 결제 시스템 테이블 생성
-- 토스페이먼츠 연동용
-- =====================================================

-- =====================================================
-- 1. profiles 테이블 확장
-- =====================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS credits_balance INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS customer_key UUID DEFAULT gen_random_uuid();

-- customer_key 인덱스 (토스페이먼츠 고객 식별자)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_customer_key ON profiles(customer_key);

-- =====================================================
-- 2. subscriptions 테이블 (정기구독)
-- =====================================================

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- 구독 정보
    plan VARCHAR(20) NOT NULL CHECK (plan IN ('pro', 'team', 'enterprise')),
    billing_cycle VARCHAR(10) NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'paused')),

    -- 기간 정보
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,

    -- 취소 관련
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    canceled_at TIMESTAMP WITH TIME ZONE,

    -- 빌링키 참조
    billing_key_id UUID,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON subscriptions(current_period_end);

-- RLS 활성화
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS 정책
CREATE POLICY "Users can view own subscriptions"
    ON subscriptions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscriptions"
    ON subscriptions FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- updated_at 트리거
CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 3. payments 테이블 (결제 이력)
-- =====================================================

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- 주문 정보
    order_id VARCHAR(100) UNIQUE NOT NULL,
    payment_key VARCHAR(200),

    -- 결제 유형 및 상태
    type VARCHAR(20) NOT NULL CHECK (type IN ('subscription', 'credit_purchase')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'failed', 'canceled', 'refunded', 'partial_refunded')),

    -- 금액 정보
    amount INTEGER NOT NULL,

    -- 결제 수단
    method VARCHAR(50),
    receipt_url TEXT,

    -- 메타데이터 (플랜, 크레딧 등)
    metadata JSONB DEFAULT '{}',

    -- 실패 정보
    failure_code VARCHAR(50),
    failure_reason TEXT,

    -- 시간 정보
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_key ON payments(payment_key);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

-- RLS 활성화
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- RLS 정책
CREATE POLICY "Users can view own payments"
    ON payments FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage payments"
    ON payments FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- updated_at 트리거
CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 4. billing_keys 테이블 (빌링키, AES-256 암호화)
-- =====================================================

CREATE TABLE IF NOT EXISTS billing_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- 토스페이먼츠 정보
    customer_key VARCHAR(100) NOT NULL,
    encrypted_billing_key TEXT NOT NULL, -- AES-256 암호화

    -- 카드 정보 (마스킹된 정보만 저장)
    card_company VARCHAR(50) NOT NULL,
    card_number VARCHAR(20) NOT NULL, -- 마스킹된 번호 (예: **** **** **** 1234)
    card_type VARCHAR(20),

    -- 기본 결제 수단 여부
    is_default BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_billing_keys_user_id ON billing_keys(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_keys_customer_key ON billing_keys(customer_key);

-- 사용자당 기본 결제 수단은 하나만 존재
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_keys_default
    ON billing_keys(user_id)
    WHERE is_default = TRUE;

-- RLS 활성화
ALTER TABLE billing_keys ENABLE ROW LEVEL SECURITY;

-- RLS 정책 (암호화된 빌링키는 서비스 롤만 접근)
CREATE POLICY "Users can view own billing keys metadata"
    ON billing_keys FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage billing keys"
    ON billing_keys FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- updated_at 트리거
CREATE TRIGGER update_billing_keys_updated_at
    BEFORE UPDATE ON billing_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 5. credit_transactions 테이블 (크레딧 거래 내역)
-- =====================================================

CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- 거래 유형
    type VARCHAR(30) NOT NULL
        CHECK (type IN ('purchase', 'subscription_grant', 'usage', 'refund', 'expiry', 'admin_adjustment')),

    -- 금액 (양수: 충전, 음수: 사용)
    amount INTEGER NOT NULL,

    -- 거래 후 잔액
    balance INTEGER NOT NULL,

    -- 설명
    description TEXT,

    -- 관련 결제 ID
    payment_id UUID REFERENCES payments(id),

    -- 만료일 (구매 크레딧의 경우)
    expires_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_expires_at ON credit_transactions(expires_at);

-- RLS 활성화
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- RLS 정책
CREATE POLICY "Users can view own credit transactions"
    ON credit_transactions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage credit transactions"
    ON credit_transactions FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- 6. webhook_logs 테이블 (웹훅 로그)
-- =====================================================

CREATE TABLE IF NOT EXISTS webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 이벤트 정보
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,

    -- 처리 정보
    processed_at TIMESTAMP WITH TIME ZONE,
    error TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_type ON webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at DESC);

-- RLS 활성화 (관리자만 접근)
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage webhook logs"
    ON webhook_logs FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- 7. 헬퍼 함수들
-- =====================================================

-- 크레딧 잔액 업데이트 함수
CREATE OR REPLACE FUNCTION update_credits_balance()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE profiles
    SET credits_balance = NEW.balance
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER after_credit_transaction
    AFTER INSERT ON credit_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_credits_balance();

-- 구독 상태 변경 시 플랜 업데이트 함수
CREATE OR REPLACE FUNCTION sync_profile_plan()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'active' THEN
        UPDATE profiles
        SET
            plan = NEW.plan,
            plan_expires_at = NEW.current_period_end
        WHERE id = NEW.user_id;
    ELSIF NEW.status IN ('canceled', 'past_due') AND NEW.current_period_end < NOW() THEN
        UPDATE profiles
        SET
            plan = 'starter',
            plan_expires_at = NULL
        WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER after_subscription_change
    AFTER INSERT OR UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION sync_profile_plan();

-- 만료된 크레딧 정리 함수 (cron job으로 실행)
CREATE OR REPLACE FUNCTION expire_credits()
RETURNS void AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT DISTINCT user_id
        FROM credit_transactions
        WHERE expires_at < NOW()
        AND type = 'purchase'
    LOOP
        -- 만료 트랜잭션 생성
        INSERT INTO credit_transactions (user_id, type, amount, balance, description)
        SELECT
            r.user_id,
            'expiry',
            -SUM(amount),
            (SELECT credits_balance FROM profiles WHERE id = r.user_id) - SUM(amount),
            '크레딧 만료'
        FROM credit_transactions
        WHERE user_id = r.user_id
        AND expires_at < NOW()
        AND type = 'purchase';
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. 주문 ID 생성 함수
-- =====================================================

CREATE OR REPLACE FUNCTION generate_order_id(prefix VARCHAR DEFAULT 'ORD')
RETURNS VARCHAR AS $$
DECLARE
    timestamp_part VARCHAR;
    random_part VARCHAR;
BEGIN
    timestamp_part := TO_CHAR(NOW(), 'YYYYMMDDHH24MISS');
    random_part := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
    RETURN prefix || '_' || timestamp_part || '_' || random_part;
END;
$$ LANGUAGE plpgsql;
