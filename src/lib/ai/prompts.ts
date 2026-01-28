/**
 * AI 콘텐츠 생성을 위한 프롬프트 템플릿
 */

import {
  DIFFICULTY_LABELS,
  TARGET_AUDIENCE_LABELS,
  TARGET_AUDIENCE_DESCRIPTIONS,
  type DifficultyLevel,
  type TargetAudience,
} from '@/config/constants';

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
- 한국어 설명, 영어 코드/주석
`;

export interface ContentPromptParams {
  language: string;
  topic: string;
  difficulty: DifficultyLevel;
  targetAudience: TargetAudience;
}

export function createContentPrompt(params: ContentPromptParams): string {
  const difficultyLabel = DIFFICULTY_LABELS[params.difficulty];
  const targetLabel = TARGET_AUDIENCE_LABELS[params.targetAudience];
  const targetDescription = TARGET_AUDIENCE_DESCRIPTIONS[params.targetAudience];

  return `## 요청
${params.language}로 "${params.topic}" 주제의 교육 콘텐츠를 작성해주세요.

**난이도**: ${difficultyLabel}
**대상**: ${targetLabel} (${targetDescription})

## 출력 구조
1. **제목** - SEO 최적화된 매력적인 제목
2. **학습 목표** - 3-5개의 구체적인 학습 목표
3. **핵심 개념 설명** - 비유를 활용한 쉬운 설명
4. **예제 코드** - 주석이 포함된 실행 가능한 코드
5. **연습 문제** - 3개의 단계별 문제
6. **핵심 요약** - 한 눈에 보는 정리
`;
}
