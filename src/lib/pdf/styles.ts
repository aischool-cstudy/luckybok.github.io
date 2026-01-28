/**
 * PDF 스타일 상수
 */

import { StyleSheet } from '@react-pdf/renderer';
import { FONT_FAMILIES } from './fonts';

export const colors = {
  primary: '#2563eb',
  secondary: '#64748b',
  text: '#1e293b',
  textLight: '#64748b',
  border: '#e2e8f0',
  background: '#f8fafc',
  codeBackground: '#1e293b',
  codeText: '#e2e8f0',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const fontSize = {
  xs: 8,
  sm: 10,
  base: 11,
  lg: 13,
  xl: 16,
  xxl: 20,
  title: 24,
} as const;

export const pdfStyles = StyleSheet.create({
  // 페이지
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 40,
    fontFamily: FONT_FAMILIES.body,
  },

  // 헤더
  header: {
    marginBottom: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    borderBottomStyle: 'solid',
  },
  headerLogo: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  headerMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  headerMetaItem: {
    fontSize: fontSize.xs,
    color: colors.textLight,
  },

  // 제목
  title: {
    fontSize: fontSize.title,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.lg,
    lineHeight: 1.3,
  },

  // 메타 정보 뱃지
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  badge: {
    fontSize: fontSize.xs,
    color: colors.primary,
    backgroundColor: '#eff6ff',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 4,
  },

  // 섹션
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIcon: {
    marginRight: spacing.sm,
    fontSize: fontSize.lg,
  },

  // 본문
  paragraph: {
    fontSize: fontSize.base,
    color: colors.text,
    lineHeight: 1.6,
    marginBottom: spacing.md,
    textAlign: 'justify',
  },

  // 리스트
  list: {
    marginBottom: spacing.md,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  listBullet: {
    width: 16,
    fontSize: fontSize.base,
    color: colors.primary,
  },
  listContent: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.text,
    lineHeight: 1.5,
  },

  // 코드 블록
  codeBlock: {
    backgroundColor: colors.codeBackground,
    borderRadius: 6,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  codeText: {
    fontFamily: FONT_FAMILIES.code,
    fontSize: fontSize.sm,
    color: colors.codeText,
    lineHeight: 1.5,
  },
  codeLanguage: {
    fontSize: fontSize.xs,
    color: colors.textLight,
    marginBottom: spacing.xs,
  },

  // 연습 문제
  exerciseCard: {
    backgroundColor: colors.background,
    borderRadius: 6,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    borderLeftStyle: 'solid',
  },
  exerciseQuestion: {
    fontSize: fontSize.base,
    color: colors.text,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  exerciseDifficulty: {
    fontSize: fontSize.xs,
    color: colors.textLight,
  },
  exerciseHint: {
    fontSize: fontSize.sm,
    color: colors.secondary,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },

  // 요약 박스
  summaryBox: {
    backgroundColor: '#fffbeb',
    borderRadius: 6,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderStyle: 'solid',
  },
  summaryText: {
    fontSize: fontSize.base,
    color: colors.text,
    lineHeight: 1.6,
  },

  // 푸터
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderTopStyle: 'solid',
  },
  footerText: {
    fontSize: fontSize.xs,
    color: colors.textLight,
  },
  pageNumber: {
    fontSize: fontSize.xs,
    color: colors.textLight,
  },
});

// 난이도 색상
export const difficultyColors: Record<string, string> = {
  easy: colors.success,
  medium: colors.warning,
  hard: colors.danger,
};

// 난이도 라벨
export const difficultyLabels: Record<string, string> = {
  easy: '쉬움',
  medium: '보통',
  hard: '어려움',
};
