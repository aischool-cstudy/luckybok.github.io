/**
 * 지원 프로그래밍 언어 설정
 */
export const programmingLanguages = [
  {
    id: 'python',
    name: 'Python',
    icon: '🐍',
    priority: 0, // P0
    targetAudience: '비전공자, 데이터 분석',
    analogyDomain: '엑셀, 업무 자동화',
    color: '#3776ab',
  },
  {
    id: 'javascript',
    name: 'JavaScript',
    icon: '🌐',
    priority: 0, // P0
    targetAudience: '웹 개발 입문',
    analogyDomain: '웹페이지, 인터랙션',
    color: '#f7df1e',
  },
  {
    id: 'sql',
    name: 'SQL',
    icon: '📊',
    priority: 1, // P1
    targetAudience: '기획자, 마케터',
    analogyDomain: '엑셀 필터, 피벗',
    color: '#00758f',
  },
  {
    id: 'java',
    name: 'Java',
    icon: '☕',
    priority: 1, // P1
    targetAudience: '기업 개발자',
    analogyDomain: '설계도, 공장',
    color: '#007396',
  },
  {
    id: 'typescript',
    name: 'TypeScript',
    icon: '📘',
    priority: 2, // P2
    targetAudience: '주니어 개발자',
    analogyDomain: 'JS + 계약서',
    color: '#3178c6',
  },
  {
    id: 'go',
    name: 'Go',
    icon: '🔷',
    priority: 2, // P2
    targetAudience: '백엔드 개발자',
    analogyDomain: '효율적 공장',
    color: '#00add8',
  },
] as const;

export type ProgrammingLanguageId = (typeof programmingLanguages)[number]['id'];

export function getLanguageById(id: ProgrammingLanguageId) {
  return programmingLanguages.find((lang) => lang.id === id);
}

export function getActiveLanguages(maxPriority = 2) {
  return programmingLanguages.filter((lang) => lang.priority <= maxPriority);
}
