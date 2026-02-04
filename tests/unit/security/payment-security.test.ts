/**
 * 결제 보안 체크리스트 테스트
 * 가이드 터미널 4: 보안 검증
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// 프로젝트 루트 경로
const PROJECT_ROOT = path.resolve(__dirname, '../../../');
const SRC_PATH = path.join(PROJECT_ROOT, 'src');

describe('결제 보안 체크리스트', () => {
  describe('1. 시크릿 키 관리', () => {
    it('시크릿 키가 코드에 하드코딩되어 있지 않아야 한다', () => {
      const sensitivePatterns = [
        /sk_live_[a-zA-Z0-9]+/g, // 토스 시크릿 키
        /sk_test_[a-zA-Z0-9]+/g, // 토스 테스트 시크릿 키
        /TOSS_SECRET.*=.*['"][^'"]+['"]/g, // 시크릿 키 할당
      ];

      const filesToCheck = [
        'lib/payment/toss.ts',
        'actions/payment.ts',
        'actions/subscription.ts',
        'app/api/webhooks/toss/route.ts',
      ];

      filesToCheck.forEach((file) => {
        const filePath = path.join(SRC_PATH, file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');

          sensitivePatterns.forEach((pattern) => {
            const matches = content.match(pattern);
            expect(matches).toBeNull();
          });
        }
      });
    });

    it('시크릿 키가 환경변수에서 로드되어야 한다', () => {
      const tossFilePath = path.join(SRC_PATH, 'lib/payment/toss.ts');

      if (fs.existsSync(tossFilePath)) {
        const content = fs.readFileSync(tossFilePath, 'utf-8');

        // process.env.TOSS_SECRET_KEY 또는 serverEnv.TOSS_SECRET_KEY 사용 확인
        // (env.ts 모듈을 통한 타입 안전한 접근 허용)
        expect(content).toMatch(/process\.env\.TOSS_SECRET_KEY|serverEnv\.TOSS_SECRET_KEY/);
      }
    });
  });

  describe('2. 클라이언트 노출 방지', () => {
    it('프론트엔드 파일에 시크릿 키가 없어야 한다', () => {
      const frontendPaths = [
        'app/(protected)/payment',
        'components/features/payment',
      ];

      const sensitiveTerms = [
        'TOSS_SECRET_KEY',
        'sk_live_',
        'sk_test_',
        'billingKey', // 빌링키 직접 노출
      ];

      frontendPaths.forEach((frontendPath) => {
        const fullPath = path.join(SRC_PATH, frontendPath);
        if (fs.existsSync(fullPath)) {
          const files = getAllFiles(fullPath, ['.tsx', '.ts']);

          files.forEach((file) => {
            const content = fs.readFileSync(file, 'utf-8');

            sensitiveTerms.forEach((term) => {
              // billingKey는 변수명으로만 허용 (값 노출 금지)
              if (term === 'billingKey') {
                // 실제 빌링키 값 형태 체크
                expect(content).not.toMatch(/billingKey.*=.*['"][^'"]{20,}['"]/);
              } else {
                expect(content).not.toContain(term);
              }
            });
          });
        }
      });
    });

    it('클라이언트 키만 NEXT_PUBLIC 접두사로 노출되어야 한다', () => {
      const envExamplePath = path.join(PROJECT_ROOT, '.env.example');

      if (fs.existsSync(envExamplePath)) {
        const content = fs.readFileSync(envExamplePath, 'utf-8');

        // NEXT_PUBLIC_TOSS_CLIENT_KEY만 클라이언트에 노출
        expect(content).toMatch(/NEXT_PUBLIC_TOSS_CLIENT_KEY/);

        // 시크릿 키는 NEXT_PUBLIC 없이
        expect(content).not.toMatch(/NEXT_PUBLIC.*SECRET/i);
      }
    });
  });

  describe('3. 금액 서버 사이드 검증', () => {
    it('결제 승인 시 금액 검증이 서버에서 수행되어야 한다', () => {
      const paymentActionPath = path.join(SRC_PATH, 'actions/payment.ts');

      if (fs.existsSync(paymentActionPath)) {
        const content = fs.readFileSync(paymentActionPath, 'utf-8');

        // 금액 검증 로직 존재 확인
        expect(content).toMatch(/amount.*!==|amount.*===|validateAmount|금액.*검증|금액.*확인/);
      }
    });

    it('결제 준비 시 서버에서 금액을 설정해야 한다', () => {
      const paymentActionPath = path.join(SRC_PATH, 'actions/payment.ts');

      if (fs.existsSync(paymentActionPath)) {
        const content = fs.readFileSync(paymentActionPath, 'utf-8');

        // 패키지/플랜 기반 금액 조회
        expect(content).toMatch(/creditPackages|PLANS|plans\[|packages\[/);
      }
    });
  });

  describe('4. 빌링키 암호화', () => {
    it('빌링키 암호화 유틸이 존재해야 한다', () => {
      const cryptoPath = path.join(SRC_PATH, 'lib/payment/crypto.ts');

      expect(fs.existsSync(cryptoPath)).toBe(true);

      if (fs.existsSync(cryptoPath)) {
        const content = fs.readFileSync(cryptoPath, 'utf-8');

        // 암호화/복호화 함수 존재
        expect(content).toMatch(/encrypt|cipher/i);
        expect(content).toMatch(/decrypt|decipher/i);

        // AES 사용 확인
        expect(content).toMatch(/aes|crypto/i);
      }
    });

    it('빌링키 암호화 키가 환경변수로 관리되어야 한다', () => {
      const cryptoPath = path.join(SRC_PATH, 'lib/payment/crypto.ts');

      if (fs.existsSync(cryptoPath)) {
        const content = fs.readFileSync(cryptoPath, 'utf-8');

        // 환경변수에서 암호화 키 로드
        // (process.env 직접 접근 또는 serverEnv 모듈 통한 접근 모두 허용)
        expect(content).toMatch(/process\.env\.(BILLING_KEY_ENCRYPTION_KEY|ENCRYPTION_KEY)|serverEnv\.BILLING_KEY_ENCRYPTION_KEY/);
      }
    });
  });

  describe('5. 웹훅 보안', () => {
    it('웹훅 서명 검증 함수가 존재해야 한다', () => {
      const webhookPath = path.join(SRC_PATH, 'app/api/webhooks/toss/route.ts');

      if (fs.existsSync(webhookPath)) {
        const content = fs.readFileSync(webhookPath, 'utf-8');

        // 서명 검증 로직 존재
        expect(content).toMatch(/verifyWebhookSignature|signature|Toss-Signature/i);
      }
    });

    it('서명 검증 실패 시 요청을 거부해야 한다', () => {
      const webhookPath = path.join(SRC_PATH, 'app/api/webhooks/toss/route.ts');

      if (fs.existsSync(webhookPath)) {
        const content = fs.readFileSync(webhookPath, 'utf-8');

        // 검증 실패 시 에러 응답
        expect(content).toMatch(/401|Unauthorized|서명.*실패|검증.*실패/);
      }
    });
  });

  describe('6. SQL Injection 방지', () => {
    it('Supabase 클라이언트를 통한 쿼리만 사용해야 한다', () => {
      const actionFiles = [
        'actions/payment.ts',
        'actions/subscription.ts',
        'actions/credits.ts',
      ];

      actionFiles.forEach((file) => {
        const filePath = path.join(SRC_PATH, file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');

          // raw SQL 쿼리 사용 금지
          expect(content).not.toMatch(/\.raw\s*\(/);
          expect(content).not.toMatch(/execute\s*\(\s*['"`]/);

          // Supabase 클라이언트 사용 확인
          expect(content).toMatch(/supabase\.|adminClient\./);
        }
      });
    });

    it('RPC 함수 호출 시 파라미터 바인딩을 사용해야 한다', () => {
      const actionFiles = [
        'actions/payment.ts',
        'actions/subscription.ts',
      ];

      actionFiles.forEach((file) => {
        const filePath = path.join(SRC_PATH, file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');

          // RPC 호출 시 객체 파라미터 사용
          if (content.includes('.rpc(')) {
            expect(content).toMatch(/\.rpc\s*\(\s*['"`]\w+['"`]\s*,\s*\{/);
          }
        }
      });
    });
  });

  describe('7. 로깅 보안', () => {
    it('민감한 정보가 로그에 출력되지 않아야 한다', () => {
      const filesToCheck = [
        'lib/payment/toss.ts',
        'actions/payment.ts',
        'actions/subscription.ts',
        'app/api/webhooks/toss/route.ts',
      ];

      const sensitiveLogPatterns = [
        /console\.(log|info|debug)\s*\([^)]*billingKey/i,
        /console\.(log|info|debug)\s*\([^)]*secretKey/i,
        /console\.(log|info|debug)\s*\([^)]*password/i,
        /console\.(log|info|debug)\s*\([^)]*cardNumber/i,
      ];

      filesToCheck.forEach((file) => {
        const filePath = path.join(SRC_PATH, file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');

          sensitiveLogPatterns.forEach((pattern) => {
            expect(content).not.toMatch(pattern);
          });
        }
      });
    });
  });

  describe('8. HTTPS 강제', () => {
    it('결제 API URL이 HTTPS를 사용해야 한다', () => {
      const tossFilePath = path.join(SRC_PATH, 'lib/payment/toss.ts');

      if (fs.existsSync(tossFilePath)) {
        const content = fs.readFileSync(tossFilePath, 'utf-8');

        // 토스 API URL이 HTTPS
        expect(content).toMatch(/https:\/\/api\.tosspayments\.com/);
        expect(content).not.toMatch(/http:\/\/api\.tosspayments\.com/);
      }
    });
  });
});

// 유틸 함수: 디렉토리 내 모든 파일 조회
function getAllFiles(dirPath: string, extensions: string[]): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dirPath)) {
    return files;
  }

  const items = fs.readdirSync(dirPath);

  items.forEach((item) => {
    const itemPath = path.join(dirPath, item);
    const stat = fs.statSync(itemPath);

    if (stat.isDirectory()) {
      files.push(...getAllFiles(itemPath, extensions));
    } else if (extensions.some((ext) => item.endsWith(ext))) {
      files.push(itemPath);
    }
  });

  return files;
}
