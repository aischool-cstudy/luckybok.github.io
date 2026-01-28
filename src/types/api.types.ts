/**
 * API 관련 타입 정의
 * Server Actions 및 API 응답에 사용되는 타입들
 */

import type { GeneratedContentStructure, ContentGenerationInput } from './domain.types';

// ===== 공통 응답 타입 =====

/**
 * 기본 API 응답 구조
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

/**
 * API 에러 구조
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * 페이지네이션 응답 구조
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// ===== Server Action 응답 타입 =====

/**
 * Server Action 기본 결과
 */
export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

// ===== 콘텐츠 생성 API =====

/**
 * 콘텐츠 생성 요청
 */
export interface GenerateContentRequest extends ContentGenerationInput {
  stream?: boolean;
}

/**
 * 콘텐츠 생성 응답
 */
export interface GenerateContentResponse {
  success: boolean;
  content?: GeneratedContentStructure;
  contentId?: string;
  metadata?: {
    model: string;
    tokensUsed: number;
    generationTimeMs: number;
  };
  error?: string;
}

/**
 * 스트리밍 콘텐츠 생성 청크
 */
export interface StreamContentChunk {
  type: 'start' | 'delta' | 'complete' | 'error';
  content?: string;
  metadata?: {
    model: string;
    tokensUsed: number;
  };
  error?: string;
}

// ===== 콘텐츠 조회 API =====

/**
 * 콘텐츠 목록 조회 파라미터
 */
export interface GetContentsParams {
  page?: number;
  pageSize?: number;
  language?: string;
  difficulty?: string;
  targetAudience?: string;
  search?: string;
  sortBy?: 'created_at' | 'title';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 콘텐츠 상세 정보 (목록용)
 */
export interface ContentListItem {
  id: string;
  title: string | null;
  topic: string;
  language: string;
  difficulty: string;
  targetAudience: string;
  createdAt: string;
}

/**
 * 콘텐츠 상세 정보 (상세 조회용)
 */
export interface ContentDetail extends ContentListItem {
  content: GeneratedContentStructure;
  modelUsed: string | null;
  tokensUsed: number | null;
  generationTimeMs: number | null;
}

// ===== 사용자 API =====

/**
 * 사용자 프로필 응답
 */
export interface UserProfileResponse {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  dailyGenerationsRemaining: number;
  createdAt: string;
}

/**
 * 사용자 통계
 */
export interface UserStats {
  totalGenerations: number;
  todayGenerations: number;
  remainingGenerations: number;
  favoriteLanguage?: string;
  recentTopics: string[];
}

// ===== 에러 코드 =====

/**
 * API 에러 코드
 */
export const API_ERROR_CODES = {
  // 인증 관련
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  SESSION_EXPIRED: 'SESSION_EXPIRED',

  // 유효성 검증
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',

  // 리소스 관련
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',

  // 제한 관련
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  DAILY_LIMIT_EXCEEDED: 'DAILY_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // AI 관련
  AI_GENERATION_FAILED: 'AI_GENERATION_FAILED',
  AI_TIMEOUT: 'AI_TIMEOUT',
  AI_CONTENT_FILTERED: 'AI_CONTENT_FILTERED',

  // 서버 관련
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

/**
 * 에러 코드별 메시지
 */
export const API_ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  UNAUTHORIZED: '로그인이 필요합니다.',
  INVALID_TOKEN: '유효하지 않은 인증 토큰입니다.',
  SESSION_EXPIRED: '세션이 만료되었습니다. 다시 로그인해주세요.',
  VALIDATION_ERROR: '입력값이 유효하지 않습니다.',
  INVALID_INPUT: '잘못된 입력입니다.',
  NOT_FOUND: '요청한 리소스를 찾을 수 없습니다.',
  ALREADY_EXISTS: '이미 존재하는 리소스입니다.',
  RATE_LIMIT_EXCEEDED: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
  DAILY_LIMIT_EXCEEDED: '오늘의 생성 횟수를 모두 사용했습니다.',
  QUOTA_EXCEEDED: '할당량을 초과했습니다.',
  AI_GENERATION_FAILED: '콘텐츠 생성에 실패했습니다.',
  AI_TIMEOUT: '콘텐츠 생성 시간이 초과되었습니다.',
  AI_CONTENT_FILTERED: '생성된 콘텐츠가 필터링되었습니다.',
  INTERNAL_ERROR: '서버 오류가 발생했습니다.',
  SERVICE_UNAVAILABLE: '서비스를 일시적으로 사용할 수 없습니다.',
};
