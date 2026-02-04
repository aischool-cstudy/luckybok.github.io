-- =====================================================
-- 환불 요청 추적 테이블 및 관련 기능
-- 환불 요청 이력 관리, 재시도 로직, 관리자 기능 지원
-- =====================================================

-- =====================================================
-- 1. 환불 요청 테이블
-- =====================================================

CREATE TABLE IF NOT EXISTS refund_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,

    -- 환불 정보
    requested_amount INTEGER NOT NULL,
    approved_amount INTEGER,
    refund_type VARCHAR(20) NOT NULL DEFAULT 'full' CHECK (refund_type IN ('full', 'partial', 'prorated')),

    -- 상태 관리
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',      -- 요청됨, 처리 대기
        'processing',   -- 처리 중 (토스 API 호출 중)
        'completed',    -- 완료
        'failed',       -- 실패 (재시도 가능)
        'rejected',     -- 거절됨 (관리자에 의해)
        'canceled'      -- 취소됨 (사용자에 의해)
    )),

    -- 사유 및 메모
    reason TEXT NOT NULL,
    admin_note TEXT,
    rejection_reason TEXT,

    -- 처리 정보
    processed_by UUID REFERENCES profiles(id),
    processed_at TIMESTAMPTZ,

    -- 재시도 관련
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    last_retry_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,
    last_error TEXT,

    -- 프로레이션 계산 정보
    original_credits INTEGER,
    used_credits INTEGER,
    refundable_credits INTEGER,
    proration_details JSONB,

    -- 토스 응답 저장
    toss_response JSONB,

    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_refund_requests_user_id ON refund_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_payment_id ON refund_requests(payment_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON refund_requests(status);
CREATE INDEX IF NOT EXISTS idx_refund_requests_next_retry ON refund_requests(next_retry_at)
    WHERE status = 'failed' AND retry_count < max_retries;
CREATE INDEX IF NOT EXISTS idx_refund_requests_created_at ON refund_requests(created_at);

-- =====================================================
-- 2. 환불 요청 생성 함수
-- =====================================================

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
    -- 이미 처리 중인 환불 요청이 있는지 확인
    SELECT id INTO v_existing_pending
    FROM refund_requests
    WHERE payment_id = p_payment_id
    AND status IN ('pending', 'processing')
    LIMIT 1;

    IF v_existing_pending IS NOT NULL THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, '이미 처리 중인 환불 요청이 있습니다'::TEXT;
        RETURN;
    END IF;

    -- 환불 요청 생성
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

-- =====================================================
-- 3. 환불 요청 상태 업데이트 함수
-- =====================================================

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
    -- 현재 재시도 횟수 조회
    SELECT retry_count, max_retries INTO v_current_retry, v_max_retries
    FROM refund_requests
    WHERE id = p_request_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, '환불 요청을 찾을 수 없습니다'::TEXT;
        RETURN;
    END IF;

    -- 상태 업데이트
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

-- =====================================================
-- 4. 재시도 대상 환불 요청 조회 함수
-- =====================================================

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

-- =====================================================
-- 5. 사용량 기반 환불 금액 계산 함수
-- =====================================================

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
    -- 결제 정보 조회
    SELECT * INTO v_payment
    FROM payments
    WHERE id = p_payment_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0, 0, 0, 0, 0, 0, FALSE, '결제 정보를 찾을 수 없습니다'::TEXT;
        RETURN;
    END IF;

    -- 결제일로부터 경과 일수 계산
    v_days_since := EXTRACT(DAY FROM (NOW() - v_payment.created_at))::INTEGER;

    -- 크레딧 구매인 경우
    IF v_payment.type = 'credit_purchase' THEN
        v_metadata := v_payment.metadata;
        v_purchased_credits := COALESCE((v_metadata->>'credits')::INTEGER, 0);

        -- 사용한 크레딧 계산 (해당 결제로 충전된 크레딧 중 사용된 양)
        -- credit_transactions에서 해당 payment_id로 추가된 크레딧 이후 사용량 계산
        SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_used_credits
        FROM credit_transactions
        WHERE user_id = p_user_id
        AND type = 'usage'
        AND created_at >= v_payment.created_at;

        -- 환불 가능 크레딧 (최대 구매량까지)
        v_refundable_credits := GREATEST(0, v_purchased_credits - LEAST(v_used_credits, v_purchased_credits));

        -- 환불 가능 금액 (비례 계산)
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

    -- 구독 결제인 경우 (전액 환불 또는 비례 환불)
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

    -- 기타 결제
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

-- =====================================================
-- 6. 관리자용 환불 통계 뷰
-- =====================================================

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

-- =====================================================
-- 7. updated_at 자동 갱신 트리거
-- =====================================================

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

-- =====================================================
-- 8. 코멘트 추가
-- =====================================================

COMMENT ON TABLE refund_requests IS '환불 요청 추적 테이블 - 모든 환불 요청의 이력과 상태 관리';
COMMENT ON COLUMN refund_requests.refund_type IS '환불 유형: full(전액), partial(부분), prorated(사용량 비례)';
COMMENT ON COLUMN refund_requests.status IS '환불 상태: pending, processing, completed, failed, rejected, canceled';
COMMENT ON COLUMN refund_requests.next_retry_at IS '다음 재시도 예정 시각 (지수 백오프)';
COMMENT ON COLUMN refund_requests.proration_details IS '프로레이션 계산 상세 정보 (JSON)';

COMMENT ON FUNCTION create_refund_request IS '환불 요청 생성 (중복 요청 방지 포함)';
COMMENT ON FUNCTION update_refund_request_status IS '환불 요청 상태 업데이트 (재시도 로직 포함)';
COMMENT ON FUNCTION get_pending_refund_retries IS '재시도 대상 환불 요청 조회 (FOR UPDATE SKIP LOCKED)';
COMMENT ON FUNCTION calculate_prorated_refund IS '사용량 기반 환불 금액 계산';

-- =====================================================
-- 9. RLS 정책 설정
-- =====================================================

ALTER TABLE refund_requests ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 환불 요청만 조회 가능
CREATE POLICY "Users can view own refund requests"
    ON refund_requests
    FOR SELECT
    USING (auth.uid() = user_id);

-- 사용자는 자신의 환불 요청만 생성 가능
CREATE POLICY "Users can create own refund requests"
    ON refund_requests
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 관리자는 모든 환불 요청 조회/수정 가능
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

-- 서비스 역할은 모든 작업 가능
CREATE POLICY "Service role can manage refund requests"
    ON refund_requests
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
