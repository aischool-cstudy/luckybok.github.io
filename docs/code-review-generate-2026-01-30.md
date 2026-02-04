# AI 콘텐츠 생성 시스템 코드 리뷰 보고서

**리뷰 일시**: 2026-01-30
**리뷰 대상**: AI 콘텐츠 생성 Server Actions 및 유틸리티
**리뷰어**: 터미널 5 (문서 & 리뷰)
**상태**: 리뷰 완료

---

## 📋 리뷰 대상 파일

| 파일 | 라인 수 | 역할 |
|------|---------|------|
| `src/actions/generate.ts` | 460 | AI 콘텐츠 생성 (일반/스트리밍) |
| `src/lib/ai/daily-limit.ts` | 151 | 일일 생성 횟수 관리 |

---

## 🚨 Critical (즉시 수정 필요)

### C-1. 크레딧 차감 원자성 미보장

**위치**: `src/lib/ai/daily-limit.ts:115-134`

**문제**: `deductCredit` 함수에서 트랜잭션 기록과 잔액 업데이트가 분리되어 있음. 결제 시스템에서 수정한 것과 동일한 이슈.

**현재 코드**:
```typescript
// 1. 크레딧 트랜잭션 기록 (별도 쿼리)
await supabase.from('credit_transactions').insert({
  user_id: userId,
  type: 'usage',
  amount: -1,
  balance: newCreditsBalance,
  description: `콘텐츠 생성: ${topic}`,
});

// 2. 잔액 업데이트 (별도 쿼리) - 원자성 없음!
await supabase.from('profiles').update({ credits_balance: newCreditsBalance }).eq('id', userId);
```

**영향**:
- 1번 쿼리 성공 후 2번 쿼리 실패 시 트랜잭션만 기록되고 잔액 미변경
- 동시 요청 시 레이스 컨디션 발생 가능

**수정 방안**: 이미 생성된 `use_credit_atomic` RPC 함수 사용

```typescript
// 수정된 코드 예시
export async function deductCredit(
  supabase: SupabaseClient<Database>,
  userId: string,
  topic: string
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  const { data, error } = await supabase.rpc('use_credit_atomic', {
    p_user_id: userId,
    p_amount: 1,
    p_description: `콘텐츠 생성: ${topic}`,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const result = Array.isArray(data) ? data[0] : data;
  return {
    success: result?.success ?? false,
    newBalance: result?.new_balance,
    error: result?.error_message,
  };
}
```

---

## ⚠️ Warning (수정 권장)

### W-1. 스트리밍 에러 시 크레딧 복구 로직 오류 가능성

**위치**: `src/actions/generate.ts:368-391`

**문제**: 스트리밍 비동기 함수에서 에러 발생 시 `restoreGenerationCredit`을 호출하지만, 차감이 아직 일어나지 않은 상태에서 복구하면 크레딧이 추가될 수 있음.

**현재 코드**:
```typescript
(async () => {
  try {
    // ... 스트리밍 로직 ...

    // 차감은 스트리밍 완료 후 실행됨 (line 360-364)
    if (useCredits) {
      await deductCredit(supabase, user.id, creditsBalance, validated.data.topic);
    }

    stream.done();
  } catch (error) {
    // 에러 발생 시 복구 시도 - 하지만 차감이 안됐을 수도 있음!
    const restoreResult = await restoreGenerationCredit(...);
  }
})();
```

**수정 방안**: 차감 여부 플래그 도입

```typescript
let creditDeducted = false;

try {
  // ... 스트리밍 로직 ...

  // 차감 성공 시 플래그 설정
  await deductCredit(...);
  creditDeducted = true;

  stream.done();
} catch (error) {
  // 차감됐을 때만 복구
  if (creditDeducted) {
    await restoreGenerationCredit(...);
  }
}
```

---

### W-2. 중복 코드: generateContent vs generateContentStreaming

**위치**:
- `src/actions/generate.ts:52-128` (generateContent)
- `src/actions/generate.ts:232-308` (generateContentStreaming)

**문제**: 두 함수의 초반 검증 로직이 거의 동일함 (~60줄 중복)
- Rate limiting
- 입력 검증
- 사용자 인증
- 프로필 조회
- 일일 횟수 체크
- 언어 제한 확인

**영향**:
- 코드 중복으로 유지보수 어려움
- 검증 로직 변경 시 두 곳 모두 수정 필요

**수정 방안**: 공통 검증 함수 추출

