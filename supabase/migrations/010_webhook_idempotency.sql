-- =====================================================
-- 웹훅 멱등성 처리를 위한 스키마 수정
-- =====================================================

-- 1. webhook_logs 테이블에 idempotency_key 컬럼 추가
ALTER TABLE webhook_logs
ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128);

-- 2. webhook_logs 테이블에 status 컬럼 추가 (기존 데이터 호환)
-- 주의: 006_transaction_functions.sql에서 이미 추가되었으므로 이 ALTER는 무시됨
-- 'retrying' 상태는 006에서 정의된 CHECK 제약조건에 포함되어 있음
ALTER TABLE webhook_logs
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'processed', 'failed', 'retrying'));

-- 3. idempotency_key 유니크 인덱스 추가
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_logs_idempotency_key
    ON webhook_logs(idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- 4. 처리된 웹훅 조회용 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status_created
    ON webhook_logs(status, created_at DESC);

-- 5. 이벤트 타입 + 멱등성 키 복합 인덱스 (빠른 중복 확인)
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_idempotency
    ON webhook_logs(event_type, idempotency_key);

-- 6. 기존 데이터 상태 업데이트 (processed_at이 있으면 processed)
UPDATE webhook_logs
SET status = CASE
    WHEN processed_at IS NOT NULL AND error IS NULL THEN 'processed'
    WHEN error IS NOT NULL THEN 'failed'
    ELSE 'pending'
END
WHERE status IS NULL OR status = 'pending';
