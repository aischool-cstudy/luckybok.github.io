import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createServerClient } from '@/lib/supabase/server';
import { CONTENT_SYSTEM_PROMPT, createContentPrompt } from '@/lib/ai/prompts';
import { generateContentInputSchema } from '@/lib/ai/schemas';

export const maxDuration = 60; // 최대 60초

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 입력 검증
    const validated = generateContentInputSchema.safeParse(body);
    if (!validated.success) {
      return Response.json(
        { error: '입력값이 유효하지 않습니다.', details: validated.error.flatten() },
        { status: 400 }
      );
    }

    // 사용자 인증 확인
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    // 사용자 프로필 및 생성 횟수 확인
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('plan, daily_generations_remaining')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return Response.json({ error: '사용자 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 생성 횟수 확인
    if (profile.daily_generations_remaining <= 0) {
      return Response.json(
        { error: '오늘의 생성 횟수를 모두 사용했습니다.' },
        { status: 429 }
      );
    }

    // 언어 제한 확인 (Starter 플랜은 Python만)
    if (profile.plan === 'starter' && validated.data.language !== 'python') {
      return Response.json(
        { error: 'Starter 플랜은 Python만 지원합니다.' },
        { status: 403 }
      );
    }

    // 프롬프트 생성 (소문자 표준 사용)
    const prompt = createContentPrompt({
      language: validated.data.language,
      topic: validated.data.topic,
      difficulty: validated.data.difficulty,
      targetAudience: validated.data.targetAudience,
    });

    // AI 스트리밍 응답 생성
    const result = streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: CONTENT_SYSTEM_PROMPT,
      prompt,
      maxTokens: 4000,
      temperature: 0.7,
      onFinish: async () => {
        // 생성 횟수 차감
        await supabase
          .from('profiles')
          .update({
            daily_generations_remaining: profile.daily_generations_remaining - 1,
          })
          .eq('id', user.id);
      },
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('AI 스트리밍 오류:', error);
    return Response.json(
      { error: 'AI 콘텐츠 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
