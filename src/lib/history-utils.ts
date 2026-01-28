import type { GeneratedContent as GeneratedContentSchema } from '@/lib/ai/schemas';

/**
 * DB의 content JSON을 GeneratedContentSchema 타입으로 파싱
 */
export function parseContentJson(contentString: string): GeneratedContentSchema | null {
  try {
    return JSON.parse(contentString) as GeneratedContentSchema;
  } catch {
    return null;
  }
}

/**
 * 언어 라벨 변환
 */
export function getLanguageLabel(language: string): string {
  const labels: Record<string, string> = {
    python: 'Python',
    javascript: 'JavaScript',
    sql: 'SQL',
    java: 'Java',
    typescript: 'TypeScript',
    go: 'Go',
  };
  return labels[language] || language;
}

/**
 * 난이도 라벨 변환
 */
export function getDifficultyLabel(difficulty: string): string {
  const labels: Record<string, string> = {
    beginner: '입문',
    intermediate: '중급',
    advanced: '고급',
  };
  return labels[difficulty.toLowerCase()] || difficulty;
}

/**
 * 대상자 라벨 변환
 */
export function getTargetAudienceLabel(targetAudience: string): string {
  const labels: Record<string, string> = {
    non_tech_worker: '비전공 직장인',
    junior_developer: '주니어 개발자',
    manager: '관리자/임원',
    career_changer: '커리어 전환자',
  };
  return labels[targetAudience] || targetAudience;
}
