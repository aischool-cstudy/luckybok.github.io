import { NextRequest, NextResponse } from 'next/server';
import { exportContentToPDF } from '@/actions/export';

// API 라우트 설정: PDF 생성은 동적 처리 필요
export const revalidate = 0;
export const maxDuration = 30; // PDF 생성 최대 30초

/**
 * PDF 내보내기 API 엔드포인트
 * GET /api/export/pdf?contentId=xxx
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const contentId = searchParams.get('contentId');

  if (!contentId) {
    return NextResponse.json(
      { error: '콘텐츠 ID가 필요합니다.' },
      { status: 400 }
    );
  }

  const result = await exportContentToPDF({ contentId });

  if (!result.success) {
    const status = result.error.includes('로그인') ? 401 :
                   result.error.includes('Pro 플랜') ? 403 :
                   result.error.includes('찾을 수 없습니다') ? 404 : 500;

    return NextResponse.json(
      { error: result.error },
      { status }
    );
  }

  // PDF 반환 (Uint8Array를 Buffer로 변환)
  return new NextResponse(Buffer.from(result.pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(result.filename)}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
