'use server';

import { z } from 'zod';
import { renderToBuffer } from '@react-pdf/renderer';
import { createServerClient } from '@/lib/supabase/server';
import { parseContentJson } from '@/lib/history-utils';
import { registerFonts, ContentTemplate } from '@/lib/pdf';
import type { Plan } from '@/types/domain.types';

// 입력 스키마
const exportContentInputSchema = z.object({
  contentId: z.string().uuid('유효하지 않은 콘텐츠 ID입니다.'),
});

// 반환 타입
type ExportResult =
  | { success: true; pdf: Uint8Array; filename: string }
  | { success: false; error: string };

// PDF 내보내기 허용 플랜
const ALLOWED_PLANS: Plan[] = ['pro', 'team', 'enterprise'];

/**
 * 콘텐츠를 PDF로 내보내기
 * Pro 플랜 이상에서만 사용 가능
 */
export async function exportContentToPDF(
  input: z.infer<typeof exportContentInputSchema>
): Promise<ExportResult> {
  // 1. 입력 검증
  const parsed = exportContentInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? '입력 오류' };
  }

  const { contentId } = parsed.data;

  // 2. 인증 확인
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: '로그인이 필요합니다.' };
  }

  // 3. 프로필 조회 (플랜 체크용)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return { success: false, error: '사용자 정보를 찾을 수 없습니다.' };
  }

  // 4. 플랜 체크
  if (!ALLOWED_PLANS.includes(profile.plan)) {
    return {
      success: false,
      error: 'PDF 내보내기는 Pro 플랜 이상에서 사용 가능합니다.',
    };
  }

  // 5. 콘텐츠 조회
  const { data: contentData, error: contentError } = await supabase
    .from('generated_contents')
    .select('*')
    .eq('id', contentId)
    .eq('user_id', user.id)
    .single();

  if (contentError || !contentData) {
    return { success: false, error: '콘텐츠를 찾을 수 없습니다.' };
  }

  // 6. JSON 파싱
  const parsedContent = parseContentJson(contentData.content);
  if (!parsedContent) {
    return { success: false, error: '콘텐츠 형식이 올바르지 않습니다.' };
  }

  try {
    // 7. 폰트 등록
    registerFonts();

    // 8. PDF 렌더링
    const pdfBuffer = await renderToBuffer(
      ContentTemplate({
        content: parsedContent,
        metadata: {
          language: contentData.language,
          difficulty: contentData.difficulty,
          targetAudience: contentData.target_audience,
          createdAt: contentData.created_at,
        },
      })
    );

    // 9. 파일명 생성
    const sanitizedTitle = (parsedContent.title || contentData.topic)
      .replace(/[^a-zA-Z0-9가-힣\s]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 50);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `CodeGen_${sanitizedTitle}_${dateStr}.pdf`;

    return {
      success: true,
      pdf: new Uint8Array(pdfBuffer),
      filename,
    };
  } catch (error) {
    console.error('PDF 생성 오류:', error);
    return { success: false, error: 'PDF 생성 중 오류가 발생했습니다.' };
  }
}
