/**
 * 결제 보안 유틸리티
 * - 빌링키 AES-256 암호화/복호화
 * - 웹훅 서명 검증
 * - 주문 ID 생성
 */

import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { serverEnv } from '@/lib/env';

// 환경 변수 접근 (env.ts 통해 타입 안전하게)
function getEncryptionKey(): Buffer {
  const key = serverEnv.BILLING_KEY_ENCRYPTION_KEY;
  return Buffer.from(key, 'utf-8');
}

function getWebhookSecret(): string {
  return serverEnv.TOSS_WEBHOOK_SECRET;
}

// ────────────────────────────────────────────────────────────
// 빌링키 암호화/복호화 (AES-256-GCM)
// ────────────────────────────────────────────────────────────

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
// AUTH_TAG_LENGTH는 GCM 모드의 기본값(16바이트)을 사용

/**
 * 빌링키 암호화
 * @param billingKey 평문 빌링키
 * @returns 암호화된 빌링키 (iv:authTag:encrypted 형식)
 */
export function encryptBillingKey(billingKey: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(billingKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // iv:authTag:encrypted 형식으로 저장
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * 빌링키 복호화
 * @param encryptedBillingKey 암호화된 빌링키
 * @returns 복호화된 빌링키
 */
export function decryptBillingKey(encryptedBillingKey: string): string {
  const key = getEncryptionKey();
  const parts = encryptedBillingKey.split(':');

  if (parts.length !== 3) {
    throw new Error('잘못된 암호화 데이터 형식입니다.');
  }

  const [ivHex, authTagHex, encrypted] = parts as [string, string, string];
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// ────────────────────────────────────────────────────────────
// 웹훅 서명 검증 (HMAC-SHA256)
// ────────────────────────────────────────────────────────────

/**
 * 토스페이먼츠 웹훅 서명 검증
 * @param payload 웹훅 페이로드 (JSON 문자열)
 * @param signature 웹훅 헤더의 서명 값
 * @returns 서명이 유효한지 여부
 */
export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const secret = getWebhookSecret();

  const expectedSignature = createHmac('sha256', secret).update(payload).digest('base64');

  // Node.js 내장 timingSafeEqual을 사용한 타이밍 공격 방지
  // Buffer 길이가 다르면 timingSafeEqual이 에러를 던지므로 먼저 검사
  const signatureBuffer = Buffer.from(signature, 'utf-8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(signatureBuffer, expectedBuffer);
}

// ────────────────────────────────────────────────────────────
// 주문 ID 생성
// ────────────────────────────────────────────────────────────

type OrderIdPrefix = 'ORD' | 'SUB' | 'CRD' | 'CHG';

/**
 * 고유한 주문 ID 생성
 * 형식: {PREFIX}_{TIMESTAMP}_{RANDOM}
 * 예: ORD_20240115143052_A1B2C3D4
 *
 * @param prefix 주문 유형 접두사
 * @returns 생성된 주문 ID
 */
export function generateOrderId(prefix: OrderIdPrefix = 'ORD'): string {
  const now = new Date();

  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');

  const randomPart = randomBytes(4).toString('hex').toUpperCase();

  return `${prefix}_${timestamp}_${randomPart}`;
}

/**
 * 주문 ID에서 타입 추출
 */
export function getOrderIdType(orderId: string): OrderIdPrefix | null {
  const match = orderId.match(/^(ORD|SUB|CRD|CHG)_/);
  return match ? (match[1] as OrderIdPrefix) : null;
}

// ────────────────────────────────────────────────────────────
// 고객 키 생성 (UUID 형식)
// ────────────────────────────────────────────────────────────

/**
 * 토스페이먼츠 고객 키 생성
 * 사용자별 고유 식별자로 사용
 */
export function generateCustomerKey(): string {
  const bytes = randomBytes(16);

  // UUID v4 형식으로 변환
  const byte6 = bytes[6];
  const byte8 = bytes[8];

  if (byte6 !== undefined && byte8 !== undefined) {
    bytes[6] = (byte6 & 0x0f) | 0x40;
    bytes[8] = (byte8 & 0x3f) | 0x80;
  }

  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

// ────────────────────────────────────────────────────────────
// 보안 유틸리티
// ────────────────────────────────────────────────────────────

/**
 * 카드 번호 마스킹
 * @param cardNumber 카드 번호
 * @returns 마스킹된 카드 번호 (예: **** **** **** 1234)
 */
export function maskCardNumber(cardNumber: string): string {
  // 숫자만 추출
  const digitsOnly = cardNumber.replace(/\D/g, '');

  if (digitsOnly.length < 4) {
    return cardNumber;
  }

  const lastFour = digitsOnly.slice(-4);
  return `**** **** **** ${lastFour}`;
}

/**
 * 민감한 데이터 제거 (로깅용)
 */
export function sanitizeForLogging<T extends Record<string, unknown>>(
  data: T,
  sensitiveFields: string[] = ['billingKey', 'encryptedBillingKey', 'secretKey']
): T {
  const sanitized = { ...data };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field as keyof T] = '[REDACTED]' as T[keyof T];
    }
  }

  return sanitized;
}
