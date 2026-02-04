export { createClient } from './client';
export { createServerClient } from './server';
export { createAdminClient } from './admin';
export { updateSession } from './middleware';

// 타입 안전한 Supabase 클라이언트 헬퍼
export {
  typedFrom,
  typedInsert,
  typedInsertReturning,
  typedUpdate,
  typedSelectSingle,
  typedSelectMany,
  typedRpc,
} from './typed-client';

// DB 헬퍼 함수들
export {
  // 프로필
  getProfile,
  updateProfile,
  // 크레딧
  useGenerationCredit,
  getCreditTransactions,
  // 구독
  getActiveSubscription,
  getSubscriptionHistory,
  // 결제
  generateOrderId,
  getPaymentHistory,
  getPaymentByOrderId,
  // 콘텐츠
  getGeneratedContents,
  getGeneratedContent,
  // 통계
  getPaymentStats,
  getGenerationStats,
  // 관리자 전용
  resetDailyGenerations,
  checkExpiredSubscriptions,
  expireCredits,
} from './helpers';

// 에러 처리 유틸리티
export {
  classifySupabaseError,
  handleSupabaseError,
  isNotFoundError,
  isDuplicateError,
  isRetryableError,
  withRetry,
  PG_ERROR_CODES,
  type SupabaseErrorCode,
  type SupabaseErrorResult,
} from './error-handler';
