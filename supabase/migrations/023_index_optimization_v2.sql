-- =====================================================
-- 023_index_optimization_v2.sql
-- 추가 인덱스 최적화 (Phase 2)
-- 009_index_optimization.sql 이후 추가된 테이블 및 누락된 인덱스
-- =====================================================

-- =====================================================
-- 1. learning_progress 테이블 인덱스 최적화
-- =====================================================

-- 복합: 사용자별 상태 + 진행률 (대시보드 조회)
CREATE INDEX IF NOT EXISTS idx_learning_progress_user_status_progress
    ON learning_progress(user_id, status, progress_percentage DESC);

-- 복합: 콘텐츠별 완료 통계 (콘텐츠 인기도 분석)
CREATE INDEX IF NOT EXISTS idx_learning_progress_content_completed
    ON learning_progress(content_id, completed_at DESC)
    WHERE status = 'completed';

-- 복합: 최근 학습 + 시간 소비 (통계 대시보드)
CREATE INDEX IF NOT EXISTS idx_learning_progress_user_time
    ON learning_progress(user_id, time_spent_seconds DESC, last_accessed_at DESC);

-- 복합: 퀴즈 점수 분석 (성과 분석용)
CREATE INDEX IF NOT EXISTS idx_learning_progress_quiz_stats
    ON learning_progress(user_id, quiz_score DESC, quiz_attempts)
    WHERE quiz_score IS NOT NULL;

-- BRIN 인덱스: 시계열 데이터 (created_at 기반 범위 조회)
CREATE INDEX IF NOT EXISTS idx_learning_progress_created_brin
    ON learning_progress USING BRIN(created_at);

-- =====================================================
-- 2. learning_streaks 테이블 인덱스 최적화
-- =====================================================

-- 복합: 리더보드 조회 최적화 (다중 정렬 조건)
CREATE INDEX IF NOT EXISTS idx_learning_streaks_leaderboard
    ON learning_streaks(current_streak DESC, total_contents_completed DESC, total_time_spent_seconds DESC);

-- 주간 목표 달성률 조회
CREATE INDEX IF NOT EXISTS idx_learning_streaks_weekly_goal
    ON learning_streaks(weekly_goal_days, weekly_completed_days)
    WHERE weekly_goal_days > 0;

-- 오늘 활동 체크 (스트릭 리셋 대상 조회)
CREATE INDEX IF NOT EXISTS idx_learning_streaks_last_activity
    ON learning_streaks(last_activity_date)
    WHERE last_activity_date IS NOT NULL;

-- =====================================================
-- 3. daily_learning_logs 테이블 인덱스 최적화
-- =====================================================

-- 복합: 목표 달성 통계 (주간/월간 리포트)
CREATE INDEX IF NOT EXISTS idx_daily_learning_logs_goal_stats
    ON daily_learning_logs(user_id, log_date DESC, daily_goal_met);

-- 시간 기반 집계 최적화
CREATE INDEX IF NOT EXISTS idx_daily_learning_logs_time_stats
    ON daily_learning_logs(log_date, time_spent_seconds DESC);

-- BRIN 인덱스: 날짜 범위 조회 최적화
CREATE INDEX IF NOT EXISTS idx_daily_learning_logs_date_brin
    ON daily_learning_logs USING BRIN(log_date);

-- =====================================================
-- 4. achievements 테이블 인덱스 최적화
-- =====================================================

-- 복합: 카테고리별 업적 조회 (업적 대시보드)
CREATE INDEX IF NOT EXISTS idx_achievements_user_type_level
    ON achievements(user_id, achievement_type, achievement_level DESC);

-- 최근 업적 조회 (알림, 피드)
CREATE INDEX IF NOT EXISTS idx_achievements_recent
    ON achievements(achieved_at DESC)
    WHERE achieved_at > NOW() - INTERVAL '30 days';

-- =====================================================
-- 5. content_ratings 테이블 인덱스 최적화
-- =====================================================

-- 복합: 콘텐츠별 평균 평점 조회 최적화
CREATE INDEX IF NOT EXISTS idx_content_ratings_content_rating_stats
    ON content_ratings(content_id, rating, created_at DESC);

