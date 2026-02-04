-- =====================================================
-- 009_index_optimization.sql
-- 쿼리 성능 최적화를 위한 인덱스 추가
-- =====================================================

-- =====================================================
-- 1. profiles 테이블 인덱스
-- =====================================================

-- 플랜별 사용자 조회 (관리자 통계, 플랜별 기능 제한)
CREATE INDEX IF NOT EXISTS idx_profiles_plan
    ON profiles(plan);

-- 일일 리셋 대상 조회 (cron job 최적화)
CREATE INDEX IF NOT EXISTS idx_profiles_daily_reset
    ON profiles(daily_reset_at)
    WHERE daily_reset_at IS NOT NULL;

-- 플랜 만료 대상 조회 (cron job)
CREATE INDEX IF NOT EXISTS idx_profiles_plan_expires
    ON profiles(plan_expires_at)
    WHERE plan_expires_at IS NOT NULL;

-- 팀 멤버 조회 최적화
CREATE INDEX IF NOT EXISTS idx_profiles_team_id
    ON profiles(team_id)
    WHERE team_id IS NOT NULL;

-- =====================================================
-- 2. generated_contents 테이블 인덱스
-- =====================================================

-- 난이도별 필터링
CREATE INDEX IF NOT EXISTS idx_generated_contents_difficulty
    ON generated_contents(difficulty);

-- 대상별 필터링
CREATE INDEX IF NOT EXISTS idx_generated_contents_target
    ON generated_contents(target_audience);

-- 복합: 사용자별 언어 필터 + 최신순
CREATE INDEX IF NOT EXISTS idx_generated_contents_user_lang_created
    ON generated_contents(user_id, language, created_at DESC);

-- 복합: 사용자별 난이도 필터 + 최신순
CREATE INDEX IF NOT EXISTS idx_generated_contents_user_diff_created
    ON generated_contents(user_id, difficulty, created_at DESC);

-- =====================================================
-- 3. credit_transactions 테이블 인덱스
-- =====================================================

-- 거래 유형별 조회 (구매, 사용, 환불 등)
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type
    ON credit_transactions(type);

-- 결제와의 조인 최적화
CREATE INDEX IF NOT EXISTS idx_credit_transactions_payment_id
    ON credit_transactions(payment_id)
    WHERE payment_id IS NOT NULL;

-- 복합: 사용자별 유형 + 최신순 (거래 내역 조회)
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_type_created
    ON credit_transactions(user_id, type, created_at DESC);

-- 만료 예정 크레딧 조회 (expiry 처리용)
CREATE INDEX IF NOT EXISTS idx_credit_transactions_pending_expiry
    ON credit_transactions(expires_at, user_id)
    WHERE expires_at IS NOT NULL AND type = 'purchase' AND amount > 0;

-- =====================================================
-- 4. subscriptions 테이블 인덱스
-- =====================================================

-- 빌링키 조인 최적화
CREATE INDEX IF NOT EXISTS idx_subscriptions_billing_key_id
    ON subscriptions(billing_key_id)
    WHERE billing_key_id IS NOT NULL;

-- 복합: 갱신 대상 조회 최적화
CREATE INDEX IF NOT EXISTS idx_subscriptions_renewal_due
    ON subscriptions(current_period_end, status, billing_key_id)
    WHERE status = 'active' AND cancel_at_period_end = FALSE;

-- =====================================================
-- 5. payments 테이블 인덱스
-- =====================================================

-- 결제 유형별 조회
CREATE INDEX IF NOT EXISTS idx_payments_type
    ON payments(type);

-- 복합: 사용자별 유형 + 최신순 (결제 내역 조회)
CREATE INDEX IF NOT EXISTS idx_payments_user_type_created
    ON payments(user_id, type, created_at DESC);

-- 복합: 환불 가능 결제 조회
CREATE INDEX IF NOT EXISTS idx_payments_refundable
    ON payments(user_id, status, paid_at DESC)
    WHERE status = 'completed';

-- paid_at 인덱스 (결제 완료 시점 기준 조회)
CREATE INDEX IF NOT EXISTS idx_payments_paid_at
    ON payments(paid_at DESC)
    WHERE paid_at IS NOT NULL;

