-- ============================================================
-- CodeGen AI - Supabase 마이그레이션 통합 검증 테스트
-- 실행: Supabase SQL Editor에서 전체 스크립트 실행
-- ============================================================

-- 검증 결과를 저장할 임시 테이블
DROP TABLE IF EXISTS _verification_results;
CREATE TEMP TABLE _verification_results (
  category TEXT,
  item TEXT,
  status TEXT,
  details TEXT
);

-- ============================================================
-- 1. 테이블 존재 여부 검증
-- ============================================================
DO $$
DECLARE
  required_tables TEXT[] := ARRAY[
    'profiles',
    'subscriptions',
    'credit_transactions',
    'generated_contents',
    'payment_methods',
    'teams',
    'team_members',
    'team_invitations',
    'webhook_events',
    'content_bookmarks',
    'content_feedback',
    'user_learning_progress',
    'notifications'
  ];
  tbl TEXT;
  tbl_exists BOOLEAN;
BEGIN
  FOREACH tbl IN ARRAY required_tables
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) INTO tbl_exists;

    INSERT INTO _verification_results VALUES (
      'TABLE',
      tbl,
      CASE WHEN tbl_exists THEN '✅ EXISTS' ELSE '❌ MISSING' END,
      NULL
    );
  END LOOP;
END $$;

-- ============================================================
-- 2. RPC 함수 존재 여부 검증
-- ============================================================
DO $$
DECLARE
  required_functions TEXT[] := ARRAY[
    'add_credits_atomic',
    'deduct_credit_atomic',
    'deduct_credit_with_refund_atomic',
    'process_subscription_change',
    'cancel_subscription_immediate',
    'get_payment_stats',
    'process_webhook_atomic',
    'increment_generation_count',
    'update_learning_progress'
  ];
  func TEXT;
  func_exists BOOLEAN;
BEGIN
  FOREACH func IN ARRAY required_functions
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.routines
      WHERE routine_schema = 'public' AND routine_name = func
    ) INTO func_exists;

    INSERT INTO _verification_results VALUES (
      'FUNCTION',
      func,
      CASE WHEN func_exists THEN '✅ EXISTS' ELSE '❌ MISSING' END,
      NULL
    );
  END LOOP;
END $$;

-- ============================================================
-- 3. 트리거 존재 여부 검증
-- ============================================================
DO $$
DECLARE
  trigger_rec RECORD;
  expected_triggers TEXT[] := ARRAY[
    'update_profiles_updated_at',
    'update_subscriptions_updated_at',
    'update_payment_methods_updated_at',
    'update_teams_updated_at',
    'update_team_members_updated_at'
  ];
  trig TEXT;
  trig_exists BOOLEAN;
BEGIN
  FOREACH trig IN ARRAY expected_triggers
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.triggers
      WHERE trigger_schema = 'public' AND trigger_name = trig
    ) INTO trig_exists;

    INSERT INTO _verification_results VALUES (
      'TRIGGER',
      trig,
      CASE WHEN trig_exists THEN '✅ EXISTS' ELSE '❌ MISSING' END,
      NULL
    );
  END LOOP;
END $$;

-- ============================================================
-- 4. 인덱스 존재 여부 검증
-- ============================================================
DO $$
DECLARE
  expected_indexes TEXT[] := ARRAY[
    'idx_subscriptions_user_status',
    'idx_subscriptions_billing_cycle',
    'idx_credit_transactions_user_created',
    'idx_credit_transactions_type',
    'idx_generated_contents_user_created',
    'idx_generated_contents_language',
    'idx_payment_methods_user_default',
    'idx_webhook_events_idempotency',
    'idx_webhook_events_type_created',
    'idx_content_bookmarks_user',
    'idx_content_feedback_content',
    'idx_user_learning_progress_user',
    'idx_notifications_user_unread'
  ];
  idx TEXT;
  idx_exists BOOLEAN;
BEGIN
  FOREACH idx IN ARRAY expected_indexes
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = idx
    ) INTO idx_exists;

    INSERT INTO _verification_results VALUES (
      'INDEX',
      idx,
      CASE WHEN idx_exists THEN '✅ EXISTS' ELSE '❌ MISSING' END,
      NULL
    );
  END LOOP;
END $$;

