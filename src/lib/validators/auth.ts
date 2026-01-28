import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, '이메일을 입력해주세요')
    .email('유효한 이메일 주소를 입력해주세요'),
  password: z
    .string()
    .min(1, '비밀번호를 입력해주세요')
    .min(6, '비밀번호는 최소 6자 이상이어야 합니다'),
});

export const registerSchema = z
  .object({
    name: z
      .string()
      .min(1, '이름을 입력해주세요')
      .min(2, '이름은 최소 2자 이상이어야 합니다')
      .max(50, '이름은 최대 50자까지 입력 가능합니다'),
    email: z
      .string()
      .min(1, '이메일을 입력해주세요')
      .email('유효한 이메일 주소를 입력해주세요'),
    password: z
      .string()
      .min(1, '비밀번호를 입력해주세요')
      .min(6, '비밀번호는 최소 6자 이상이어야 합니다')
      .regex(
        /^(?=.*[a-zA-Z])(?=.*\d)/,
        '비밀번호는 영문자와 숫자를 포함해야 합니다'
      ),
    confirmPassword: z.string().min(1, '비밀번호 확인을 입력해주세요'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '비밀번호가 일치하지 않습니다',
    path: ['confirmPassword'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