-- 복합: 날짜 범위 + 평점 (트렌드 분석)
CREATE INDEX IF NOT EXISTS idx_content_ratings_date_rating
    ON content_ratings(created_at DESC, rating);

-- 유용성 평가 필터 (피드백 분석)
CREATE INDEX IF NOT EXISTS idx_content_ratings_helpful_recommend
    ON content_ratings(was_helpful, would_recommend)
    WHERE was_helpful IS NOT NULL OR would_recommend IS NOT NULL;

-- 개선 요청 GIN 인덱스 (배열 검색)
CREATE INDEX IF NOT EXISTS idx_content_ratings_improvements_gin
    ON content_ratings USING GIN(improvement_requests)
    WHERE improvement_requests != '{}';

-- BRIN 인덱스: 시계열 데이터
CREATE INDEX IF NOT EXISTS idx_content_ratings_created_brin
    ON content_ratings USING BRIN(created_at);

-- =====================================================
-- 6. feedback_responses 테이블 인덱스 최적화
-- =====================================================

-- 공개 응답만 조회 최적화
CREATE INDEX IF NOT EXISTS idx_feedback_responses_public
    ON feedback_responses(rating_id, created_at DESC)
    WHERE is_public = TRUE;

-- =====================================================
-- 7. feedback_reports 테이블 인덱스 최적화
-- =====================================================

-- 복합: 대기 중 신고 (관리자 대시보드)
CREATE INDEX IF NOT EXISTS idx_feedback_reports_pending
    ON feedback_reports(status, created_at DESC)
    WHERE status IN ('pending', 'reviewing');

-- =====================================================
-- 8. notifications 테이블 인덱스 최적화
-- =====================================================

-- 복합: 카테고리별 읽지 않은 알림 (알림 센터)
CREATE INDEX IF NOT EXISTS idx_notifications_user_category_unread
    ON notifications(user_id, category, created_at DESC)
    WHERE is_read = FALSE;

-- 복합: 만료 + 읽음 상태 (정리 작업)
CREATE INDEX IF NOT EXISTS idx_notifications_cleanup
    ON notifications(expires_at, is_read, created_at)
    WHERE expires_at IS NOT NULL;

-- BRIN 인덱스: 시계열 데이터
CREATE INDEX IF NOT EXISTS idx_notifications_created_brin
    ON notifications USING BRIN(created_at);

-- =====================================================
-- 9. email_digest_queue 테이블 인덱스 최적화
-- =====================================================

-- 복합: 다이제스트 유형별 발송 대기 (cron job)
CREATE INDEX IF NOT EXISTS idx_email_digest_queue_digest_pending
    ON email_digest_queue(digest_type, scheduled_at)
    WHERE sent = FALSE;

-- =====================================================
-- 10. bookmark_folders 테이블 인덱스 최적화
-- =====================================================

-- 복합: 폴더 계층 조회 (폴더 트리)
CREATE INDEX IF NOT EXISTS idx_bookmark_folders_hierarchy
    ON bookmark_folders(user_id, parent_id, order_index);

-- =====================================================
-- 11. content_bookmarks 테이블 인덱스 최적화
-- =====================================================

-- 복합: 폴더별 북마크 정렬 (폴더 내 목록)
CREATE INDEX IF NOT EXISTS idx_content_bookmarks_folder_order
    ON content_bookmarks(folder_id, created_at DESC)
    WHERE folder_id IS NOT NULL;

-- 복합: 즐겨찾기 + 최신순 (빠른 접근)
CREATE INDEX IF NOT EXISTS idx_content_bookmarks_user_favorite_recent
    ON content_bookmarks(user_id, created_at DESC)
    WHERE is_favorite = TRUE;

-- =====================================================
-- 12. learner_profiles 테이블 인덱스 최적화
-- =====================================================

-- 온보딩 완료 여부 조회 (사용자 세그먼트)
CREATE INDEX IF NOT EXISTS idx_learner_profiles_onboarding
    ON learner_profiles(user_id, onboarding_completed);

-- 경험 수준별 사용자 조회 (세그먼트 분석)
CREATE INDEX IF NOT EXISTS idx_learner_profiles_experience
    ON learner_profiles(experience_level)
    WHERE experience_level IS NOT NULL;

