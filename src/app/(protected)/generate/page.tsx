/**
 * 콘텐츠 생성 페이지 (Server Component)
 * - 서버에서 초기 데이터 fetch
 * - Client Component로 데이터 전달
 */

import { GenerateClient } from './generate-client';
import { getRemainingGenerations } from '@/actions/generate';

// 동적 페이지: 사용자별 실시간 생성 횟수 표시 (캐싱 비활성화)
export const revalidate = 0;

// 기본값 (로그인되지 않은 경우 등)
const DEFAULT_STATS = {
  remaining: 0,
  limit: 10,
  plan: 'starter',
};

export default async function GeneratePage() {
  // 서버에서 초기 통계 데이터 fetch (하이드레이션 불일치 방지)
  const stats = await getRemainingGenerations();
  const initialStats = stats ?? DEFAULT_STATS;

  return <GenerateClient initialStats={initialStats} />;
}
