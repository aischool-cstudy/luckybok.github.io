/**
 * AI 콘텐츠 생성을 위한 프롬프트 템플릿
 *
 * 성인 학습자 4대 페르소나별 맞춤 교육 콘텐츠 생성
 * - 비전공 직장인: 엑셀, 업무 자동화 비유
 * - 주니어 개발자: 언어 비교, 아키텍처 비유
 * - 관리자/임원: 조직, 프로세스 비유
 * - 커리어 전환자: 요리, 건축 등 범용 비유
 */

import {
  DIFFICULTY_LABELS,
  DIFFICULTY_DESCRIPTIONS,
  TARGET_AUDIENCE_LABELS,
  TARGET_AUDIENCE_DESCRIPTIONS,
  TARGET_AUDIENCE_ANALOGY_DOMAINS,
  LANGUAGE_LABELS,
  type DifficultyLevel,
  type TargetAudience,
  type SupportedLanguage,
} from '@/config/constants';

// ─────────────────────────────────────────────────────────────────
// 페르소나별 비유 예시 (Few-shot Learning)
// ─────────────────────────────────────────────────────────────────

const ANALOGY_EXAMPLES: Record<TargetAudience, { concept: string; analogy: string }[]> = {
  non_tech: [
    {
      concept: '변수(Variable)',
      analogy: '엑셀에서 셀에 값을 저장하는 것처럼, 변수는 데이터를 담는 이름표가 붙은 상자입니다. A1 셀에 "100"을 넣듯이, x = 100은 x라는 상자에 100을 넣는 것입니다.',
    },
    {
      concept: '함수(Function)',
      analogy: '엑셀의 SUM() 함수처럼, 프로그래밍 함수도 입력을 받아 정해진 작업을 수행하고 결과를 반환합니다. =SUM(A1:A10)이 합계를 구하듯, calculate_total(items)이 총액을 계산합니다.',
    },
    {
      concept: '조건문(If-Else)',
      analogy: '엑셀의 IF 함수와 동일합니다. =IF(A1>100, "높음", "낮음")처럼, 프로그래밍에서도 조건에 따라 다른 결과를 반환합니다.',
    },
  ],
  junior_dev: [
    {
      concept: '클로저(Closure)',
      analogy: '함수가 자신이 생성된 환경(스코프)을 기억하는 것입니다. C언어의 static 변수와 비슷하지만, 함수마다 독립적인 상태를 가질 수 있습니다.',
    },
    {
      concept: '비동기(Async)',
      analogy: '동기 방식이 은행 창구에서 차례대로 기다리는 것이라면, 비동기는 번호표를 받고 다른 일을 하다가 호출되면 돌아오는 방식입니다.',
    },
    {
      concept: '타입 시스템',
      analogy: 'C/Java의 정적 타입처럼 컴파일 타임에 에러를 잡지만, 타입 추론으로 boilerplate를 줄입니다.',
    },
  ],
  manager: [
    {
      concept: 'API',
      analogy: '부서 간 업무 요청 프로세스와 같습니다. 마케팅팀이 개발팀에 요청할 때 정해진 양식(API 규격)대로 요청하면, 개발팀은 정해진 형태로 결과를 반환합니다.',
    },
    {
      concept: '마이크로서비스',
      analogy: '대기업의 사업부 조직과 같습니다. 각 사업부(서비스)가 독립적으로 운영되면서, 필요할 때 협업(API 호출)합니다. 한 부서의 문제가 전체를 마비시키지 않습니다.',
    },
    {
      concept: '데이터베이스',
      analogy: '회사의 중앙 문서 보관소입니다. 모든 부서가 접근할 수 있고, 권한에 따라 열람/수정이 제한되며, 변경 이력이 모두 기록됩니다.',
    },
  ],
  career_changer: [
    {
      concept: '알고리즘',
      analogy: '요리 레시피와 같습니다. 재료(입력)를 정해진 순서대로 처리하면 음식(출력)이 완성됩니다. 같은 재료도 레시피에 따라 다른 결과가 나옵니다.',
    },
    {
      concept: '객체 지향',
      analogy: '건축의 설계도(클래스)와 실제 건물(객체)의 관계입니다. 아파트 설계도 하나로 여러 동을 지을 수 있듯, 클래스 하나로 여러 객체를 만듭니다.',
    },
    {
      concept: '버전 관리',
      analogy: '문서 작업할 때 "최종.doc", "최종_수정.doc", "진짜최종.doc" 대신 변경 이력을 체계적으로 관리하는 시스템입니다.',
    },
  ],
};

// ─────────────────────────────────────────────────────────────────
// 언어별 코드 스타일 가이드
// ─────────────────────────────────────────────────────────────────