-- 선호 언어 GIN 인덱스 (배열 검색)
CREATE INDEX IF NOT EXISTS idx_learner_profiles_languages_gin
    ON learner_profiles USING GIN(preferred_languages);

-- =====================================================
-- 13. level_tests 테이블 인덱스 최적화
-- =====================================================

-- 복합: 사용자별 언어별 최신 테스트 (레벨 조회)
CREATE INDEX IF NOT EXISTS idx_level_tests_user_lang_recent
    ON level_tests(user_id, language, created_at DESC);

-- 레벨별 분포 조회 (통계)
CREATE INDEX IF NOT EXISTS idx_level_tests_level_distribution
    ON level_tests(language, determined_level);

-- =====================================================
-- 14. level_test_questions 테이블 인덱스 최적화
-- =====================================================

-- 복합: 활성 문제 조회 (테스트 출제)
CREATE INDEX IF NOT EXISTS idx_level_test_questions_active
    ON level_test_questions(language, difficulty, order_index)
    WHERE is_active = TRUE;

-- 토픽별 문제 조회 (문제 관리)
CREATE INDEX IF NOT EXISTS idx_level_test_questions_topic
    ON level_test_questions(topic, language);

-- =====================================================
-- 15. generated_contents 추가 인덱스
-- =====================================================

-- 복합: 전체 텍스트 검색용 (title, topic)
CREATE INDEX IF NOT EXISTS idx_generated_contents_search
    ON generated_contents USING GIN(
        to_tsvector('simple', COALESCE(title, '') || ' ' || topic)
    );

-- 복합: 토큰 사용량 분석 (비용 분석)
CREATE INDEX IF NOT EXISTS idx_generated_contents_tokens
    ON generated_contents(created_at DESC, tokens_used)
    WHERE tokens_used IS NOT NULL;

-- BRIN 인덱스: 시계열 데이터
CREATE INDEX IF NOT EXISTS idx_generated_contents_created_brin
    ON generated_contents USING BRIN(created_at);

-- =====================================================
-- 16. subscriptions 추가 인덱스
-- =====================================================

-- 복합: 만료 예정 구독 알림 (cron job)
CREATE INDEX IF NOT EXISTS idx_subscriptions_expiring_soon
    ON subscriptions(current_period_end, user_id)
    WHERE status = 'active'
    AND current_period_end BETWEEN NOW() AND NOW() + INTERVAL '7 days';

-- 복합: 플랜별 활성 구독 (통계)
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_active
    ON subscriptions(plan, billing_cycle, status)
    WHERE status = 'active';

-- =====================================================
-- 17. payments 추가 인덱스
-- =====================================================

-- 복합: 월별 매출 집계 (리포트)
CREATE INDEX IF NOT EXISTS idx_payments_monthly_revenue
    ON payments(DATE_TRUNC('month', paid_at), status, amount)
    WHERE paid_at IS NOT NULL AND status = 'completed';

-- BRIN 인덱스: 시계열 데이터
CREATE INDEX IF NOT EXISTS idx_payments_created_brin
    ON payments USING BRIN(created_at);

-- =====================================================
-- 18. credit_transactions 추가 인덱스
-- =====================================================

-- BRIN 인덱스: 시계열 데이터
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_brin
    ON credit_transactions USING BRIN(created_at);

-- =====================================================
-- 19. webhook_logs 인덱스 수정
-- (009에서 잘못 정의된 인덱스 - retry_count, status 컬럼 없음)
-- =====================================================