```typescript
// 새로운 헬퍼 함수
async function validateGenerationRequest(input: GenerateContentInput): Promise<{
  success: true;
  user: User;
  profile: Profile;
  useCredits: boolean;
  remainingGenerations: number;
  validated: GenerateContentInput;
} | {
  success: false;
  error: string;
  fieldErrors?: Record<string, string[]>;
}> {
  // 공통 검증 로직
}

// 사용 예시
export async function generateContent(input) {
  const validation = await validateGenerationRequest(input);
  if (!validation.success) return validation;

  const { user, profile, useCredits, validated } = validation;
  // AI 생성 로직만 구현
}
```

---

### W-3. DB 저장 에러 무시 (스트리밍)

**위치**: `src/actions/generate.ts:345-357`

**문제**: 스트리밍 버전에서 DB 저장 에러를 체크하지 않음

**현재 코드**:
```typescript
// 에러 체크 없이 insert 수행
await supabase.from('generated_contents').insert({
  user_id: user.id,
  // ...
});

// 저장 성공 여부와 관계없이 크레딧 차감
if (useCredits) {
  await deductCredit(...);
}
```

**비교**: 일반 버전(line 164-184)은 에러 체크 수행

```typescript
const { data: savedContent, error: saveError } = await supabase
  .from('generated_contents')
  .insert({...})
  .select('id')
  .single();

if (saveError) {
  console.error('콘텐츠 저장 오류:', saveError);
  // 저장 실패해도 생성된 콘텐츠는 반환
}
```

**수정 방안**: 스트리밍 버전에도 동일한 에러 처리 적용

---

## 💡 Suggestion (개선 제안)

### S-1. 구조화된 로깅 사용

**위치**:
- `src/actions/generate.ts:182, 199, 370, 381`
- `src/lib/ai/daily-limit.ts:92, 104`

**현재**: `console.error` 사용

**제안**: `logError` 함수 사용으로 일관성 확보

```typescript
// 현재
console.error('콘텐츠 저장 오류:', saveError);

// 제안
logError('콘텐츠 저장 오류', saveError, {
  userId: user.id,
  action: 'generateContent',
  topic: validated.data.topic,
});
```

---

### S-2. 일일 횟수 리셋 에러 처리

**위치**: `src/lib/ai/daily-limit.ts:38-44`

**현재**: 리셋 쿼리 에러 무시

```typescript
await supabase
  .from('profiles')
  .update({
    daily_generations_remaining: dailyLimit,
    daily_reset_at: now.toISOString(),
  })
  .eq('id', userId);
// 에러 체크 없음
```

**제안**: 에러 체크 및 로깅 추가

---

## ✅ 잘 구현된 부분

### 보안

| 항목 | 상태 | 위치 |
|------|------|------|
| Rate Limiting 적용 | ✅ | `generate.ts:52-66` |
| 입력 검증 (Zod) | ✅ | `generate.ts:68-76` |
| 사용자 인증 체크 | ✅ | `generate.ts:78-90` |
| 플랜별 언어 제한 | ✅ | `generate.ts:122-128` |

### 에러 처리

| 항목 | 상태 | 위치 |
|------|------|------|
| AI 타임아웃 처리 | ✅ | `generate.ts:140-157` |
| 타임아웃 에러 메시지 | ✅ | `generate.ts:201-206` |
| API Rate Limit 에러 | ✅ | `generate.ts:209-215` |
| 스트리밍 에러 복구 | ✅ | `generate.ts:372-390` |

### 코드 품질

| 항목 | 상태 | 설명 |
|------|------|------|
| TypeScript strict | ✅ | 전체 적용 |
| Zod 입력 검증 | ✅ | 스키마 기반 검증 |
| 공통 함수 추출 | ✅ | `daily-limit.ts` 유틸리티 |
| JSDoc 주석 | ✅ | 함수별 문서화 |

---

## 📊 요약

| 심각도 | 개수 | 상태 |
|--------|------|------|
| 🚨 Critical | 1 | 수정 필요 |
| ⚠️ Warning | 3 | 수정 권장 |
| 💡 Suggestion | 2 | 개선 고려 |

### 우선순위별 액션 아이템

1. **[Critical]** `deductCredit` 함수를 `use_credit_atomic` RPC 사용하도록 수정
2. **[Warning]** 스트리밍 크레딧 복구 로직에 차감 여부 플래그 추가
3. **[Warning]** 공통 검증 로직 헬퍼 함수로 추출
4. **[Warning]** 스트리밍 버전 DB 저장 에러 처리 추가

---

## 🔗 관련 문서

- [결제 코드 리뷰](./code-review-payment-2026-01-30.md)
- [크레딧 원자적 RPC 함수](../supabase/migrations/011_credit_atomic_functions.sql)

---

*이 리뷰는 코드 직접 수정 없이 피드백만 제공합니다. 수정은 해당 터미널(Backend)에서 진행해주세요.*

*마지막 업데이트: 2026-01-30*