const LANGUAGE_STYLE_GUIDES: Record<SupportedLanguage, string> = {
  python: `
- PEP 8 스타일 가이드 준수
- snake_case 변수/함수명 사용
- Type hints 포함 (def func(x: int) -> str:)
- docstring으로 함수 설명
- f-string 사용 권장
- with 문으로 리소스 관리`,

  javascript: `
- ES6+ 최신 문법 사용
- const/let 사용 (var 금지)
- 화살표 함수 적절히 활용
- 템플릿 리터럴 사용
- async/await 비동기 처리
- 모듈 시스템 (import/export)`,

  typescript: `
- 명시적 타입 선언
- interface 활용
- strict 모드 기준
- 제네릭 적절히 활용
- enum보다 const assertions
- any 타입 지양`,

  sql: `
- 키워드 대문자 (SELECT, FROM, WHERE)
- 들여쓰기로 가독성 확보
- 명시적 JOIN 구문 사용
- 컬럼명 snake_case
- 쿼리 설명 주석 포함`,

  java: `
- Google Java Style Guide 기준
- camelCase 메소드/변수명
- PascalCase 클래스명
- Javadoc 주석 포함
- 명시적 접근 제어자
- try-with-resources 사용`,

  go: `
- gofmt 스타일 준수
- 짧은 변수명 (관례)
- 에러 반환 및 처리
- 포인터 vs 값 수신자 명확히
- 고루틴/채널 예제 시 주의사항 포함`,
};

// ─────────────────────────────────────────────────────────────────
// 난이도별 콘텐츠 깊이 가이드
// ─────────────────────────────────────────────────────────────────

const DIFFICULTY_DEPTH_GUIDES: Record<DifficultyLevel, string> = {
  beginner: `
- 전문 용어 사용 최소화 (사용 시 반드시 설명)
- 단계별로 천천히 설명
- 코드 한 줄씩 상세 주석
- 기초 개념부터 차근차근
- 실수하기 쉬운 부분 강조
- 실행 결과 예시 포함`,

  intermediate: `
- 기본 용어는 알고 있다고 가정
- 개념 간 연결 관계 설명
- 베스트 프랙티스 소개
- 실무에서 자주 마주치는 패턴
- 성능 고려사항 간단히 언급
- 확장 가능한 코드 구조`,

  advanced: `
- 심화 개념 및 내부 동작 원리
- 엣지 케이스 및 예외 상황
- 성능 최적화 기법
- 아키텍처 패턴 및 설계 원칙
- 실제 프로덕션 레벨 코드
- 트레이드오프 분석`,
};

// ─────────────────────────────────────────────────────────────────
// 시스템 프롬프트
// ─────────────────────────────────────────────────────────────────

export const CONTENT_SYSTEM_PROMPT = `당신은 **CodeGen AI**의 전문 코딩 교육 콘텐츠 작성자입니다.
성인 학습자를 위한 실무 중심의 교육 콘텐츠를 생성합니다.

## 🎯 핵심 미션
성인 학습자가 **10분 안에** 새로운 프로그래밍 개념을 이해하고 실무에 적용할 수 있도록 돕습니다.

## 📋 콘텐츠 작성 원칙

### 1. 비유 우선 (Analogy-First)
- 학습자의 경험 영역과 연결하는 비유로 시작
- 추상적 개념을 구체적 경험으로 매핑
- 비유 → 개념 → 코드 순서로 설명

### 2. 실무 중심 (Practical-First)
- 현업에서 바로 쓸 수 있는 예제
- "왜 이게 필요한가?"에 대한 명확한 답
- 실제 서비스에서 볼 수 있는 코드 패턴

### 3. 점진적 복잡도 (Progressive Complexity)
- 가장 단순한 형태로 시작
- 한 번에 하나의 개념만 추가
- "이전 예제 + 새 개념" 방식으로 확장

### 4. 실행 가능한 코드 (Runnable Code)
- 모든 코드는 복사해서 바로 실행 가능
- 필요한 import/setup 모두 포함
- 예상 출력 결과 주석으로 표시

## ✅ 품질 체크리스트
□ 학습자의 경험과 연결되는 비유가 있는가?
□ 코드를 복사해서 바로 실행할 수 있는가?
□ 한국어 설명이 자연스러운가?
□ 학습 목표가 측정 가능한가?
□ 연습 문제가 배운 내용을 확인하는가?

## 📝 출력 형식
- 마크다운 형식
- 코드 블록에 언어 명시 (\`\`\`python)
- 한국어 설명, 영어 코드 (주석은 한국어 가능)
- 이모지 적절히 활용하여 가독성 향상
`;

// ─────────────────────────────────────────────────────────────────
// 콘텐츠 생성 프롬프트 생성 함수
// ─────────────────────────────────────────────────────────────────

export interface ContentPromptParams {
  language: string;
  topic: string;
  difficulty: DifficultyLevel;
  targetAudience: TargetAudience;
}

