# AI 콘텐츠 생성 API 문서

> **Version**: 1.0.0
> **Last Updated**: 2026-01-31
> **Author**: ⚙️ Backend Expert Persona
> **Status**: Production Ready

---

## 목차

1. [개요](#개요)
2. [Server Actions](#server-actions)
3. [스트리밍 API](#스트리밍-api)
4. [요청/응답 스키마](#요청응답-스키마)
5. [에러 처리](#에러-처리)
6. [Rate Limiting](#rate-limiting)
7. [사용 예제](#사용-예제)

---

## 개요

### AI 모델 구성

| 모델 | 용도 | 특징 |
|------|------|------|
| **Claude Sonnet 4** | 기본 모델 | 고품질, 스트리밍 지원 |
| **GPT-4o Mini** | 폴백 모델 | 빠른 응답, 낮은 비용 |

### 지원 기능

- ✅ 실시간 스트리밍 출력
- ✅ 구조화된 콘텐츠 생성 (Zod 스키마)
- ✅ 다중 프로그래밍 언어 지원
- ✅ 학습자 수준별 맞춤 콘텐츠
- ✅ 크레딧/일일 한도 관리
- ✅ 생성 실패 시 크레딧 복구

---

## Server Actions

### generateContentStreaming

AI 콘텐츠를 스트리밍 방식으로 생성합니다.

**파일 위치**: `src/actions/generate.ts`

```typescript
'use server';

export async function generateContentStreaming(
  input: GenerateContentInput
): Promise<GenerateContentResult>
```

#### 입력 파라미터

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `language` | `ProgrammingLanguage` | ✅ | 프로그래밍 언어 |
| `topic` | `string` | ✅ | 학습 주제 (2-200자) |
| `difficulty` | `DifficultyLevel` | ✅ | 난이도 |
| `targetAudience` | `TargetAudience` | ✅ | 대상 학습자 |

#### 출력 결과

```typescript
// 성공 시
{
  success: true,
  data: {
    id: string;           // 생성된 콘텐츠 ID
    stream: ReadableStream<string>;  // 스트리밍 데이터
  }
}

// 실패 시
{
  success: false,
  error: string;          // 에러 메시지
  code?: string;          // 에러 코드
}
```

### generateContent (비스트리밍)

전체 콘텐츠를 한 번에 생성합니다.

```typescript
export async function generateContent(
  input: GenerateContentInput
): Promise<GenerateContentResult>
```

---

## 스트리밍 API

### API Route (대안)

Server Actions 대신 API Route를 사용해야 하는 경우:

**엔드포인트**: `POST /api/ai/stream`

```typescript
// src/app/api/ai/stream/route.ts

export async function POST(request: Request) {
  const body = await request.json();

  // 스트리밍 응답 반환
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

#### 요청 형식

```http
POST /api/ai/stream
Content-Type: application/json
Authorization: Bearer {access_token}

{
  "language": "PYTHON",
  "topic": "리스트 컴프리헨션",
  "difficulty": "INTERMEDIATE",
  "targetAudience": "NON_DEVELOPER"
}
```

#### 응답 형식 (Server-Sent Events)

```
data: {"type":"start","id":"content_123"}

data: {"type":"chunk","content":"# 파이썬 리스트 컴프리헨션"}

data: {"type":"chunk","content":"\n\n## 학습 목표"}

data: {"type":"chunk","content":"\n\n1. 리스트 컴프리헨션의 기본 문법 이해"}

...

data: {"type":"done","tokensUsed":1234,"generationTimeMs":5678}
```

---

## 요청/응답 스키마

### 입력 스키마

```typescript
// src/lib/ai/schemas.ts

import { z } from 'zod';

export const ProgrammingLanguage = z.enum([
  'PYTHON',
  'JAVASCRIPT',
  'TYPESCRIPT',
  'SQL',
  'JAVA',
  'GO'
]);

export const DifficultyLevel = z.enum([
  'BEGINNER',
  'INTERMEDIATE',
  'ADVANCED'
]);

export const TargetAudience = z.enum([
  'NON_DEVELOPER',     // 비전공 직장인
  'JUNIOR_DEVELOPER',  // 주니어 개발자
  'MANAGER',           // 관리자/임원
  'CAREER_CHANGER'     // 커리어 전환자
]);

export const GenerateContentSchema = z.object({
  language: ProgrammingLanguage,
  topic: z.string()
    .min(2, '주제는 2자 이상 입력해주세요')
    .max(200, '주제는 200자 이하로 입력해주세요'),
  difficulty: DifficultyLevel,
  targetAudience: TargetAudience,
});

export type GenerateContentInput = z.infer<typeof GenerateContentSchema>;
```

### 출력 스키마

```typescript
// 콘텐츠 구조 (DB 저장 시)
export const GeneratedContentSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  language: ProgrammingLanguage,
  topic: z.string(),
  difficulty: DifficultyLevel,
  targetAudience: TargetAudience,
  title: z.string().nullable(),
  content: z.string(),
  codeExamples: z.array(z.object({
    language: z.string(),
    code: z.string(),
    explanation: z.string().optional(),
  })).nullable(),
  quiz: z.array(z.object({
    question: z.string(),
    options: z.array(z.string()),
    correctAnswer: z.number(),
    explanation: z.string(),
  })).nullable(),
  modelUsed: z.string().nullable(),
  tokensUsed: z.number().nullable(),
  generationTimeMs: z.number().nullable(),
  createdAt: z.string().datetime(),
});
```

### 언어별 설정

```typescript
// src/config/constants.ts

export const LANGUAGE_CONFIG = {
  PYTHON: {
    name: 'Python',
    extension: 'py',
    highlighter: 'python',
    analogy: '엑셀, 업무 자동화',
  },
  JAVASCRIPT: {
    name: 'JavaScript',
    extension: 'js',
    highlighter: 'javascript',
    analogy: '웹페이지, 인터랙션',
  },
  TYPESCRIPT: {
    name: 'TypeScript',
    extension: 'ts',
    highlighter: 'typescript',
    analogy: 'JavaScript + 계약서',
  },
  SQL: {
    name: 'SQL',
    extension: 'sql',
    highlighter: 'sql',
    analogy: '엑셀 필터, 피벗',
  },
  JAVA: {
    name: 'Java',
    extension: 'java',
    highlighter: 'java',
    analogy: '설계도, 공장',
  },
  GO: {
    name: 'Go',
    extension: 'go',
    highlighter: 'go',
    analogy: '효율적 공장',
  },
} as const;
```

---

## 에러 처리

### 에러 코드

| 코드 | HTTP | 메시지 | 원인 |
|------|------|--------|------|
| `AUTH_REQUIRED` | 401 | 로그인이 필요합니다 | 미인증 |
| `INVALID_INPUT` | 400 | 입력값이 올바르지 않습니다 | Zod 검증 실패 |
| `RATE_LIMIT_EXCEEDED` | 429 | 요청이 너무 많습니다 | Rate Limit 초과 |
| `INSUFFICIENT_CREDITS` | 402 | 크레딧이 부족합니다 | 잔액 부족 |
| `DAILY_LIMIT_EXCEEDED` | 402 | 일일 생성 한도 초과 | 일일 한도 |
| `AI_GENERATION_FAILED` | 500 | 콘텐츠 생성에 실패했습니다 | AI API 오류 |
| `CONTENT_TOO_LONG` | 400 | 콘텐츠가 너무 깁니다 | 토큰 초과 |

### 에러 응답 형식

```typescript
interface ErrorResponse {
  success: false;
  error: string;      // 사용자 친화적 메시지 (한국어)
  code?: string;      // 에러 코드
  details?: {
    field?: string;   // 오류 필드
    reason?: string;  // 상세 원인
  };
}
```

### 에러 처리 예시

```typescript
// Server Action에서 에러 처리
export async function generateContentStreaming(input: GenerateContentInput) {
  try {
    // 인증 확인
    const user = await auth();
    if (!user) {
      return { success: false, error: '로그인이 필요합니다', code: 'AUTH_REQUIRED' };
    }

    // Rate Limit 확인
    const rateLimitResult = await checkRateLimit(
      user.id,
      'ai_generate',
      RATE_LIMIT_PRESETS.AI_GENERATE
    );
    if (!rateLimitResult.allowed) {
      return {
        success: false,
        error: getRateLimitErrorMessage(rateLimitResult),
        code: 'RATE_LIMIT_EXCEEDED',
      };
    }

    // 크레딧/한도 확인
    const creditResult = await useGenerationCredit(user.id);
    if (!creditResult.success) {
      return {
        success: false,
        error: creditResult.error,
        code: creditResult.code,
      };
    }

    // 입력 검증
    const validatedInput = GenerateContentSchema.safeParse(input);
    if (!validatedInput.success) {
      return {
        success: false,
        error: '입력값이 올바르지 않습니다',
        code: 'INVALID_INPUT',
        details: validatedInput.error.flatten(),
      };
    }

    // AI 생성 진행...
  } catch (error) {
    // 크레딧 복구
    await restoreGenerationCredit(user.id);

    return {
      success: false,
      error: '콘텐츠 생성에 실패했습니다. 다시 시도해주세요.',
      code: 'AI_GENERATION_FAILED',
    };
  }
}
```

---

## Rate Limiting

### 설정

| 프리셋 | 윈도우 | 최대 요청 | 식별자 |
|--------|--------|----------|--------|
| `AI_GENERATE` | 1분 | 20회 | 사용자 ID |

### 응답 헤더

```http
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 15
X-RateLimit-Reset: 1706600000
```

### 초과 시 응답

```json
{
  "success": false,
  "error": "요청이 너무 많습니다. 45초 후 다시 시도해주세요.",
  "code": "RATE_LIMIT_EXCEEDED"
}
```

---

## 사용 예제

### React 클라이언트 (스트리밍)

```tsx
// src/components/features/generate/generate-form.tsx
'use client';

import { useState, useCallback } from 'react';
import { generateContentStreaming } from '@/actions/generate';

export function GenerateForm() {
  const [content, setContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async (input: GenerateContentInput) => {
    setIsGenerating(true);
    setContent('');
    setError(null);

    try {
      const result = await generateContentStreaming(input);

      if (!result.success) {
        setError(result.error);
        return;
      }

      // 스트리밍 데이터 처리
      const reader = result.data.stream.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        setContent(prev => prev + chunk);
      }
    } catch (err) {
      setError('콘텐츠 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return (
    <div>
      {/* 폼 UI */}
      {error && <div className="text-red-500">{error}</div>}
      {isGenerating && <LoadingSpinner />}
      {content && <ContentDisplay content={content} />}
    </div>
  );
}
```

### Server Action 직접 호출

```typescript
// 서버 컴포넌트에서 사용
import { generateContent } from '@/actions/generate';

export default async function GeneratePage() {
  const result = await generateContent({
    language: 'PYTHON',
    topic: '리스트 컴프리헨션',
    difficulty: 'INTERMEDIATE',
    targetAudience: 'NON_DEVELOPER',
  });

  if (!result.success) {
    return <ErrorMessage message={result.error} />;
  }

  return <ContentDisplay content={result.data.content} />;
}
```

### API 클라이언트 (외부 연동용)

```typescript
// 향후 팀 API 키 사용 시
const response = await fetch('/api/ai/stream', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'team_api_key_xxx',
  },
  body: JSON.stringify({
    language: 'PYTHON',
    topic: '데코레이터',
    difficulty: 'ADVANCED',
    targetAudience: 'JUNIOR_DEVELOPER',
  }),
});

const reader = response.body.getReader();
// 스트리밍 처리...
```

---

## AI 모델 설정

### 프롬프트 템플릿

```typescript
// src/lib/ai/prompts.ts

export const CONTENT_SYSTEM_PROMPT = `당신은 성인 학습자를 위한 전문 코딩 교육 콘텐츠 작성자입니다.

## 핵심 원칙
1. **비유 활용**: 타겟 학습자의 경험 도메인과 연결
   - 비전공자 → 엑셀, 업무 자동화
   - 관리자 → 조직, 프로세스
   - 커리어 전환자 → 요리, 건축 등 범용 비유

2. **실무 중심**: 현업에서 바로 쓸 수 있는 예제
3. **단계적 설명**: 개념 → 비유 → 코드 → 실습
4. **코드 검증**: 모든 코드는 실행 가능해야 함

## 출력 형식
- 마크다운 형식
- 코드 블록에 언어 명시
- 한국어 설명, 영어 코드/주석`;

export const createContentPrompt = (params: GenerateContentInput) => `
## 요청
${LANGUAGE_CONFIG[params.language].name}로 "${params.topic}" 주제의 교육 콘텐츠를 작성해주세요.

**난이도**: ${params.difficulty}
**대상**: ${params.targetAudience}
**비유 도메인**: ${LANGUAGE_CONFIG[params.language].analogy}

## 출력 구조
1. 제목 (SEO 최적화)
2. 학습 목표 (3-5개)
3. 핵심 개념 설명 (비유 포함)
4. 예제 코드 (주석 포함)
5. 연습 문제 (3개)
6. 핵심 요약
`;
```

### 모델 파라미터

```typescript
// src/lib/ai/providers.ts

export const AI_CONFIG = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4000,
  temperature: 0.7,
  timeout: 60000,      // 60초
  retry: {
    maxAttempts: 3,
    initialDelayMs: 1000,
  },
};
```

---

## 모니터링

### 로깅

```typescript
// 생성 시작
logInfo('AI 콘텐츠 생성 시작', {
  userId: user.id,
  language: input.language,
  topic: input.topic,
  difficulty: input.difficulty,
});

// 생성 완료
logInfo('AI 콘텐츠 생성 완료', {
  contentId: content.id,
  tokensUsed: result.usage?.totalTokens,
  generationTimeMs: endTime - startTime,
});

// 생성 실패
logError('AI 콘텐츠 생성 실패', {
  userId: user.id,
  error: error.message,
  input,
});
```

### 메트릭

| 메트릭 | 설명 | 알림 조건 |
|--------|------|----------|
| `ai_generation_total` | 총 생성 횟수 | - |
| `ai_generation_success_rate` | 성공률 | < 95% |
| `ai_generation_latency_p95` | 95% 응답 시간 | > 30초 |
| `ai_tokens_used_daily` | 일일 토큰 사용량 | > 예산 80% |

---

## 참고 자료

- [Vercel AI SDK 문서](https://sdk.vercel.ai/docs)
- [Anthropic Claude API](https://docs.anthropic.com)
- [프롬프트 엔지니어링 가이드](./prompting-guide.md)
- [콘텐츠 품질 가이드](./content-quality.md)

---

*마지막 업데이트: 2026-01-31*
