import { describe, it, expect } from 'vitest';
import {
  colors,
  spacing,
  fontSize,
  difficultyColors,
  difficultyLabels,
} from '@/lib/pdf/styles';

describe('PDF styles', () => {
  describe('colors', () => {
    it('모든 색상 값이 유효한 hex 코드여야 한다', () => {
      const hexRegex = /^#[0-9a-fA-F]{6}$/;
      Object.values(colors).forEach((color) => {
        expect(color).toMatch(hexRegex);
      });
    });

    it('필수 색상들이 정의되어 있어야 한다', () => {
      expect(colors.primary).toBeDefined();
      expect(colors.text).toBeDefined();
      expect(colors.background).toBeDefined();
      expect(colors.codeBackground).toBeDefined();
      expect(colors.codeText).toBeDefined();
    });

    it('상태 색상들이 정의되어 있어야 한다', () => {
      expect(colors.success).toBeDefined();
      expect(colors.warning).toBeDefined();
      expect(colors.danger).toBeDefined();
    });
  });

  describe('spacing', () => {
    it('모든 간격 값이 양수여야 한다', () => {
      Object.values(spacing).forEach((value) => {
        expect(value).toBeGreaterThan(0);
      });
    });

    it('간격이 올바른 순서로 정의되어 있어야 한다', () => {
      expect(spacing.xs).toBeLessThan(spacing.sm);
      expect(spacing.sm).toBeLessThan(spacing.md);
      expect(spacing.md).toBeLessThan(spacing.lg);
      expect(spacing.lg).toBeLessThan(spacing.xl);
      expect(spacing.xl).toBeLessThan(spacing.xxl);
    });

    it('표준 간격 값들이 정의되어 있어야 한다', () => {
      expect(spacing.xs).toBe(4);
      expect(spacing.sm).toBe(8);
      expect(spacing.md).toBe(12);
      expect(spacing.lg).toBe(16);
      expect(spacing.xl).toBe(24);
      expect(spacing.xxl).toBe(32);
    });
  });

  describe('fontSize', () => {
    it('모든 폰트 크기가 양수여야 한다', () => {
      Object.values(fontSize).forEach((value) => {
        expect(value).toBeGreaterThan(0);
      });
    });

    it('폰트 크기가 올바른 순서로 정의되어 있어야 한다', () => {
      expect(fontSize.xs).toBeLessThan(fontSize.sm);
      expect(fontSize.sm).toBeLessThan(fontSize.base);
      expect(fontSize.base).toBeLessThan(fontSize.lg);
      expect(fontSize.lg).toBeLessThan(fontSize.xl);
      expect(fontSize.xl).toBeLessThan(fontSize.xxl);
      expect(fontSize.xxl).toBeLessThan(fontSize.title);
    });

    it('표준 폰트 크기가 정의되어 있어야 한다', () => {
      expect(fontSize.base).toBe(11);
      expect(fontSize.title).toBe(24);
    });
  });

  describe('difficultyColors', () => {
    it('모든 난이도에 대한 색상이 정의되어 있어야 한다', () => {
      expect(difficultyColors.easy).toBeDefined();
      expect(difficultyColors.medium).toBeDefined();
      expect(difficultyColors.hard).toBeDefined();
    });

    it('난이도 색상이 상태 색상과 일치해야 한다', () => {
      expect(difficultyColors.easy).toBe(colors.success);
      expect(difficultyColors.medium).toBe(colors.warning);
      expect(difficultyColors.hard).toBe(colors.danger);
    });
  });

  describe('difficultyLabels', () => {
    it('모든 난이도에 대한 라벨이 정의되어 있어야 한다', () => {
      expect(difficultyLabels.easy).toBeDefined();
      expect(difficultyLabels.medium).toBeDefined();
      expect(difficultyLabels.hard).toBeDefined();
    });

    it('난이도 라벨이 한국어로 정의되어 있어야 한다', () => {
      expect(difficultyLabels.easy).toBe('쉬움');
      expect(difficultyLabels.medium).toBe('보통');
      expect(difficultyLabels.hard).toBe('어려움');
    });
  });
});
