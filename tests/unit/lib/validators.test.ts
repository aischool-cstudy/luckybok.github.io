import { describe, it, expect } from 'vitest';
import { loginSchema, registerSchema } from '@/lib/validators/auth';

describe('auth validators', () => {
  describe('loginSchema', () => {
    it('유효한 이메일과 비밀번호를 통과시켜야 한다', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(result.success).toBe(true);
    });

    it('유효하지 않은 이메일을 거부해야 한다', () => {
      const result = loginSchema.safeParse({
        email: 'invalid-email',
        password: 'password123',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toContain('email');
      }
    });

    it('빈 이메일을 거부해야 한다', () => {
      const result = loginSchema.safeParse({
        email: '',
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });

    it('빈 비밀번호를 거부해야 한다', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('registerSchema', () => {
    it('유효한 회원가입 정보를 통과시켜야 한다', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        name: '홍길동',
      });
      expect(result.success).toBe(true);
    });

    it('일치하지 않는 비밀번호를 거부해야 한다', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'Password123!',
        confirmPassword: 'DifferentPassword123!',
        name: '홍길동',
      });
      expect(result.success).toBe(false);
    });

    it('짧은 비밀번호를 거부해야 한다', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'short',
        confirmPassword: 'short',
        name: '홍길동',
      });
      expect(result.success).toBe(false);
    });
  });
});
