/**
 * @fileoverview Supabase 에러 처리 모듈 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PostgrestError } from '@supabase/supabase-js';
import {
  PG_ERROR_CODES,
  classifySupabaseError,
  handleSupabaseError,
  isNotFoundError,
  isDuplicateError,
  isRetryableError,
  withRetry,
} from '@/lib/supabase/error-handler';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}));

// Helper to create PostgrestError
function createPostgrestError(code: string, message: string = 'Test error'): PostgrestError {
  return {
    code,
    message,
    details: 'Test details',
    hint: 'Test hint',
  };
}

describe('error-handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PG_ERROR_CODES', () => {
    it('올바른 에러 코드가 정의되어 있어야 한다', () => {
      expect(PG_ERROR_CODES.CONNECTION_EXCEPTION).toBe('08000');
      expect(PG_ERROR_CODES.UNIQUE_VIOLATION).toBe('23505');
      expect(PG_ERROR_CODES.FOREIGN_KEY_VIOLATION).toBe('23503');
      expect(PG_ERROR_CODES.PGRST_NO_RESULT).toBe('PGRST116');
      expect(PG_ERROR_CODES.PGRST_JWT_EXPIRED).toBe('PGRST301');
    });
  });

  describe('classifySupabaseError', () => {
    describe('NOT_FOUND 에러', () => {
      it('PGRST116 코드를 NOT_FOUND로 분류해야 한다', () => {
        const error = createPostgrestError(PG_ERROR_CODES.PGRST_NO_RESULT);
        const result = classifySupabaseError(error);

        expect(result.code).toBe('NOT_FOUND');
        expect(result.message).toBe('요청한 데이터를 찾을 수 없습니다.');
        expect(result.isRetryable).toBe(false);
      });
    });

    describe('AUTH 에러', () => {
      it('PGRST301 (JWT 만료)를 AUTH로 분류해야 한다', () => {
        const error = createPostgrestError(PG_ERROR_CODES.PGRST_JWT_EXPIRED);
        const result = classifySupabaseError(error);

        expect(result.code).toBe('AUTH');
        expect(result.message).toBe('인증이 필요하거나 만료되었습니다.');
        expect(result.isRetryable).toBe(false);
      });

      it('PGRST302 (JWT 유효하지 않음)를 AUTH로 분류해야 한다', () => {
        const error = createPostgrestError(PG_ERROR_CODES.PGRST_JWT_INVALID);
        const result = classifySupabaseError(error);

        expect(result.code).toBe('AUTH');
      });
    });

    describe('DUPLICATE 에러', () => {
      it('23505 (UNIQUE_VIOLATION)를 DUPLICATE로 분류해야 한다', () => {
        const error = createPostgrestError(PG_ERROR_CODES.UNIQUE_VIOLATION);
        const result = classifySupabaseError(error);

        expect(result.code).toBe('DUPLICATE');
        expect(result.message).toBe('이미 존재하는 데이터입니다.');
        expect(result.isRetryable).toBe(false);
      });
    });

    describe('FOREIGN_KEY 에러', () => {
      it('23503 (FOREIGN_KEY_VIOLATION)를 FOREIGN_KEY로 분류해야 한다', () => {
        const error = createPostgrestError(PG_ERROR_CODES.FOREIGN_KEY_VIOLATION);
        const result = classifySupabaseError(error);

        expect(result.code).toBe('FOREIGN_KEY');
        expect(result.message).toBe('참조 데이터가 올바르지 않습니다.');
      });
    });

    describe('VALIDATION 에러', () => {
      it('23502 (NOT_NULL_VIOLATION)를 VALIDATION으로 분류해야 한다', () => {
        const error = createPostgrestError(PG_ERROR_CODES.NOT_NULL_VIOLATION);
        const result = classifySupabaseError(error);

        expect(result.code).toBe('VALIDATION');
        expect(result.message).toBe('입력 데이터가 유효하지 않습니다.');
      });

      it('23514 (CHECK_VIOLATION)를 VALIDATION으로 분류해야 한다', () => {
        const error = createPostgrestError(PG_ERROR_CODES.CHECK_VIOLATION);
        const result = classifySupabaseError(error);

        expect(result.code).toBe('VALIDATION');
      });

      it('22P02 (INVALID_TEXT_REPRESENTATION)를 VALIDATION으로 분류해야 한다', () => {
        const error = createPostgrestError(PG_ERROR_CODES.INVALID_TEXT_REPRESENTATION);
        const result = classifySupabaseError(error);

        expect(result.code).toBe('VALIDATION');
      });

      it('22003 (NUMERIC_VALUE_OUT_OF_RANGE)를 VALIDATION으로 분류해야 한다', () => {
        const error = createPostgrestError(PG_ERROR_CODES.NUMERIC_VALUE_OUT_OF_RANGE);
        const result = classifySupabaseError(error);

        expect(result.code).toBe('VALIDATION');
      });

      it('22001 (STRING_DATA_RIGHT_TRUNCATION)를 VALIDATION으로 분류해야 한다', () => {
        const error = createPostgrestError(PG_ERROR_CODES.STRING_DATA_RIGHT_TRUNCATION);
        const result = classifySupabaseError(error);

        expect(result.code).toBe('VALIDATION');
      });
    });

    describe('PERMISSION 에러', () => {
      it('42501 (INSUFFICIENT_PRIVILEGE)를 PERMISSION으로 분류해야 한다', () => {
        const error = createPostgrestError(PG_ERROR_CODES.INSUFFICIENT_PRIVILEGE);
        const result = classifySupabaseError(error);

        expect(result.code).toBe('PERMISSION');
        expect(result.message).toBe('해당 작업을 수행할 권한이 없습니다.');
      });
    });

    describe('CONNECTION 에러 (재시도 가능)', () => {
      it('08000 (CONNECTION_EXCEPTION)를 CONNECTION으로 분류하고 재시도 가능해야 한다', () => {
        const error = createPostgrestError(PG_ERROR_CODES.CONNECTION_EXCEPTION);
        const result = classifySupabaseError(error);

        expect(result.code).toBe('CONNECTION');
        expect(result.message).toBe('데이터베이스 연결에 실패했습니다.');
        expect(result.isRetryable).toBe(true);
      });

      it('08003 (CONNECTION_DOES_NOT_EXIST)를 CONNECTION으로 분류해야 한다', () => {
        const error = createPostgrestError(PG_ERROR_CODES.CONNECTION_DOES_NOT_EXIST);
        const result = classifySupabaseError(error);

        expect(result.code).toBe('CONNECTION');
        expect(result.isRetryable).toBe(true);
      });

      it('08006 (CONNECTION_FAILURE)를 CONNECTION으로 분류해야 한다', () => {
        const error = createPostgrestError(PG_ERROR_CODES.CONNECTION_FAILURE);
        const result = classifySupabaseError(error);

        expect(result.code).toBe('CONNECTION');
        expect(result.isRetryable).toBe(true);
      });
    });

    describe('UNKNOWN 에러', () => {
      it('알 수 없는 코드를 UNKNOWN으로 분류해야 한다', () => {
        const error = createPostgrestError('XXXXX');
        const result = classifySupabaseError(error);

        expect(result.code).toBe('UNKNOWN');
        expect(result.message).toBe('알 수 없는 오류가 발생했습니다.');
        expect(result.isRetryable).toBe(false);
      });
    });
  });

  describe('handleSupabaseError', () => {
    it('에러를 분류하고 로깅해야 한다', async () => {
      const { logError } = await import('@/lib/logger');
      const mockedLogError = vi.mocked(logError);
      mockedLogError.mockClear();

      const error = createPostgrestError(PG_ERROR_CODES.UNIQUE_VIOLATION);

      const result = handleSupabaseError(error, {
        action: 'createUser',
        context: { email: 'test@example.com' },
      });

      expect(result.code).toBe('DUPLICATE');
      expect(mockedLogError).toHaveBeenCalledWith(
        'Supabase Error [DUPLICATE]',
        error,
        expect.objectContaining({
          action: 'createUser',
          errorCode: 'DUPLICATE',
          email: 'test@example.com',
        })
      );
    });

    it('silent 옵션이 true면 로깅하지 않아야 한다', async () => {
      const { logError } = await import('@/lib/logger');
      const mockedLogError = vi.mocked(logError);
      mockedLogError.mockClear();

      const error = createPostgrestError(PG_ERROR_CODES.UNIQUE_VIOLATION);

      handleSupabaseError(error, {
        action: 'createUser',
        silent: true,
      });

      expect(mockedLogError).not.toHaveBeenCalled();
    });
  });

  describe('isNotFoundError', () => {
    it('PGRST116 에러를 true로 반환해야 한다', () => {
      const error = createPostgrestError(PG_ERROR_CODES.PGRST_NO_RESULT);
      expect(isNotFoundError(error)).toBe(true);
    });

    it('다른 에러 코드를 false로 반환해야 한다', () => {
      const error = createPostgrestError(PG_ERROR_CODES.UNIQUE_VIOLATION);
      expect(isNotFoundError(error)).toBe(false);
    });

    it('null을 false로 반환해야 한다', () => {
      expect(isNotFoundError(null)).toBe(false);
    });
  });

  describe('isDuplicateError', () => {
    it('23505 에러를 true로 반환해야 한다', () => {
      const error = createPostgrestError(PG_ERROR_CODES.UNIQUE_VIOLATION);
      expect(isDuplicateError(error)).toBe(true);
    });

    it('다른 에러 코드를 false로 반환해야 한다', () => {
      const error = createPostgrestError(PG_ERROR_CODES.FOREIGN_KEY_VIOLATION);
      expect(isDuplicateError(error)).toBe(false);
    });

    it('null을 false로 반환해야 한다', () => {
      expect(isDuplicateError(null)).toBe(false);
    });
  });

  describe('isRetryableError', () => {
    it('연결 에러를 true로 반환해야 한다', () => {
      const error = createPostgrestError(PG_ERROR_CODES.CONNECTION_FAILURE);
      expect(isRetryableError(error)).toBe(true);
    });

    it('일반 에러를 false로 반환해야 한다', () => {
      const error = createPostgrestError(PG_ERROR_CODES.UNIQUE_VIOLATION);
      expect(isRetryableError(error)).toBe(false);
    });

    it('null을 false로 반환해야 한다', () => {
      expect(isRetryableError(null)).toBe(false);
    });
  });

  describe('withRetry', () => {
    it('성공 시 데이터를 반환해야 한다', async () => {
      const operation = vi.fn().mockResolvedValue({ id: 1, name: 'Test' });

      const result = await withRetry(operation, { action: 'getUser' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ id: 1, name: 'Test' });
      }
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('재시도 가능한 에러 시 재시도해야 한다', async () => {
      let callCount = 0;
      const operation = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          throw createPostgrestError(PG_ERROR_CODES.CONNECTION_FAILURE);
        }
        return { id: 1 };
      });

      const result = await withRetry(operation, {
        action: 'getUser',
        maxRetries: 3,
        baseDelayMs: 10,
      });

      expect(result.success).toBe(true);
      expect(callCount).toBe(3);
    });

    it('재시도 불가능한 에러는 즉시 실패해야 한다', async () => {
      const operation = vi.fn().mockRejectedValue(
        createPostgrestError(PG_ERROR_CODES.UNIQUE_VIOLATION)
      );

      const result = await withRetry(operation, {
        action: 'createUser',
        maxRetries: 3,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('이미 존재하는 데이터입니다.');
      }
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('최대 재시도 후 실패해야 한다', async () => {
      const operation = vi.fn().mockRejectedValue(
        createPostgrestError(PG_ERROR_CODES.CONNECTION_FAILURE)
      );

      const result = await withRetry(operation, {
        action: 'getUser',
        maxRetries: 3,
        baseDelayMs: 10,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('데이터베이스 연결에 실패했습니다.');
      }
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('PostgrestError가 아닌 에러도 처리해야 한다', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await withRetry(operation, {
        action: 'getUser',
        maxRetries: 3,
        baseDelayMs: 10,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('작업 처리에 실패했습니다.');
      }
    });

    it('기본 재시도 횟수는 3회여야 한다', async () => {
      const operation = vi.fn().mockRejectedValue(
        createPostgrestError(PG_ERROR_CODES.CONNECTION_FAILURE)
      );

      await withRetry(operation, { action: 'test', baseDelayMs: 10 });

      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('지수 백오프 딜레이를 사용해야 한다', async () => {
      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;
      vi.spyOn(global, 'setTimeout').mockImplementation((fn, delay) => {
        delays.push(delay as number);
        return originalSetTimeout(fn, 0);
      });

      const operation = vi.fn().mockRejectedValue(
        createPostgrestError(PG_ERROR_CODES.CONNECTION_FAILURE)
      );

      await withRetry(operation, {
        action: 'test',
        maxRetries: 3,
        baseDelayMs: 100,
      });

      // 첫 번째 재시도: 100ms, 두 번째 재시도: 200ms
      expect(delays).toContain(100);
      expect(delays).toContain(200);

      vi.restoreAllMocks();
    });
  });
});
