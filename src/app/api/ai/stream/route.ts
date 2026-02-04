import { streamText } from 'ai';
import { createServerClient } from '@/lib/supabase/server';
import { CONTENT_SYSTEM_PROMPT, createContentPrompt } from '@/lib/ai/prompts';
import { generateContentInputSchema } from '@/lib/ai/schemas';
import { models } from '@/lib/ai/providers';
import { logError } from '@/lib/logger';

// API 라우트 설정: 스트리밍 응답은 캐싱 불가
export const revalidate = 0;
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

    // AI 스트리밍 응답 생성 (Groq 무료 티어 사용)
    const result = streamText({
      model: models.standard,
      system: CONTENT_SYSTEM_PROMPT,
      prompt,
      maxOutputTokens: 4000,
      temperature: 0.7,
      onFinish: async () => {
        // 생성 횟수 차감 (재시도 로직 포함)
        const maxRetries = 3;
        let lastError: unknown = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          const { error } = await supabase
            .from('profiles')
            .update({
              daily_generations_remaining: profile.daily_generations_remaining - 1,
            })
            .eq('id', user.id);

          if (!error) {
            return; // 성공
          }

          lastError = error;
          logError('생성 횟수 차감 실패', error, {
            action: 'ai/stream/onFinish',
            userId: user.id,
            attempt,
            maxRetries,
          });

          // 재시도 전 대기 (지수 백오프)
          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, attempt)));
          }
        }

        // 모든 재시도 실패 시 로깅
        logError('생성 횟수 차감 최종 실패', lastError, {
          action: 'ai/stream/onFinish',
          userId: user.id,
          critical: true,
        });
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    logError('AI 스트리밍 오류', error, {
      action: 'ai/stream',
    });
    return Response.json(
      { error: 'AI 콘텐츠 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
