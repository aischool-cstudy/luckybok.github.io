import { describe, it, expect } from 'vitest';
import { FONT_FAMILIES } from '@/lib/pdf/fonts';

describe('PDF fonts', () => {
  describe('FONT_FAMILIES', () => {
    it('body 폰트가 정의되어 있어야 한다', () => {
      expect(FONT_FAMILIES.body).toBeDefined();
      expect(FONT_FAMILIES.body).toBe('NotoSansKR');
    });

    it('code 폰트가 정의되어 있어야 한다', () => {
      expect(FONT_FAMILIES.code).toBeDefined();
      expect(FONT_FAMILIES.code).toBe('JetBrainsMono');
    });

    it('모든 폰트 이름이 문자열이어야 한다', () => {
      Object.values(FONT_FAMILIES).forEach((fontName) => {
        expect(typeof fontName).toBe('string');
        expect(fontName.length).toBeGreaterThan(0);
      });
    });
  });
});
