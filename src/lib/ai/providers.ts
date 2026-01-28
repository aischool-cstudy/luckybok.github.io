import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';

/**
 * AI 모델 프로바이더 설정
 */
export const models = {
  // 고품질 콘텐츠 생성 (복잡한 설명, 상세 예제)
  premium: anthropic('claude-sonnet-4-20250514'),
  // 일반 콘텐츠 생성
  standard: anthropic('claude-sonnet-4-20250514'),
  // 빠른 응답 (간단한 코드 검증, 퀴즈 생성)
  fast: openai('gpt-4o-mini'),
  // 임베딩
  embedding: openai.embedding('text-embedding-3-large'),
} as const;

export type ModelKey = keyof typeof models;
