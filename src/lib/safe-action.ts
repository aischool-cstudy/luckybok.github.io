import { z } from 'zod';

/**
 * Server Action 결과 타입
 */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * 타입 안전한 Server Action 생성 유틸리티
 *
 * @example
 * const createPost = createSafeAction(
 *   z.object({ title: z.string(), content: z.string() }),
 *   async (data) => {
 *     // 데이터 처리
 *     return { id: '1', ...data };
 *   }
 * );
 */
export function createSafeAction<TInput, TOutput>(
  schema: z.ZodSchema<TInput>,
  handler: (data: TInput) => Promise<TOutput>
) {
  return async (input: TInput): Promise<ActionResult<TOutput>> => {
    const validation = schema.safeParse(input);

    if (!validation.success) {
      return {
        success: false,
        error: '입력값이 유효하지 않습니다.',
        fieldErrors: validation.error.flatten().fieldErrors as Record<
          string,
          string[]
        >,
      };
    }

    try {
      const result = await handler(validation.data);
      return { success: true, data: result };
    } catch (error) {
      console.error('Action Error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  };
}

/**
 * FormData를 사용하는 Server Action용 래퍼
 */
export function createFormAction<TInput, TOutput>(
  schema: z.ZodSchema<TInput>,
  handler: (data: TInput) => Promise<TOutput>
) {
  return async (
    _prevState: ActionResult<TOutput> | null,
    formData: FormData
  ): Promise<ActionResult<TOutput>> => {
    const rawData = Object.fromEntries(formData.entries());
    return createSafeAction(schema, handler)(rawData as TInput);
  };
}
