import { describe, it, expect } from 'vitest';
import {
  SUPPORTED_LANGUAGES,
  LANGUAGE_LABELS,
  DIFFICULTY_LEVELS,
  DIFFICULTY_LABELS,
  DIFFICULTY_DESCRIPTIONS,
  TARGET_AUDIENCES,
  TARGET_AUDIENCE_LABELS,
  TARGET_AUDIENCE_DESCRIPTIONS,
  TARGET_AUDIENCE_ANALOGY_DOMAINS,
  LANGUAGE_OPTIONS,
  DIFFICULTY_OPTIONS,
  TARGET_AUDIENCE_OPTIONS,
} from '@/config/constants';

describe('constants', () => {
  describe('SUPPORTED_LANGUAGES', () => {
    it('모든 지원 언어가 정의되어 있어야 한다', () => {
      expect(SUPPORTED_LANGUAGES).toContain('python');
      expect(SUPPORTED_LANGUAGES).toContain('javascript');
      expect(SUPPORTED_LANGUAGES).toContain('sql');
      expect(SUPPORTED_LANGUAGES).toContain('java');
      expect(SUPPORTED_LANGUAGES).toContain('typescript');
      expect(SUPPORTED_LANGUAGES).toContain('go');
    });

    it('6개의 언어가 있어야 한다', () => {
      expect(SUPPORTED_LANGUAGES.length).toBe(6);
    });
  });

  describe('LANGUAGE_LABELS', () => {
    it('모든 언어에 대한 라벨이 정의되어 있어야 한다', () => {
      SUPPORTED_LANGUAGES.forEach((lang) => {
        expect(LANGUAGE_LABELS[lang]).toBeDefined();
        expect(typeof LANGUAGE_LABELS[lang]).toBe('string');
        expect(LANGUAGE_LABELS[lang].length).toBeGreaterThan(0);
      });
    });

    it('라벨이 올바르게 매핑되어야 한다', () => {
      expect(LANGUAGE_LABELS.python).toBe('Python');
      expect(LANGUAGE_LABELS.javascript).toBe('JavaScript');
      expect(LANGUAGE_LABELS.typescript).toBe('TypeScript');
    });
  });

  describe('DIFFICULTY_LEVELS', () => {
    it('모든 난이도가 정의되어 있어야 한다', () => {
      expect(DIFFICULTY_LEVELS).toContain('beginner');
      expect(DIFFICULTY_LEVELS).toContain('intermediate');
      expect(DIFFICULTY_LEVELS).toContain('advanced');
    });

    it('3개의 난이도가 있어야 한다', () => {
      expect(DIFFICULTY_LEVELS.length).toBe(3);
    });
  });

  describe('DIFFICULTY_LABELS', () => {
    it('모든 난이도에 대한 한국어 라벨이 정의되어 있어야 한다', () => {
      expect(DIFFICULTY_LABELS.beginner).toBe('입문');
      expect(DIFFICULTY_LABELS.intermediate).toBe('중급');
      expect(DIFFICULTY_LABELS.advanced).toBe('고급');
    });
  });

  describe('DIFFICULTY_DESCRIPTIONS', () => {
    it('모든 난이도에 대한 설명이 정의되어 있어야 한다', () => {
      DIFFICULTY_LEVELS.forEach((level) => {
        expect(DIFFICULTY_DESCRIPTIONS[level]).toBeDefined();
        expect(DIFFICULTY_DESCRIPTIONS[level].length).toBeGreaterThan(10);
      });
    });
  });

  describe('TARGET_AUDIENCES', () => {
    it('모든 타겟 오디언스가 정의되어 있어야 한다', () => {
      expect(TARGET_AUDIENCES).toContain('non_tech');
      expect(TARGET_AUDIENCES).toContain('junior_dev');
      expect(TARGET_AUDIENCES).toContain('manager');
      expect(TARGET_AUDIENCES).toContain('career_changer');
    });

    it('4개의 타겟 오디언스가 있어야 한다', () => {
      expect(TARGET_AUDIENCES.length).toBe(4);
    });
  });

  describe('TARGET_AUDIENCE_LABELS', () => {
    it('모든 타겟 오디언스에 대한 한국어 라벨이 정의되어 있어야 한다', () => {
      expect(TARGET_AUDIENCE_LABELS.non_tech).toBe('비전공 직장인');
      expect(TARGET_AUDIENCE_LABELS.junior_dev).toBe('주니어 개발자');
      expect(TARGET_AUDIENCE_LABELS.manager).toBe('관리자/임원');
      expect(TARGET_AUDIENCE_LABELS.career_changer).toBe('커리어 전환자');
    });
  });

  describe('TARGET_AUDIENCE_DESCRIPTIONS', () => {
    it('모든 타겟 오디언스에 대한 설명이 정의되어 있어야 한다', () => {
      TARGET_AUDIENCES.forEach((audience) => {
        expect(TARGET_AUDIENCE_DESCRIPTIONS[audience]).toBeDefined();
        expect(TARGET_AUDIENCE_DESCRIPTIONS[audience].length).toBeGreaterThan(10);
      });
    });
  });

  describe('TARGET_AUDIENCE_ANALOGY_DOMAINS', () => {
    it('모든 타겟 오디언스에 대한 비유 도메인이 정의되어 있어야 한다', () => {
      TARGET_AUDIENCES.forEach((audience) => {
        expect(TARGET_AUDIENCE_ANALOGY_DOMAINS[audience]).toBeDefined();
        expect(TARGET_AUDIENCE_ANALOGY_DOMAINS[audience].length).toBeGreaterThan(0);
      });
    });
  });

  describe('LANGUAGE_OPTIONS', () => {
    it('모든 언어에 대한 옵션이 생성되어야 한다', () => {
      expect(LANGUAGE_OPTIONS.length).toBe(SUPPORTED_LANGUAGES.length);
    });

    it('각 옵션이 value와 label을 가져야 한다', () => {
      LANGUAGE_OPTIONS.forEach((option) => {
        expect(option.value).toBeDefined();
        expect(option.label).toBeDefined();
        expect(SUPPORTED_LANGUAGES).toContain(option.value);
        expect(option.label).toBe(LANGUAGE_LABELS[option.value]);
      });
    });
  });

  describe('DIFFICULTY_OPTIONS', () => {
    it('모든 난이도에 대한 옵션이 생성되어야 한다', () => {
      expect(DIFFICULTY_OPTIONS.length).toBe(DIFFICULTY_LEVELS.length);
    });

    it('각 옵션이 value와 label을 가져야 한다', () => {
      DIFFICULTY_OPTIONS.forEach((option) => {
        expect(option.value).toBeDefined();
        expect(option.label).toBeDefined();
        expect(DIFFICULTY_LEVELS).toContain(option.value);
        expect(option.label).toBe(DIFFICULTY_LABELS[option.value]);
      });
    });
  });

  describe('TARGET_AUDIENCE_OPTIONS', () => {
    it('모든 타겟 오디언스에 대한 옵션이 생성되어야 한다', () => {
      expect(TARGET_AUDIENCE_OPTIONS.length).toBe(TARGET_AUDIENCES.length);
    });

    it('각 옵션이 value와 label을 가져야 한다', () => {
      TARGET_AUDIENCE_OPTIONS.forEach((option) => {
        expect(option.value).toBeDefined();
        expect(option.label).toBeDefined();
        expect(TARGET_AUDIENCES).toContain(option.value);
        expect(option.label).toBe(TARGET_AUDIENCE_LABELS[option.value]);
      });
    });
  });
});