export function createContentPrompt(params: ContentPromptParams): string {
  const lang = params.language as SupportedLanguage;
  const difficultyLabel = DIFFICULTY_LABELS[params.difficulty];
  const difficultyDesc = DIFFICULTY_DESCRIPTIONS[params.difficulty];
  const targetLabel = TARGET_AUDIENCE_LABELS[params.targetAudience];
  const targetDesc = TARGET_AUDIENCE_DESCRIPTIONS[params.targetAudience];
  const analogyDomain = TARGET_AUDIENCE_ANALOGY_DOMAINS[params.targetAudience];

  // 페르소나별 비유 예시 가져오기
  const examples = ANALOGY_EXAMPLES[params.targetAudience];
  const exampleText = examples
    .map((ex, i) => `  ${i + 1}. **${ex.concept}**: "${ex.analogy}"`)
    .join('\n');

  // 언어별 스타일 가이드
  const styleGuide = LANGUAGE_STYLE_GUIDES[lang] || '';

  // 난이도별 깊이 가이드
  const depthGuide = DIFFICULTY_DEPTH_GUIDES[params.difficulty];

  return `## 📌 콘텐츠 생성 요청

**프로그래밍 언어**: ${LANGUAGE_LABELS[lang] || params.language}
**주제**: ${params.topic}
**난이도**: ${difficultyLabel} - ${difficultyDesc}
**대상 학습자**: ${targetLabel}
  - ${targetDesc}
  - 비유 도메인: ${analogyDomain}

---

## 🎯 학습자 페르소나 비유 예시
이 학습자 유형에 적합한 비유 스타일:
${exampleText}

---

## 📝 언어별 코드 스타일 가이드
${styleGuide}

---

## 📊 난이도별 콘텐츠 깊이
${depthGuide}

---

## 📋 출력 구조 (필수)

1. **제목 (title)**
   - SEO 최적화된 매력적인 제목
   - "${params.topic}"을 포함
   - 학습자가 클릭하고 싶게 만드는 제목

2. **학습 목표 (learningObjectives)**
   - 3-5개의 구체적이고 측정 가능한 목표
   - "~할 수 있다" 형식으로 작성
   - 예: "for 루프를 사용해 리스트를 순회할 수 있다"

3. **핵심 개념 설명 (explanation)**
   - ${analogyDomain} 영역의 비유로 시작
   - 비유 → 개념 정의 → 실제 적용 순서
   - 마크다운 형식 (제목, 리스트, 강조 활용)

4. **예제 코드 (codeExample)**
   - 실행 가능한 완전한 코드
   - 주석으로 각 줄 설명
   - 예상 출력 결과 포함
   - 마크다운 코드 블록 사용

5. **연습 문제 (exercises)**
   - 3개의 단계별 문제 (easy → medium → hard)
   - 각 문제에 힌트 제공
   - 배운 내용을 직접 적용하는 문제

6. **핵심 요약 (summary)**
   - 5줄 이내로 정리
   - 가장 중요한 포인트 3-5개
   - 다음 학습 주제 제안

7. **예상 읽기 시간 (estimatedReadTime)**
   - 분 단위 숫자만 (예: 8)
`;
}

// ─────────────────────────────────────────────────────────────────
// 퀴즈 생성 프롬프트
// ─────────────────────────────────────────────────────────────────

export interface QuizPromptParams {
  topic: string;
  language: string;
  difficulty: DifficultyLevel;
  contentSummary?: string;
  questionCount?: number;
}

export function createQuizPrompt(params: QuizPromptParams): string {
  const questionCount = params.questionCount || 5;
  const difficultyLabel = DIFFICULTY_LABELS[params.difficulty];

  return `## 퀴즈 생성 요청

**주제**: ${params.topic}
**언어**: ${params.language}
**난이도**: ${difficultyLabel}
**문제 수**: ${questionCount}개

${params.contentSummary ? `### 참고할 콘텐츠 요약:\n${params.contentSummary}\n` : ''}

---

## 퀴즈 작성 지침

1. **객관식 4지선다** 형식
2. 각 문제에 명확한 정답 하나
3. 오답도 그럴듯하게 (함정 선택지 포함)
4. 정답에 대한 상세한 해설 포함
5. 난이도에 맞는 개념 수준

## 출력 형식
각 문제는 다음 구조로:
- question: 질문 텍스트
- options: 4개의 선택지 배열
- correctIndex: 정답 인덱스 (0-3)
- explanation: 정답 해설
`;
}

export const QUIZ_SYSTEM_PROMPT = `당신은 프로그래밍 교육 전문 퀴즈 출제자입니다.
학습자의 이해도를 정확히 평가할 수 있는 양질의 문제를 만듭니다.

## 출제 원칙
1. 단순 암기가 아닌 이해도 테스트
2. 실무에서 마주칠 수 있는 상황 제시
3. 오답 선택지도 학습 기회 제공
4. 명확하고 모호하지 않은 질문

## 난이도별 문제 유형
- 입문: 기본 문법, 개념 정의
- 중급: 코드 실행 결과 예측, 버그 찾기
- 고급: 최적화, 아키텍처 결정, 트레이드오프
`;
