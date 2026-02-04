/**
 * AI 성능 최적화 유틸리티
 *
 * - 프롬프트 압축: 토큰 사용량 최적화
 * - 응답 캐싱: 동일 요청 중복 방지
 * - 요청 배치: 다중 요청 최적화
 */

import { logWarn } from '@/lib/logger';

// ─────────────────────────────────────────────────────────────────
// 프롬프트 압축
// ─────────────────────────────────────────────────────────────────

/**
 * 프롬프트 압축 옵션
 */
export interface CompressionOptions {
  /** 공백 정규화 */
  normalizeWhitespace?: boolean;
  /** 빈 줄 제거 */
  removeEmptyLines?: boolean;
  /** 마크다운 헤더 간소화 */
  simplifyHeaders?: boolean;
  /** 최대 길이 (초과 시 잘림) */
  maxLength?: number;
}

const DEFAULT_COMPRESSION_OPTIONS: CompressionOptions = {
  normalizeWhitespace: true,
  removeEmptyLines: true,
  simplifyHeaders: false,
  maxLength: undefined,
};

/**
 * 프롬프트 텍스트 압축
 * - 불필요한 공백 제거
 * - 토큰 사용량 10-20% 절감
 */
export function compressPrompt(
  text: string,
  options: CompressionOptions = {}
): string {
  const opts = { ...DEFAULT_COMPRESSION_OPTIONS, ...options };
  let result = text;

  // 1. 공백 정규화: 연속 공백을 단일 공백으로
  if (opts.normalizeWhitespace) {
    result = result.replace(/[ \t]+/g, ' ');
  }

  // 2. 빈 줄 제거: 연속 빈 줄을 단일 줄바꿈으로
  if (opts.removeEmptyLines) {
    result = result.replace(/\n\s*\n\s*\n/g, '\n\n');
  }

  // 3. 각 줄 앞뒤 공백 제거
  result = result
    .split('\n')
    .map((line) => line.trim())
    .join('\n');

  // 4. 마크다운 헤더 간소화
  if (opts.simplifyHeaders) {
    result = result.replace(/^(#{1,3})\s+/gm, '$1 ');
  }

  // 5. 최대 길이 제한
  if (opts.maxLength && result.length > opts.maxLength) {
    result = result.slice(0, opts.maxLength) + '...';
  }

  return result.trim();
}

/**
 * 예상 토큰 수 계산 (대략적)
 * - 영어: 4자 = 1 토큰
 * - 한국어: 2자 = 1 토큰 (대략)
 */
export function estimateTokenCount(text: string): number {
  // 한글 문자 수
  const koreanChars = (text.match(/[\uAC00-\uD7AF]/g) || []).length;
  // 나머지 문자 수
  const otherChars = text.length - koreanChars;

  // 한글: 2자당 1토큰, 기타: 4자당 1토큰
  return Math.ceil(koreanChars / 2) + Math.ceil(otherChars / 4);
}

// ─────────────────────────────────────────────────────────────────
// 응답 캐싱
// ─────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  createdAt: number;
  expiresAt: number;
  hits: number;
}

/**
 * 간단한 인메모리 캐시
 * - TTL 기반 만료
 * - LRU 정책 (최대 크기 초과 시)
 */
export class SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;
  private readonly defaultTtlMs: number;

  constructor(options: { maxSize?: number; defaultTtlMs?: number } = {}) {
    this.maxSize = options.maxSize || 100;
    this.defaultTtlMs = options.defaultTtlMs || 5 * 60 * 1000; // 5분
  }

  /**
   * 캐시에서 값 가져오기
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // 만료 확인
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // 히트 카운트 증가
    entry.hits++;
    return entry.data;
  }

  /**
   * 캐시에 값 저장
   */
  set(key: string, data: T, ttlMs?: number): void {
    // 최대 크기 초과 시 가장 오래된 항목 제거
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const now = Date.now();
    this.cache.set(key, {
      data,
      createdAt: now,
      expiresAt: now + (ttlMs || this.defaultTtlMs),
      hits: 0,
    });
  }

  /**
   * 캐시에서 값 삭제
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 캐시 전체 삭제
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 캐시 통계
   */
  stats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }

  /**
   * 만료된 항목 정리
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * 가장 오래된/적게 사용된 항목 제거 (LRU)
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestScore = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      // 점수: 생성시간 - 히트수 * 가중치
      const score = entry.createdAt - entry.hits * 10000;
      if (score < oldestScore) {
        oldestScore = score;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// AI 응답 캐시 (싱글톤)
// ─────────────────────────────────────────────────────────────────

/**
 * 콘텐츠 생성 캐시 키 생성
 */
