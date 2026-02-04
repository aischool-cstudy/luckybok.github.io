#!/usr/bin/env npx tsx
/**
 * CI/CD 환경변수 검증 스크립트
 *
 * 사용법:
 *   npx tsx scripts/validate-env-schema.ts
 *   npx tsx scripts/validate-env-schema.ts --strict  # 프로덕션 환경 엄격 검증
 *
 * CI 워크플로우에서:
 *   - name: Validate environment variables
 *     run: npx tsx scripts/validate-env-schema.ts
 */

import { z } from 'zod';

// 색상 출력 (터미널)
const colors = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
};

// 스크립트 인자 파싱
const args = process.argv.slice(2);
const isStrict = args.includes('--strict');
const isProduction = process.env.NODE_ENV === 'production' || isStrict;

// ================================
// 환경변수 스키마 정의
// ================================

// Supabase 관련
const supabaseSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url('유효한 Supabase URL이 필요합니다')
    .refine(
      (url) => url.includes('supabase'),
      'Supabase URL 형식이 아닙니다'
    ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(30, 'Supabase Anon Key가 너무 짧습니다'),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(30, 'Service Role Key가 너무 짧습니다')
    .optional(), // 개발 환경에서는 선택적
});

// TossPayments 관련
const tossPaymentsSchema = z.object({
  NEXT_PUBLIC_TOSS_CLIENT_KEY: z
    .string()
    .min(10, 'TossPayments 클라이언트 키가 필요합니다')
    .refine(
      (key) => {
        if (isProduction) {
          return key.startsWith('live_ck_');
        }
        return key.startsWith('test_ck_') || key.startsWith('live_ck_');
      },
      isProduction
        ? '프로덕션 환경에서는 live 키를 사용해야 합니다 (live_ck_...)'
        : '유효한 TossPayments 클라이언트 키 형식이 아닙니다 (test_ck_... 또는 live_ck_...)'
    ),
  TOSS_SECRET_KEY: z
    .string()
    .min(10, 'TossPayments 시크릿 키가 필요합니다')
    .refine(
      (key) => {
        if (isProduction) {
          return key.startsWith('live_sk_');
        }
        return key.startsWith('test_sk_') || key.startsWith('live_sk_');
      },
      isProduction
        ? '프로덕션 환경에서는 live 키를 사용해야 합니다 (live_sk_...)'
        : '유효한 TossPayments 시크릿 키 형식이 아닙니다 (test_sk_... 또는 live_sk_...)'
    ),
  TOSS_WEBHOOK_SECRET: z
    .string()
    .min(10, 'TossPayments 웹훅 시크릿이 필요합니다'),
});

// 보안 관련
const securitySchema = z.object({
  BILLING_KEY_ENCRYPTION_KEY: z
    .string()
    .length(32, '암호화 키는 정확히 32자여야 합니다 (AES-256)'),
});

// AI 관련
const aiSchema = z.object({
  ANTHROPIC_API_KEY: z
    .string()
    .min(30, 'Anthropic API 키가 필요합니다')
    .refine(
      (key) => key.startsWith('sk-ant-'),
      'Anthropic API 키 형식이 올바르지 않습니다 (sk-ant-...)'
    ),
  OPENAI_API_KEY: z
    .string()
    .min(30, 'OpenAI API 키가 필요합니다')
    .refine(
      (key) => key.startsWith('sk-'),
      'OpenAI API 키 형식이 올바르지 않습니다 (sk-...)'
    )
    .optional(), // 선택적 (폴백용)
});

// 앱 설정
const appSchema = z.object({
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url('유효한 앱 URL이 필요합니다')
    .refine(
      (url) => {
        if (isProduction) {
          return url.startsWith('https://');
        }
        return true;
      },
      '프로덕션 환경에서는 HTTPS URL이 필요합니다'
    )
    .optional(),
});

// 선택적 (KV/Redis)
const kvSchema = z.object({
  KV_REST_API_URL: z.string().url().optional(),
  KV_REST_API_TOKEN: z.string().optional(),
});

// ================================
// 검증 실행
// ================================

type ValidationResult = {
  category: string;
  success: boolean;
  errors: string[];
  warnings: string[];
};

function validateSchema(
  name: string,
  schema: z.ZodType,
  env: Record<string, string | undefined>
): ValidationResult {
  const result: ValidationResult = {
    category: name,
    success: true,
    errors: [],
    warnings: [],
  };

  try {
    schema.parse(env);
  } catch (err) {
    if (err instanceof z.ZodError) {
      for (const issue of err.issues) {
        const path = issue.path.join('.');
        const message = `${path}: ${issue.message}`;

        // optional 필드는 경고로 처리
        if (issue.code === 'invalid_type' && issue.received === 'undefined') {
          const fieldSchema = schema._def;
          if (fieldSchema && 'shape' in fieldSchema) {
            const shape = fieldSchema.shape as Record<string, z.ZodTypeAny>;
            const fieldDef = shape[path as keyof typeof shape];
            if (fieldDef?.isOptional?.()) {
              result.warnings.push(message);
              continue;
            }
          }
        }

        result.errors.push(message);
        result.success = false;
      }
    }
  }

  return result;
}

function printResults(results: ValidationResult[]): boolean {
  console.log('\n' + colors.cyan('=' .repeat(60)));
  console.log(colors.cyan('  환경변수 검증 결과'));
  console.log(colors.cyan('=' .repeat(60)) + '\n');

  let hasErrors = false;

  for (const result of results) {
    const status = result.success
      ? colors.green('✓ PASS')
      : colors.red('✗ FAIL');

    console.log(`${status}  ${result.category}`);

    for (const error of result.errors) {
      console.log(colors.red(`      └─ ${error}`));
      hasErrors = true;
    }

    for (const warning of result.warnings) {
      console.log(colors.yellow(`      └─ [선택] ${warning}`));
    }
  }

  console.log('\n' + colors.cyan('-'.repeat(60)));

  if (hasErrors) {
    console.log(colors.red('\n✗ 환경변수 검증 실패'));
    console.log(colors.gray('  필수 환경변수를 설정하세요.\n'));
    return false;
  }

  console.log(colors.green('\n✓ 모든 환경변수 검증 통과\n'));
  return true;
}

// ================================
// 메인 실행
// ================================

async function main() {
  console.log(colors.gray(`\n검증 모드: ${isProduction ? '프로덕션 (strict)' : '개발'}`));

  const env = process.env;

  const results: ValidationResult[] = [
    validateSchema('Supabase', supabaseSchema, env as Record<string, string>),
    validateSchema('TossPayments', tossPaymentsSchema, env as Record<string, string>),
    validateSchema('Security', securitySchema, env as Record<string, string>),
    validateSchema('AI Services', aiSchema, env as Record<string, string>),
    validateSchema('App Config', appSchema, env as Record<string, string>),
    validateSchema('KV/Redis (선택)', kvSchema, env as Record<string, string>),
  ];

  const success = printResults(results);

  // 요약 통계
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);

  console.log(colors.gray(`  에러: ${totalErrors}개, 경고: ${totalWarnings}개\n`));

  process.exit(success ? 0 : 1);
}

main().catch((err) => {
  console.error(colors.red('검증 스크립트 실행 중 오류:'), err);
  process.exit(1);
});
