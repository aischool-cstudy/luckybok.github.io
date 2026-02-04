import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// API 라우트 설정: OAuth 콜백은 동적 처리 필요
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // 성공적으로 인증됨
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // 오류 발생 시 로그인 페이지로 리다이렉트
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