-- =====================================================
-- 6. webhook_logs 테이블 인덱스
-- =====================================================

-- 처리 완료된 웹훅 조회
CREATE INDEX IF NOT EXISTS idx_webhook_logs_processed_at
    ON webhook_logs(processed_at DESC)
    WHERE processed_at IS NOT NULL;

-- 재시도 대상 웹훅 조회
CREATE INDEX IF NOT EXISTS idx_webhook_logs_retry_candidates
    ON webhook_logs(retry_count, created_at)
    WHERE status = 'failed' AND retry_count < 3;

-- =====================================================
-- 7. team_invitations 테이블 인덱스
-- =====================================================

-- 만료 대상 초대 조회 (cron job)
CREATE INDEX IF NOT EXISTS idx_team_invitations_expires
    ON team_invitations(expires_at)
    WHERE status = 'pending';

-- 복합: 팀별 대기 중 초대 조회
CREATE INDEX IF NOT EXISTS idx_team_invitations_team_pending
    ON team_invitations(team_id, status, created_at DESC)
    WHERE status = 'pending';

-- =====================================================
-- 8. team_api_usage 테이블 인덱스
-- =====================================================

-- 복합: 팀별 시계열 조회 (API 사용량 대시보드)
CREATE INDEX IF NOT EXISTS idx_team_api_usage_team_created
    ON team_api_usage(team_id, created_at DESC);

-- 복합: API 키별 시계열 조회
CREATE INDEX IF NOT EXISTS idx_team_api_usage_key_created
    ON team_api_usage(api_key_id, created_at DESC);

-- 상태 코드별 조회 (에러 모니터링)
CREATE INDEX IF NOT EXISTS idx_team_api_usage_status_code
    ON team_api_usage(status_code)
    WHERE status_code >= 400;

-- =====================================================
-- 9. team_api_keys 테이블 인덱스
-- =====================================================

-- 활성 API 키 조회 최적화
CREATE INDEX IF NOT EXISTS idx_team_api_keys_team_active
    ON team_api_keys(team_id, is_active)
    WHERE is_active = TRUE;

-- 만료 예정 키 조회
CREATE INDEX IF NOT EXISTS idx_team_api_keys_expires
    ON team_api_keys(expires_at)
    WHERE expires_at IS NOT NULL AND is_active = TRUE;

-- =====================================================
-- 10. teams 테이블 인덱스
-- =====================================================

-- 활성 팀 조회
CREATE INDEX IF NOT EXISTS idx_teams_active
    ON teams(is_active, created_at DESC)
    WHERE is_active = TRUE;

-- =====================================================
-- 코멘트 (인덱스 용도 문서화)
-- =====================================================

COMMENT ON INDEX idx_profiles_plan IS '플랜별 사용자 통계 및 기능 제한 조회';
COMMENT ON INDEX idx_profiles_daily_reset IS '일일 생성 횟수 리셋 대상 조회 (cron)';
COMMENT ON INDEX idx_profiles_plan_expires IS '플랜 만료 대상 조회 (cron)';

COMMENT ON INDEX idx_generated_contents_user_lang_created IS '사용자별 언어 필터 + 최신순 히스토리 조회';
COMMENT ON INDEX idx_generated_contents_user_diff_created IS '사용자별 난이도 필터 + 최신순 히스토리 조회';

COMMENT ON INDEX idx_credit_transactions_user_type_created IS '사용자별 크레딧 거래 내역 조회';
COMMENT ON INDEX idx_credit_transactions_pending_expiry IS '만료 예정 크레딧 처리 (cron)';

COMMENT ON INDEX idx_subscriptions_renewal_due IS '갱신 대상 구독 조회 (정기 결제 cron)';

COMMENT ON INDEX idx_payments_user_type_created IS '사용자별 결제 유형 필터 내역 조회';
COMMENT ON INDEX idx_payments_refundable IS '환불 가능 결제 조회';

COMMENT ON INDEX idx_webhook_logs_retry_candidates IS '재시도 대상 실패 웹훅 조회';

COMMENT ON INDEX idx_team_api_usage_team_created IS 'API 사용량 대시보드 시계열 조회';
COMMENT ON INDEX idx_team_api_usage_status_code IS 'API 에러 모니터링';