export function createCacheKey(params: {
  language: string;
  topic: string;
  difficulty: string;
  targetAudience: string;
}): string {
  return `content:${params.language}:${params.difficulty}:${params.targetAudience}:${normalizeText(params.topic)}`;
}

/**
 * 퀴즈 캐시 키 생성
 */
export function createQuizCacheKey(params: {
  topic: string;
  language: string;
  difficulty: string;
}): string {
  return `quiz:${params.language}:${params.difficulty}:${normalizeText(params.topic)}`;
}

/**
 * 텍스트 정규화 (캐시 키용)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9가-힣-]/g, '')
    .slice(0, 50);
}

// 전역 캐시 인스턴스
let contentCache: SimpleCache<string> | null = null;

/**
 * 콘텐츠 캐시 가져오기 (지연 초기화)
 */
export function getContentCache(): SimpleCache<string> {
  if (!contentCache) {
    contentCache = new SimpleCache<string>({
      maxSize: 50,
      defaultTtlMs: 30 * 60 * 1000, // 30분
    });
  }
  return contentCache;
}

// ─────────────────────────────────────────────────────────────────
// 요청 디바운싱/스로틀링
// ─────────────────────────────────────────────────────────────────

const pendingRequests = new Map<string, Promise<unknown>>();

/**
 * 중복 요청 방지 (동일 키에 대한 요청 병합)
 */
export async function deduplicateRequest<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  // 이미 진행 중인 동일 요청이 있으면 대기
  const pending = pendingRequests.get(key);
  if (pending) {
    logWarn('중복 요청 감지, 기존 요청 재사용', { key });
    return pending as Promise<T>;
  }

  // 새 요청 시작
  const promise = fn().finally(() => {
    pendingRequests.delete(key);
  });

  pendingRequests.set(key, promise);
  return promise;
}

// ─────────────────────────────────────────────────────────────────
// 스트리밍 최적화
// ─────────────────────────────────────────────────────────────────

/**
 * 스트리밍 청크 버퍼링
 * - 작은 청크를 모아서 한 번에 전송
 * - UI 업데이트 빈도 조절
 */
export class StreamBuffer {
  private buffer = '';
  private readonly minChunkSize: number;
  private readonly maxWaitMs: number;
  private timer: NodeJS.Timeout | null = null;
  private onFlush: (text: string) => void;

  constructor(options: {
    minChunkSize?: number;
    maxWaitMs?: number;
    onFlush: (text: string) => void;
  }) {
    this.minChunkSize = options.minChunkSize || 50;
    this.maxWaitMs = options.maxWaitMs || 100;
    this.onFlush = options.onFlush;
  }

  /**
   * 청크 추가
   */
  add(chunk: string): void {
    this.buffer += chunk;

    // 버퍼가 충분히 크면 즉시 플러시
    if (this.buffer.length >= this.minChunkSize) {
      this.flush();
      return;
    }

    // 타이머 설정 (최대 대기 시간 후 플러시)
    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.maxWaitMs);
    }
  }

  /**
   * 버퍼 플러시
   */
  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.buffer.length > 0) {
      this.onFlush(this.buffer);
      this.buffer = '';
    }
  }

  /**
   * 스트림 종료 (남은 버퍼 플러시)
   */
  end(): void {
    this.flush();
  }
}
