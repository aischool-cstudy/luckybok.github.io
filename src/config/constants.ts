/**
 * 애플리케이션 공통 상수 정의 (Single Source of Truth)
 *
 * 이 파일은 언어, 난이도, 타겟 오디언스 등의 상수를 중앙에서 관리합니다.
 * 다른 파일에서는 이 파일의 상수를 import하여 사용합니다.
 */

// ===== 시간 관련 상수 =====

/** 밀리초 단위 상수 */
export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

/** 일 단위 상수 */
export const DAYS_IN_WEEK = 7;
export const DAYS_IN_MONTH = 30; // 평균값
export const DAYS_IN_YEAR = 365;

/** 크레딧 만료 경고 기간 (30일) */
export const CREDIT_EXPIRY_WARNING_DAYS = 30;

/** 환불 가능 기간 (7일) */
export const REFUND_ELIGIBLE_DAYS = 7;

/** 결제 재시도 간격 (1일) */
export const PAYMENT_RETRY_INTERVAL_DAYS = 1;

/** 구독 유예 기간 (3일) */
export const SUBSCRIPTION_GRACE_PERIOD_DAYS = 3;

// ===== 타임아웃 설정 =====

/** API 요청 타임아웃 (기본) */
export const DEFAULT_TIMEOUT_MS = 15 * MS_PER_SECOND; // 15초

/** AI API 타임아웃 (긴 응답 대기) */
export const AI_TIMEOUT_MS = 60 * MS_PER_SECOND; // 60초

/** 결제 API 타임아웃 */
export const PAYMENT_TIMEOUT_MS = 15 * MS_PER_SECOND; // 15초

/** 외부 API 재시도 설정 */
export const RETRY_CONFIG = {
  /** 최대 재시도 횟수 */
  maxRetries: 3,
  /** 기본 딜레이 (ms) */
  baseDelayMs: MS_PER_SECOND,
  /** 최대 딜레이 (ms) */
  maxDelayMs: 10 * MS_PER_SECOND,
  /** 재시도 가능한 HTTP 상태 코드 */
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
} as const;

/** Cron Job 타임아웃 */
export const CRON_TIMEOUT_MS = 5 * MS_PER_MINUTE; // 5분

// ===== 지원 언어 =====
// 우선순위: P0(python, javascript) → P1(sql, java) → P2(typescript, go)

export const SUPPORTED_LANGUAGES = [
  'python',
  'javascript',
  'sql',
  'java',
  'typescript',
  'go',
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  python: 'Python',
  javascript: 'JavaScript',
  sql: 'SQL',
  java: 'Java',
  typescript: 'TypeScript',
  go: 'Go',
};

// ===== 난이도 =====

export const DIFFICULTY_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;

export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

export const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  beginner: '입문',
  intermediate: '중급',
  advanced: '고급',
};

export const DIFFICULTY_DESCRIPTIONS: Record<DifficultyLevel, string> = {
  beginner: '프로그래밍을 처음 접하는 분들을 위한 기초 설명',
  intermediate: '기본 개념을 알고 있는 분들을 위한 심화 설명',
  advanced: '실무 경험이 있는 분들을 위한 전문적인 설명',
};

// ===== 타겟 오디언스 =====

export const TARGET_AUDIENCES = [
  'non_tech',
  'junior_dev',
  'manager',
  'career_changer',
] as const;

export type TargetAudience = (typeof TARGET_AUDIENCES)[number];

export const TARGET_AUDIENCE_LABELS: Record<TargetAudience, string> = {
  non_tech: '비전공 직장인',
  junior_dev: '주니어 개발자',
  manager: '관리자/임원',
  career_changer: '커리어 전환자',
};

export const TARGET_AUDIENCE_DESCRIPTIONS: Record<TargetAudience, string> = {
  non_tech: '프로그래밍 경험이 없는 일반인 (마케팅, 기획, 영업 등)',
  junior_dev: '개발 경험 1-3년차의 초급 개발자',
  manager: '개발팀을 이끄는 관리자 또는 PM (PM, CTO, 창업자)',
  career_changer: '다른 분야에서 개발자로 전향하려는 분',
};

export const TARGET_AUDIENCE_ANALOGY_DOMAINS: Record<TargetAudience, string> = {
  non_tech: '일상생활/엑셀/업무 자동화',
  junior_dev: '기초 프로그래밍/언어 비교',
  manager: '비즈니스/프로젝트 관리/조직 프로세스',
  career_changer: '기존 직업 경험/요리/건축 등 범용 비유',
};

// ===== UI 옵션 배열 (폼에서 사용) =====

export const LANGUAGE_OPTIONS = SUPPORTED_LANGUAGES.map((value) => ({
  value,
  label: LANGUAGE_LABELS[value],
}));

export const DIFFICULTY_OPTIONS = DIFFICULTY_LEVELS.map((value) => ({
  value,
  label: DIFFICULTY_LABELS[value],
}));

export const TARGET_AUDIENCE_OPTIONS = TARGET_AUDIENCES.map((value) => ({
  value,
  label: TARGET_AUDIENCE_LABELS[value],
}));

// ===== 웹훅 상태 =====

export const WEBHOOK_STATUSES = ['pending', 'processed', 'failed', 'retrying'] as const;

export type WebhookStatus = (typeof WEBHOOK_STATUSES)[number];

export const WEBHOOK_STATUS_LABELS: Record<WebhookStatus, string> = {
  pending: '대기 중',
  processed: '처리 완료',
  failed: '실패',
  retrying: '재시도 중',
};

// ===== 결제 및 구독 상태 =====

export const PAYMENT_STATUSES = [
  'pending',
  'completed',
  'failed',
  'canceled',
  'refunded',
  'partial_refunded',
] as const;

export type PaymentStatusType = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatusType, string> = {
  pending: '결제 대기',
  completed: '결제 완료',
  failed: '결제 실패',
  canceled: '결제 취소',
  refunded: '환불 완료',
  partial_refunded: '부분 환불',
};

export const SUBSCRIPTION_STATUSES = [
  'active',
  'canceled',
  'past_due',
  'trialing',
  'paused',
] as const;

export type SubscriptionStatusType = (typeof SUBSCRIPTION_STATUSES)[number];

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatusType, string> = {
  active: '활성',
  canceled: '취소됨',
  past_due: '연체',
  trialing: '체험 중',
  paused: '일시 중지',
};

// ===== 플랜 정보 =====

export const PLAN_TYPES = ['starter', 'pro', 'team', 'enterprise'] as const;

export type PlanType = (typeof PLAN_TYPES)[number];

export const PLAN_LABELS: Record<PlanType, string> = {
  starter: 'Starter (무료)',
  pro: 'Pro',
  team: 'Team',
  enterprise: 'Enterprise',
};

export const PLAN_DAILY_LIMITS: Record<PlanType, number> = {
  starter: 10,
  pro: 100,
  team: 500,
  enterprise: 999999,
};
