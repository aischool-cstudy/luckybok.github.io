import { z } from 'zod';
import {
  SUPPORTED_LANGUAGES,
  DIFFICULTY_LEVELS,
  TARGET_AUDIENCES,
} from '@/config/constants';

/**
 * 콘텐츠 생성 입력 스키마
 * - 소문자 표준 사용 (constants.ts와 일치)
 */
export const generateContentInputSchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGES),
  topic: z.string().min(2, '주제는 2자 이상이어야 합니다').max(200),
  difficulty: z.enum(DIFFICULTY_LEVELS),
  targetAudience: z.enum(TARGET_AUDIENCES),
});

export type GenerateContentInput = z.infer<typeof generateContentInputSchema>;

/**
 * 생성된 콘텐츠 구조 스키마 (AI 구조화 출력용)
 */
export const generatedContentSchema = z.object({
  title: z.string().describe('SEO 최적화된 제목'),
  learningObjectives: z
    .array(z.string())
    .min(3)
    .max(5)
    .describe('학습 목표 3-5개'),
  explanation: z.string().describe('핵심 개념 설명 (비유 포함)'),
  codeExample: z.string().describe('예제 코드 (마크다운 코드 블록)'),
  exercises: z
    .array(
      z.object({
        question: z.string(),
        hint: z.string().optional(),
        difficulty: z.enum(['easy', 'medium', 'hard']),
      })
    )
    .length(3)
    .describe('연습 문제 3개'),
  summary: z.string().describe('핵심 요약'),
  estimatedReadTime: z.number().describe('예상 읽기 시간 (분)'),
});

export type GeneratedContent = z.infer<typeof generatedContentSchema>;

/**
 * 퀴즈 생성 스키마
 */
export const quizSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string(),
      options: z.array(z.string()).length(4),
      correctIndex: z.number().min(0).max(3),
      explanation: z.string(),
    })
  ),
});

export type Quiz = z.infer<typeof quizSchema>;
