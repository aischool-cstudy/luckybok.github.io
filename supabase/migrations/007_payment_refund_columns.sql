-- ─────────────────────────────────────────────────────────
-- 007_payment_refund_columns.sql
-- 결제 테이블에 환불 관련 컬럼 추가
-- ─────────────────────────────────────────────────────────

-- payments 테이블에 환불 관련 컬럼 추가
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS refunded_amount INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS refund_reason TEXT,
ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_payments_subscription_id ON payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_refunded_at ON payments(refunded_at) WHERE refunded_at IS NOT NULL;

-- 환불 상태 변경 시 자동으로 refunded_at 설정하는 트리거
CREATE OR REPLACE FUNCTION set_refunded_at()
RETURNS TRIGGER AS $$
BEGIN
  -- 상태가 refunded 또는 partial_refunded로 변경될 때
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

-- 환불 통계 뷰 업데이트
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

-- 코멘트 추가
COMMENT ON COLUMN payments.refunded_amount IS '환불된 금액 (원)';
COMMENT ON COLUMN payments.refunded_at IS '환불 처리 시각';
COMMENT ON COLUMN payments.refund_reason IS '환불 사유';
COMMENT ON COLUMN payments.subscription_id IS '관련 구독 ID (구독 결제인 경우)';
