/**
 * 애플리케이션 공통 상수 정의 (Single Source of Truth)
 *
 * 이 파일은 언어, 난이도, 타겟 오디언스 등의 상수를 중앙에서 관리합니다.
 * 다른 파일에서는 이 파일의 상수를 import하여 사용합니다.
 */

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
