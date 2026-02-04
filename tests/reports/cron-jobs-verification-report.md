# Cron Jobs 검증 보고서

**검증일**: 2026-01-29
**검증자**: 터미널 1 (백엔드 API 세션)
**대상**: CodeGen AI Cron Jobs

---

## 요약

| Cron Job | 상태 | 테스트 | vercel.json | 보안 |
|----------|------|--------|-------------|------|
| reset-daily-limits | ✅ 정상 | 15 통과 | ✅ 등록됨 | ✅ 통과 |
| expire-credits | ✅ 정상 | 13 통과 | ✅ 등록됨 | ✅ 통과 |
| renew-subscriptions | ✅ 정상 | 15 통과 | ✅ 등록됨 | ✅ 통과 |
| process-renewals | ⚠️ 중복 | 16 통과 | ❌ 미등록 | ✅ 수정됨 |

**총 테스트**: 59개 통과

---

## 상세 분석

### 1. reset-daily-limits

**스케줄**: `0 0 * * *` (매일 00:00 UTC)

**기능**: 일일 생성 횟수 리셋

**구현 특징**:
- ☑ Advisory lock으로 중복 실행 방지
- ☑ RPC 함수 `reset_daily_generations_safe` 사용
- ☑ CRON_SECRET 필수 인증

**플랜별 리셋 값**:
| 플랜 | 일일 생성 횟수 |
|------|---------------|
| starter | 10회 |
| pro | 100회 |
| team | 500회 |
| enterprise | 999,999회 |

---

### 2. expire-credits

**스케줄**: `0 1 * * *` (매일 01:00 UTC)

**기능**: 만료 크레딧 처리

**구현 특징**:
- ☑ Advisory lock으로 중복 실행 방지
- ☑ RPC 함수 `expire_credits_safe` 사용
- ☑ CRON_SECRET 필수 인증
- ☑ 음수 트랜잭션으로 만료 기록

**크레딧 패키지 만료 기간**:
| 패키지 | 만료 기간 |
|--------|----------|
| Basic | 90일 |
| Standard | 90일 |
| Premium | 180일 |

---

### 3. renew-subscriptions

**스케줄**: `0 */6 * * *` (6시간마다)

**기능**: 구독 자동 갱신

**구현 특징**:
- ☑ RPC 함수 `get_subscriptions_due_for_renewal` 사용
- ☑ 24시간 이내 만료 예정 구독 조회
- ☑ 취소 예정 구독 자동 취소 처리
- ☑ `renewSubscription` action 호출
- ☑ maxDuration 60초 설정
- ☑ CRON_SECRET 필수 인증

**처리 로직**:
1. 갱신 대상 구독 조회 (24시간 이내 만료)
2. 취소 예정(`cancel_at_period_end: true`) → 취소 처리
3. 활성 구독 → `renewSubscription` 호출
4. 결과 집계 (processed, renewed, canceled, failed)

---

### 4. process-renewals

**스케줄**: `0 0 * * *` (매일 00:00 UTC) - **vercel.json 미등록**

**기능**: 구독 갱신 처리 (renew-subscriptions와 중복)

**구현 특징**:
- ☐ vercel.json에 등록되지 않음
- ☐ renew-subscriptions와 기능 중복
- ⚠️ CRON_SECRET 검증 로직 불일치 (수정 완료)

**중복 분석**:

| 항목 | renew-subscriptions | process-renewals |
|------|---------------------|------------------|
| 스케줄 | 6시간마다 | 매일 1회 |
| 조회 방식 | RPC 함수 | 직접 쿼리 |
| 조회 범위 | 24시간 이내 | 오늘 만료분만 |
| 취소 처리 | ✅ | ✅ |
| 갱신 호출 | renewSubscription | renewSubscription |

**권장 사항**:
- **Option A**: `process-renewals` 삭제 (renew-subscriptions가 더 빈번하게 실행)
- **Option B**: 역할 분리 (renew-subscriptions: 사전 갱신, process-renewals: 백업용)

---

## 발견된 보안 이슈

### process-renewals CRON_SECRET 검증 문제

**문제점**:
```typescript
// 기존 코드 (보안 이슈)
if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
  // CRON_SECRET이 없으면 인증 체크 생략
}
```

**다른 Cron Job들의 구현 (올바른 방식)**:
```typescript
// 올바른 구현
if (!cronSecret) {
  return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
}
if (authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**상태**: ✅ 수정 완료

---

## RPC 함수 현황

| 함수명 | 용도 | Advisory Lock ID |
|--------|------|------------------|
| `reset_daily_generations_safe` | 일일 횟수 리셋 | 1001 |
| `expire_credits_safe` | 크레딧 만료 | 1002 |
| `get_subscriptions_due_for_renewal` | 갱신 대상 조회 | - |

**위치**: `supabase/migrations/006_transaction_functions.sql`

---

## vercel.json Cron 설정

```json
{
  "crons": [
    {
      "path": "/api/cron/reset-daily-limits",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/renew-subscriptions",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/cron/expire-credits",
      "schedule": "0 1 * * *"
    }
  ]
}
```

**참고**: `process-renewals`는 등록되지 않음

---

## 권장 사항

### 필수 (High Priority)

1. ~~**process-renewals 보안 수정**: CRON_SECRET 검증 로직 일관성 확보~~ ✅ 완료

### 권장 (Medium Priority)

2. **중복 기능 정리**: `process-renewals`와 `renew-subscriptions` 역할 정리
   - 권장: `process-renewals` 삭제 또는 백업용으로 유지

3. **모니터링 추가**: Cron Job 실행 결과 알림 시스템 구축

### 선택 (Low Priority)

4. **로그 개선**: 구조화된 로깅 적용 (JSON 형식)

5. **메트릭 수집**: 실행 시간, 처리 건수 등 메트릭 수집

---

**검증 완료**
