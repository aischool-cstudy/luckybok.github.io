-- =====================================================
-- 결제 통계 집계 RPC 함수
-- 모든 결제 내역을 JS로 가져오지 않고 DB 레벨에서 집계
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
    -- 이번 달 시작일 계산
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

COMMENT ON FUNCTION get_payment_stats IS '사용자의 결제 통계를 DB 레벨에서 집계하여 반환';