-- ============================================================
-- 5. RLS 정책 존재 여부 검증
-- ============================================================
DO $$
DECLARE
  tables_with_rls TEXT[] := ARRAY[
    'profiles',
    'subscriptions',
    'credit_transactions',
    'generated_contents',
    'payment_methods',
    'content_bookmarks',
    'content_feedback',
    'user_learning_progress',
    'notifications'
  ];
  tbl TEXT;
  rls_enabled BOOLEAN;
  policy_count INTEGER;
BEGIN
  FOREACH tbl IN ARRAY tables_with_rls
  LOOP
    -- RLS 활성화 여부
    SELECT relrowsecurity INTO rls_enabled
    FROM pg_class
    WHERE relname = tbl AND relnamespace = 'public'::regnamespace;

    -- 정책 개수
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = tbl;

    INSERT INTO _verification_results VALUES (
      'RLS',
      tbl,
      CASE
        WHEN rls_enabled AND policy_count > 0 THEN '✅ ENABLED'
        WHEN rls_enabled THEN '⚠️ NO POLICIES'
        ELSE '❌ DISABLED'
      END,
      'Policies: ' || COALESCE(policy_count::TEXT, '0')
    );
  END LOOP;
END $$;

-- ============================================================
-- 6. 뷰 존재 여부 검증
-- ============================================================
DO $$
DECLARE
  expected_views TEXT[] := ARRAY[
    'user_credit_summary',
    'active_subscriptions'
  ];
  v TEXT;
  view_exists BOOLEAN;
BEGIN
  FOREACH v IN ARRAY expected_views
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.views
      WHERE table_schema = 'public' AND table_name = v
    ) INTO view_exists;

    INSERT INTO _verification_results VALUES (
      'VIEW',
      v,
      CASE WHEN view_exists THEN '✅ EXISTS' ELSE '❌ MISSING' END,
      NULL
    );
  END LOOP;
END $$;

-- ============================================================
-- 7. ENUM 타입 존재 여부 검증
-- ============================================================
DO $$
DECLARE
  expected_enums TEXT[] := ARRAY[
    'subscription_status',
    'billing_cycle',
    'credit_transaction_type',
    'notification_type'
  ];
  enum_name TEXT;
  enum_exists BOOLEAN;
BEGIN
  FOREACH enum_name IN ARRAY expected_enums
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_type
      WHERE typname = enum_name AND typnamespace = 'public'::regnamespace
    ) INTO enum_exists;

    INSERT INTO _verification_results VALUES (
      'ENUM',
      enum_name,
      CASE WHEN enum_exists THEN '✅ EXISTS' ELSE '❌ MISSING' END,
      NULL
    );
  END LOOP;
END $$;

-- ============================================================
-- 결과 출력
-- ============================================================
SELECT
  '========================================' AS "=";
SELECT
  'CodeGen AI 마이그레이션 검증 결과' AS "VERIFICATION REPORT";
SELECT
  '========================================' AS "=";

-- 카테고리별 요약
SELECT
  category AS "Category",
  COUNT(*) FILTER (WHERE status LIKE '✅%') AS "Pass",
  COUNT(*) FILTER (WHERE status LIKE '❌%') AS "Fail",
  COUNT(*) FILTER (WHERE status LIKE '⚠️%') AS "Warn",
  COUNT(*) AS "Total"
FROM _verification_results
GROUP BY category
ORDER BY category;

SELECT '----------------------------------------' AS "-";

-- 실패 항목만 표시
SELECT
  'FAILED ITEMS' AS "=";
SELECT category, item, status, details
FROM _verification_results
WHERE status LIKE '❌%' OR status LIKE '⚠️%'
ORDER BY category, item;

SELECT '----------------------------------------' AS "-";

-- 전체 상세 결과
SELECT
  'DETAILED RESULTS' AS "=";
SELECT category, item, status, COALESCE(details, '') as details
FROM _verification_results
ORDER BY category, item;

-- 최종 요약
SELECT
  '========================================' AS "=";
SELECT
  CASE
    WHEN COUNT(*) FILTER (WHERE status LIKE '❌%') = 0
    THEN '✅ ALL TESTS PASSED - 마이그레이션 성공!'
    ELSE '❌ ' || COUNT(*) FILTER (WHERE status LIKE '❌%') || ' TESTS FAILED - 확인 필요'
  END AS "FINAL RESULT"
FROM _verification_results;

-- 정리
DROP TABLE IF EXISTS _verification_results;
