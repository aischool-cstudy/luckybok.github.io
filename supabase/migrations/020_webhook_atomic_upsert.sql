-- =====================================================
-- 웹훅 원자적 upsert 함수
-- Issue: Race condition between SELECT and INSERT
-- Solution: Atomic INSERT ON CONFLICT handling
-- =====================================================

-- 웹훅 로그 원자적 upsert 함수
-- 반환값:
--   action: 'created' | 'already_processed' | 'reprocessing'
--   log_id: 웹훅 로그 ID
CREATE OR REPLACE FUNCTION upsert_webhook_log_atomic(
    p_idempotency_key VARCHAR(128),
    p_event_type VARCHAR(50),
    p_payload JSONB
) RETURNS TABLE (
    action TEXT,
    log_id UUID,
    existing_status TEXT
) LANGUAGE plpgsql AS $$
DECLARE
    v_existing_id UUID;
    v_existing_status TEXT;
    v_new_id UUID;
BEGIN
    -- 1. 먼저 INSERT 시도 (원자적)
    INSERT INTO webhook_logs (
        idempotency_key,
        event_type,
        payload,
        status,
        created_at
    )
    VALUES (
        p_idempotency_key,
        p_event_type,
        p_payload,
        'pending',
        NOW()
    )
    ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL
    DO NOTHING
    RETURNING id INTO v_new_id;

    -- 2. INSERT 성공 (새로 생성됨)
    IF v_new_id IS NOT NULL THEN
        RETURN QUERY SELECT
            'created'::TEXT,
            v_new_id,
            NULL::TEXT;
        RETURN;
    END IF;

    -- 3. 충돌 발생 - 기존 레코드 조회
    SELECT id, status
    INTO v_existing_id, v_existing_status
    FROM webhook_logs
    WHERE idempotency_key = p_idempotency_key;

    -- 4. 이미 처리 완료된 경우 - 중복 처리 방지
    IF v_existing_status = 'processed' THEN
        RETURN QUERY SELECT
            'already_processed'::TEXT,
            v_existing_id,
            v_existing_status;
        RETURN;
    END IF;

    -- 5. pending 또는 failed 상태 - 재처리 허용
    UPDATE webhook_logs
    SET
        status = 'pending',
        error = NULL,
        payload = p_payload  -- 최신 payload로 업데이트
    WHERE id = v_existing_id;

    RETURN QUERY SELECT
        'reprocessing'::TEXT,
        v_existing_id,
        v_existing_status;
END;
$$;

-- 함수 실행 권한 설정
GRANT EXECUTE ON FUNCTION upsert_webhook_log_atomic(VARCHAR, VARCHAR, JSONB) TO service_role;

-- 설명 추가
COMMENT ON FUNCTION upsert_webhook_log_atomic IS
'웹훅 로그를 원자적으로 upsert하여 race condition을 방지합니다.
- created: 새로 생성됨 (처리 필요)
- already_processed: 이미 처리 완료됨 (스킵)
- reprocessing: 재처리 (이전 실패/대기 상태)';