-- idempotency_key 조회 최적화 (010에서 추가된 컬럼)
CREATE INDEX IF NOT EXISTS idx_webhook_logs_idempotency
    ON webhook_logs(idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- 이벤트 유형 + 시간 복합 인덱스 (디버깅)
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_created
    ON webhook_logs(event_type, created_at DESC);

-- 처리 실패 웹훅 조회 (수동 재처리)
CREATE INDEX IF NOT EXISTS idx_webhook_logs_errors
    ON webhook_logs(created_at DESC)
    WHERE error IS NOT NULL;

-- =====================================================
-- 20. teams 추가 인덱스
-- =====================================================

-- 소유자별 팀 조회
CREATE INDEX IF NOT EXISTS idx_teams_owner
    ON teams(owner_id, created_at DESC);

-- slug 조회 최적화 (URL 라우팅)
CREATE INDEX IF NOT EXISTS idx_teams_slug_active
    ON teams(slug)
    WHERE is_active = TRUE;

-- =====================================================
-- 21. team_members 추가 인덱스
-- =====================================================

-- 복합: 역할별 팀원 조회 (권한 관리)
CREATE INDEX IF NOT EXISTS idx_team_members_team_role
    ON team_members(team_id, role, joined_at);

-- =====================================================
-- 22. 통계 및 분석용 Covering 인덱스
-- =====================================================

-- 사용자별 콘텐츠 생성 통계 (INCLUDE로 covering index)
-- PostgreSQL 11+ 지원
CREATE INDEX IF NOT EXISTS idx_generated_contents_user_stats
    ON generated_contents(user_id, created_at DESC)
    INCLUDE (language, tokens_used);

-- 결제 내역 조회 최적화 (covering index)
CREATE INDEX IF NOT EXISTS idx_payments_user_history
    ON payments(user_id, created_at DESC)
    INCLUDE (type, status, amount);

-- =====================================================
-- 코멘트 (인덱스 용도 문서화)
-- =====================================================

-- Learning Progress
COMMENT ON INDEX idx_learning_progress_user_status_progress IS '사용자별 상태/진행률 대시보드 조회';
COMMENT ON INDEX idx_learning_progress_content_completed IS '콘텐츠별 완료 통계';
COMMENT ON INDEX idx_learning_progress_user_time IS '사용자별 학습 시간 통계';
COMMENT ON INDEX idx_learning_progress_quiz_stats IS '퀴즈 성과 분석';
COMMENT ON INDEX idx_learning_progress_created_brin IS '시계열 범위 조회 (BRIN)';

-- Learning Streaks
COMMENT ON INDEX idx_learning_streaks_leaderboard IS '리더보드 조회 최적화';
COMMENT ON INDEX idx_learning_streaks_weekly_goal IS '주간 목표 달성률 조회';
COMMENT ON INDEX idx_learning_streaks_last_activity IS '스트릭 리셋 대상 조회 (cron)';

-- Content Ratings
COMMENT ON INDEX idx_content_ratings_content_rating_stats IS '콘텐츠별 평점 통계';
COMMENT ON INDEX idx_content_ratings_date_rating IS '평점 트렌드 분석';
COMMENT ON INDEX idx_content_ratings_improvements_gin IS '개선 요청 배열 검색 (GIN)';
COMMENT ON INDEX idx_content_ratings_created_brin IS '시계열 범위 조회 (BRIN)';

-- Notifications
COMMENT ON INDEX idx_notifications_user_category_unread IS '카테고리별 읽지 않은 알림';
COMMENT ON INDEX idx_notifications_cleanup IS '알림 정리 작업 최적화';
COMMENT ON INDEX idx_notifications_created_brin IS '시계열 범위 조회 (BRIN)';

-- Generated Contents
COMMENT ON INDEX idx_generated_contents_search IS '제목/주제 전체 텍스트 검색 (GIN)';
COMMENT ON INDEX idx_generated_contents_tokens IS '토큰 사용량 분석';
COMMENT ON INDEX idx_generated_contents_created_brin IS '시계열 범위 조회 (BRIN)';

-- Webhooks
COMMENT ON INDEX idx_webhook_logs_idempotency IS '멱등성 키 조회';
COMMENT ON INDEX idx_webhook_logs_errors IS '에러 발생 웹훅 조회';

-- Covering Indexes
COMMENT ON INDEX idx_generated_contents_user_stats IS '사용자별 생성 통계 (covering)';
COMMENT ON INDEX idx_payments_user_history IS '결제 내역 조회 (covering)';

-- =====================================================
-- 인덱스 최적화 완료 알림
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '023_index_optimization_v2.sql: 인덱스 최적화 완료';
    RAISE NOTICE '추가된 인덱스: 40+ (B-tree, GIN, BRIN, Covering)';
END $$;
