/**
 * E2E 테스트용 사용자 생성 스크립트
 *
 * 사용법:
 * npx tsx scripts/create-test-user.ts
 *
 * 환경변수 필요:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - TEST_USER_EMAIL (기본값: test@example.com)
 * - TEST_USER_PASSWORD (기본값: testpassword123)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// .env.local 수동 로드
function loadEnvFile(filePath: string) {
  try {
    const content = readFileSync(resolve(process.cwd(), filePath), 'utf-8');
    content.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=');
        if (key && value && !process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  } catch {
    // 파일이 없으면 무시
  }
}

loadEnvFile('.env.local');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'testpassword123';
const TEST_NAME = '테스트 사용자';

async function main() {
  console.log('🔧 E2E 테스트 사용자 생성 스크립트\n');

  // 환경변수 검증
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ 필수 환경변수가 설정되지 않았습니다:');
    console.error('   - NEXT_PUBLIC_SUPABASE_URL');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log(`📧 이메일: ${TEST_EMAIL}`);
  console.log(`🔑 비밀번호: ${'*'.repeat(TEST_PASSWORD.length)}`);
  console.log(`👤 이름: ${TEST_NAME}\n`);

  // Admin 클라이언트 생성
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // 기존 사용자 확인
    const { data: existingUsers, error: listError } =
      await supabase.auth.admin.listUsers();

    if (listError) {
      throw new Error(`사용자 목록 조회 실패: ${listError.message}`);
    }

    const existingUser = existingUsers.users.find(
      (u) => u.email === TEST_EMAIL
    );

    if (existingUser) {
      console.log('⚠️  이미 존재하는 사용자입니다.');
      console.log(`   User ID: ${existingUser.id}`);

      // 프로필 확인
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', existingUser.id)
        .single();

      if (profile) {
        console.log(`   플랜: ${profile.plan}`);
        console.log(`   일일 생성 횟수: ${profile.daily_generations_remaining}`);
      }

      console.log('\n✅ 기존 계정을 사용할 수 있습니다.');
      return;
    }

    // 새 사용자 생성
    console.log('📝 새 사용자 생성 중...');

    const { data: newUser, error: createError } =
      await supabase.auth.admin.createUser({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        email_confirm: true, // 이메일 확인 없이 바로 활성화
        user_metadata: {
          name: TEST_NAME,
        },
      });

    if (createError) {
      throw new Error(`사용자 생성 실패: ${createError.message}`);
    }

    console.log(`✅ 사용자 생성 완료!`);
    console.log(`   User ID: ${newUser.user.id}`);

    // 프로필 생성 (트리거가 없는 경우)
    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        id: newUser.user.id,
        email: TEST_EMAIL,
        name: TEST_NAME,
        plan: 'starter',
        daily_generations_remaining: 10,
        daily_reset_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (profileError) {
      console.warn(`⚠️  프로필 생성 경고: ${profileError.message}`);
      console.warn('   (auth.users 트리거가 있다면 무시해도 됩니다)');
    } else {
      console.log('✅ 프로필 생성 완료!');
    }

    console.log('\n🎉 E2E 테스트 사용자 설정 완료!');
    console.log('\n다음 명령어로 E2E 테스트를 실행하세요:');
    console.log('   npx playwright test');
  } catch (error) {
    console.error('\n❌ 오류 발생:', error);
    process.exit(1);
  }
}

main();
