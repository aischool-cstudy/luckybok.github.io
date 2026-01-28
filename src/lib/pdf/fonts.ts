/**
 * PDF 폰트 등록 모듈
 * Noto Sans KR (한국어), JetBrains Mono (코드)
 */

import { Font } from '@react-pdf/renderer';

const FONTS_PATH = '/fonts';

/**
 * 폰트 등록
 * 서버 사이드에서 호출되어야 함
 */
export function registerFonts() {
  // Noto Sans KR (한국어 본문)
  Font.register({
    family: 'NotoSansKR',
    fonts: [
      {
        src: `${FONTS_PATH}/NotoSansKR-Regular.ttf`,
        fontWeight: 'normal',
      },
      {
        src: `${FONTS_PATH}/NotoSansKR-Bold.ttf`,
        fontWeight: 'bold',
      },
    ],
  });

  // JetBrains Mono (코드 블록)
  Font.register({
    family: 'JetBrainsMono',
    src: `${FONTS_PATH}/JetBrainsMono-Regular.ttf`,
  });

  // 하이픈 처리 비활성화 (한국어용)
  Font.registerHyphenationCallback((word) => [word]);
}

export const FONT_FAMILIES = {
  body: 'NotoSansKR',
  code: 'JetBrainsMono',
} as const;
