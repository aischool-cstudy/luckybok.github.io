import { z } from 'zod';

// 지원 프로그래밍 언어
export const SUPPORTED_LANGUAGES = [
  'python',
  'javascript',
  'sql',
  'java',
  'typescript',
  'go',
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// 난이도 레벨
export const DIFFICULTY_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

// 타겟 오디언스 (성인 학습자 페르소나)
export const TARGET_AUDIENCES = [
  'non_tech_worker', // 비전공 직장인
  'junior_developer', // 주니어 개발자
  'manager', // 관리자/임원
  'career_changer', // 커리어 전환자
] as const;
export type TargetAudience = (typeof TARGET_AUDIENCES)[number];

// 콘텐츠 생성 요청 스키마
export const generateContentSchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGES, {
    errorMap: () => ({ message: '지원하지 않는 프로그래밍 언어입니다.' }),
  }),
  topic: z
    .string()
    .min(2, '주제는 최소 2자 이상이어야 합니다.')
    .max(200, '주제는 200자를 초과할 수 없습니다.'),
  difficulty: z.enum(DIFFICULTY_LEVELS, {
    errorMap: () => ({ message: '올바른 난이도를 선택해주세요.' }),
  }),
  targetAudience: z.enum(TARGET_AUDIENCES, {
    errorMap: () => ({ message: '올바른 학습자 유형을 선택해주세요.' }),
  }),
  additionalContext: z
    .string()
    .max(500, '추가 컨텍스트는 500자를 초과할 수 없습니다.')
    .optional(),
});

export type GenerateContentInput = z.infer<typeof generateContentSchema>;

// 코드 예제 스키마
export const codeExampleSchema = z.object({
  title: z.string(),
  description: z.string(),
  code: z.string(),
  explanation: z.string(),
  languageVersion: z.string().optional(),
});

export type CodeExample = z.infer<typeof codeExampleSchema>;

// 퀴즈 문항 스키마
export const quizQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).length(4),
  correctAnswer: z.number().min(0).max(3),
  explanation: z.string(),
});

export type QuizQuestion = z.infer<typeof quizQuestionSchema>;

// AI 생성 콘텐츠 응답 스키마
export const generatedContentSchema = z.object({
  title: z.string(),
  summary: z.string(),
  introduction: z.string(),
  sections: z.array(
    z.object({
      heading: z.string(),
      content: z.string(),
      codeExample: codeExampleSchema.optional(),
    })
  ),
  realWorldAnalogy: z.string(),
  practicalApplication: z.string(),
  codeExamples: z.array(codeExampleSchema),
  quiz: z.array(quizQuestionSchema),
  keyTakeaways: z.array(z.string()),
  furtherReading: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
      })
    )
    .optional(),
});

export type GeneratedContent = z.infer<typeof generatedContentSchema>;

// 언어별 레이블 (한국어)
export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  python: 'Python',
  javascript: 'JavaScript',
  sql: 'SQL',
  java: 'Java',
  typescript: 'TypeScript',
  go: 'Go',
};

// 난이도별 레이블 (한국어)
export const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  beginner: '입문',
  intermediate: '중급',
  advanced: '고급',
};

// 타겟 오디언스별 레이블 (한국어)
export const TARGET_AUDIENCE_LABELS: Record<TargetAudience, string> = {
  non_tech_worker: '비전공 직장인',
  junior_developer: '주니어 개발자',
  manager: '관리자/임원',
  career_changer: '커리어 전환자',
};

// 언어별 비유 도메인 (PRD 기반)
export const LANGUAGE_ANALOGY_DOMAINS: Record<SupportedLanguage, string> = {
  python: '엑셀과 업무 자동화',
  javascript: '웹페이지와 인터랙션',
  sql: '엑셀 필터와 피벗 테이블',
  java: '설계도와 공장',
  typescript: 'JavaScript에 계약서 추가',
  go: '효율적인 공장',
};
