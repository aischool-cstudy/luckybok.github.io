import { describe, it, expect } from 'vitest';
import {
  parseContentJson,
  getLanguageLabel,
  getDifficultyLabel,
  getTargetAudienceLabel,
} from '@/lib/history-utils';

describe('history-utils', () => {
  describe('parseContentJson', () => {
    it('유효한 JSON 문자열을 파싱해야 한다', () => {
      const jsonString = JSON.stringify({
        title: '테스트 제목',
        learningObjectives: ['목표1', '목표2'],
      });
      const result = parseContentJson(jsonString);
      expect(result).toEqual({
        title: '테스트 제목',
        learningObjectives: ['목표1', '목표2'],
      });
    });

    it('유효하지 않은 JSON 문자열은 null을 반환해야 한다', () => {
      const result = parseContentJson('invalid json');
      expect(result).toBeNull();
    });

    it('빈 문자열은 null을 반환해야 한다', () => {
      const result = parseContentJson('');
      expect(result).toBeNull();
    });
  });

  describe('getLanguageLabel', () => {
    it.each([
      ['python', 'Python'],
      ['javascript', 'JavaScript'],
      ['typescript', 'TypeScript'],
      ['java', 'Java'],
      ['sql', 'SQL'],
      ['go', 'Go'],
    ])('%s는 %s를 반환해야 한다', (input, expected) => {
      expect(getLanguageLabel(input)).toBe(expected);
    });

    it('알 수 없는 언어는 그대로 반환해야 한다', () => {
      expect(getLanguageLabel('rust')).toBe('rust');
    });
  });

  describe('getDifficultyLabel', () => {
    it.each([
      ['beginner', '입문'],
      ['intermediate', '중급'],
      ['advanced', '고급'],
      ['BEGINNER', '입문'],
      ['INTERMEDIATE', '중급'],
      ['ADVANCED', '고급'],
    ])('%s는 %s를 반환해야 한다', (input, expected) => {
      expect(getDifficultyLabel(input)).toBe(expected);
    });

    it('알 수 없는 난이도는 그대로 반환해야 한다', () => {
      expect(getDifficultyLabel('expert')).toBe('expert');
    });
  });

  describe('getTargetAudienceLabel', () => {
    it.each([
      ['non_tech_worker', '비전공 직장인'],
      ['junior_developer', '주니어 개발자'],
      ['manager', '관리자/임원'],
      ['career_changer', '커리어 전환자'],
    ])('%s는 %s를 반환해야 한다', (input, expected) => {
      expect(getTargetAudienceLabel(input)).toBe(expected);
    });

    it('알 수 없는 대상자는 그대로 반환해야 한다', () => {
      expect(getTargetAudienceLabel('unknown')).toBe('unknown');
    });
  });
});
