# 🚀 CodeGen AI 프로젝트 - 멀티 터미널 운영 전략
## 4-5개 터미널 최적 구성 및 실전 프롬프트

---

## 📌 프로젝트 구조 기반 터미널 분배

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CodeGen AI - 5터미널 구성                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  터미널 1: 🔧 백엔드 API (FastAPI)                                   │
│  └─ 결제 서비스, 구독 서비스, 콘텐츠 생성 API                        │
│                                                                     │
│  터미널 2: 🎨 프론트엔드 (Next.js)                                   │
│  └─ 결제 UI, 구독 관리, 대시보드                                     │
│                                                                     │
│  터미널 3: 🗄️ 데이터베이스 & 스키마                                  │
│  └─ PostgreSQL 스키마, 마이그레이션, 쿼리 최적화                     │
│                                                                     │
│  터미널 4: 🧪 테스트 & QA                                            │
│  └─ 결제 플로우 테스트, API 테스트, 보안 검증                        │
│                                                                     │
│  터미널 5: 📚 문서 & 리뷰 (선택)                                     │
│  └─ API 문서, 코드 리뷰, 기술 문서                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📌 CLAUDE.md 설정 (프로젝트 루트)

먼저 프로젝트에 이 CLAUDE.md를 생성하세요:

```markdown
# CodeGen AI - 코딩 교육 콘텐츠 자동 생성기

AI 기반으로 성인 대상 프로그래밍 교육 콘텐츠를 자동 생성하는 SaaS 서비스.
토스페이먼츠 결제 시스템 포함.

## 기술 스택
- **프론트엔드**: Next.js 15, TypeScript, Tailwind CSS, shadcn/ui
- **백엔드**: FastAPI (Python 3.11+)
- **데이터베이스**: PostgreSQL + SQLAlchemy 2.0
- **결제**: 토스페이먼츠 (정기결제 + 단건결제)
- **인증**: Supabase Auth 또는 자체 JWT
- **배포**: Vercel (FE) + Railway/Render (BE)

## 폴더 구조
```
codegen-ai/
├── frontend/                 # Next.js 앱
│   ├── app/
│   │   ├── (auth)/          # 로그인, 회원가입
│   │   ├── (main)/          # 메인 기능
│   │   ├── payment/         # 결제 페이지
│   │   └── api/             # API 라우트 (BFF)
│   ├── components/
│   └── lib/
├── backend/                  # FastAPI 서버
│   ├── app/
│   │   ├── api/v1/          # API 엔드포인트
│   │   ├── services/        # 비즈니스 로직
│   │   ├── models/          # SQLAlchemy 모델
│   │   └── schemas/         # Pydantic 스키마
│   └── tests/
└── docs/                     # 문서
```

## 결제 관련 주의사항
- 토스페이먼츠 시크릿 키는 절대 클라이언트에 노출 금지
- 빌링키는 AES-256으로 암호화 저장
- 결제 금액은 반드시 서버 사이드에서 검증
- 웹훅 서명 검증 필수

## 환경 변수 (건드리지 말 것)
- `.env.local` (프론트엔드)
- `.env` (백엔드)
- 시크릿 키, API 키 등 하드코딩 절대 금지

## 코딩 규칙
- Python: Type hints 필수, Black 포맷터
- TypeScript: strict 모드, ESLint
- 한국어 UI 텍스트
- 에러 메시지도 한국어로

## 요금제 금액 (변경 시 반드시 확인)
- Pro Monthly: ₩29,900
- Pro Yearly: ₩299,000
- Team Monthly: ₩99,000
- Team Yearly: ₩990,000
- Credits Basic: ₩9,900 (50회)
- Credits Standard: ₩24,900 (150회)
- Credits Premium: ₩49,900 (350회)
```

---

## 📌 터미널 1: 백엔드 API (FastAPI)

### 🎯 역할
- 토스페이먼츠 결제 서비스
- 구독 관리 서비스
- 콘텐츠 생성 API
- 웹훅 처리

### 📋 세션 시작 프롬프트

```markdown
## 세션 역할
이 세션은 **백엔드 API (FastAPI)** 전담이야.

## 작업 범위
- backend/ 폴더 전체
- 특히 backend/app/services/, backend/app/api/v1/

## 기술 스택
- FastAPI + Python 3.11
- SQLAlchemy 2.0 (async)
- Pydantic v2
- httpx (비동기 HTTP 클라이언트)

## 주요 작업
1. 토스페이먼츠 결제 서비스 (TossPaymentsService)
2. 구독 서비스 (SubscriptionService)
3. 환불 서비스 (RefundService)
4. 웹훅 처리 API

## 제약 조건
- 프론트엔드 코드 건드리지 말 것
- DB 스키마 변경 필요 시 터미널 3에 요청할 것
- 시크릿 키는 환경변수로만 접근
- 결제 금액은 반드시 서버에서 검증

## 참고
@CLAUDE.md 프로젝트 컨텍스트 확인

시작하기 전에 backend/ 폴더 구조 분석해줘.
```

### 📝 주요 작업 프롬프트

#### 1. 토스페이먼츠 서비스 구현

```markdown
## 목표
토스페이먼츠 API 연동 서비스 클래스 구현

## 현재 상황
- 파일 위치: backend/app/services/payment_service.py (새로 생성)
- 토스페이먼츠 API: https://api.tosspayments.com/v1

## 요청 사항
TossPaymentsService 클래스 구현:

1. 초기화
   - 시크릿 키 Base64 인코딩
   - 인증 헤더 설정

2. 단건 결제
   - confirm_payment(payment_key, order_id, amount)
   - cancel_payment(payment_key, reason, amount?)

3. 정기 결제 (빌링)
   - issue_billing_key(auth_key, customer_key)
   - charge_billing(billing_key, customer_key, amount, order_id, order_name)

4. 웹훅
   - verify_webhook_signature(payload, signature)

5. 에러 처리
   - PaymentError 커스텀 예외 클래스

## 제약 조건
- httpx AsyncClient 사용 (비동기)
- 모든 함수에 type hints 필수
- 에러 응답 파싱하여 PaymentError로 변환
- 시크릿 키는 os.environ에서 가져올 것

## 참고
토스페이먼츠 API 문서: https://docs.tosspayments.com/reference

## 완료 후
- 생성된 파일 경로 알려줘
- 사용 예시 코드 보여줘
```

#### 2. 구독 서비스 구현

```markdown
## 목표
구독 관리 서비스 구현

## 현재 상황
- 파일 위치: backend/app/services/subscription_service.py
- TossPaymentsService 이미 구현됨: @backend/app/services/payment_service.py

## 요청 사항
SubscriptionService 클래스 구현:

1. PLANS 상수 정의
   - pro/team × monthly/yearly 조합
   - 금액, 크레딧 수

2. create_subscription()
   - 빌링키 발급
   - 빌링키 암호화 저장
   - 첫 결제 실행
   - 구독/결제 내역 저장
   - 사용자 플랜 업데이트

3. cancel_subscription()
   - 즉시 취소 / 기간 종료 시 취소 옵션
   - 사용자 플랜 다운그레이드

4. process_recurring_payments()
   - 오늘 결제 대상 조회
   - 개별 결제 처리
   - 실패 시 재시도 로직

## 제약 조건
- SQLAlchemy async 세션 사용
- dateutil.relativedelta로 날짜 계산
- 빌링키 암호화: Fernet (AES-256)
- 트랜잭션 관리 철저히

## 완료 후
- 코드 리뷰 포인트 알려줘
- 스케줄러 연동 방법 설명해줘
```

#### 3. 결제 API 엔드포인트

```markdown
## 목표
결제 관련 API 엔드포인트 구현

## 현재 상황
- 파일 위치: backend/app/api/v1/payment.py (새로 생성)
- 서비스 클래스들 이미 구현됨

## 요청 사항
다음 엔드포인트 구현:

1. POST /api/v1/payment/credits
   - 크레딧 패키지 결제 시작
   - order_id, amount, customer_key 반환

2. POST /api/v1/payment/confirm
   - 토스 결제 승인 처리
   - 크레딧 추가

3. POST /api/v1/subscription/create
   - 구독 시작 (customer_key 반환)

4. POST /api/v1/subscription/confirm
   - 빌링키 발급 완료 및 첫 결제

5. DELETE /api/v1/subscription/{subscription_id}
   - 구독 취소

6. GET /api/v1/subscription/current
   - 현재 구독 정보 조회

7. POST /api/v1/webhook/toss
   - 웹훅 수신 및 처리

## 제약 조건
- Pydantic 스키마로 요청/응답 정의
- 인증 미들웨어 적용 (웹훅 제외)
- 에러 응답 일관성 있게 (HTTPException)
- 웹훅은 서명 검증 필수

## 완료 후
- Swagger 문서용 docstring 포함됐는지 확인
- 테스트용 curl 명령어 만들어줘
```

#### 4. 웹훅 처리

```markdown
## 목표
토스페이먼츠 웹훅 처리 로직 구현

## 현재 상황
- 엔드포인트: POST /api/v1/webhook/toss
- 웹훅 이벤트: PAYMENT_STATUS_CHANGED, BILLING_KEY_DELETED 등

## 요청 사항
1. 웹훅 수신 핸들러
   - 서명 검증
   - 페이로드 파싱
   - 웹훅 로그 저장

2. 이벤트별 처리 함수
   - handle_payment_status_changed()
   - handle_billing_key_deleted()

3. 재시도 처리
   - 실패 시 웹훅 로그에 에러 기록
   - 수동 재처리 가능하도록

## 제약 조건
- 웹훅은 인증 미들웨어 제외
- 대신 서명 검증 필수
- 응답은 빠르게 (200 OK)
- 무거운 처리는 백그라운드로

## 완료 후
- 웹훅 테스트 방법 알려줘
```

---

## 📌 터미널 2: 프론트엔드 (Next.js)

### 🎯 역할
- 결제 페이지 UI
- 토스페이먼츠 SDK 연동
- 구독 관리 대시보드
- 결제 완료/실패 페이지

### 📋 세션 시작 프롬프트

```markdown
## 세션 역할
이 세션은 **프론트엔드 (Next.js)** 전담이야.

## 작업 범위
- frontend/ 폴더 전체
- 특히 frontend/app/payment/, frontend/components/

## 기술 스택
- Next.js 15 (App Router)
- TypeScript strict
- Tailwind CSS
- shadcn/ui
- @tosspayments/payment-sdk

## 주요 작업
1. 구독 플랜 선택 페이지
2. 토스페이먼츠 결제 연동
3. 결제 성공/실패 페이지
4. 구독 관리 대시보드
5. 크레딧 구매 페이지

## 제약 조건
- 백엔드 코드 건드리지 말 것
- 토스 시크릿 키 절대 사용 금지 (클라이언트 키만)
- shadcn/ui 컴포넌트 우선 사용
- 한국어 UI

## 환경 변수
NEXT_PUBLIC_TOSS_CLIENT_KEY (클라이언트 키만!)

## 참고
@CLAUDE.md 프로젝트 컨텍스트 확인

시작하기 전에 frontend/app/ 구조 분석해줘.
```

### 📝 주요 작업 프롬프트

#### 1. 구독 플랜 선택 페이지

```markdown
## 목표
구독 플랜 선택 및 결제 시작 페이지 구현

## 현재 상황
- 파일 위치: frontend/app/payment/subscribe/page.tsx (새로 생성)
- 토스 SDK: @tosspayments/payment-sdk

## 요청 사항
1. 플랜 옵션 표시
   - Pro Monthly: ₩29,900/월
   - Pro Yearly: ₩299,000/년 (17% 할인)
   - Team Monthly: ₩99,000/월
   - Team Yearly: ₩990,000/년 (17% 할인)

2. 각 플랜별 혜택 표시
   - 일일 생성 횟수
   - 지원 기능

3. 플랜 선택 UI
   - 클릭하면 선택 상태 표시
   - 선택된 플랜 하이라이트

4. "구독 시작하기" 버튼
   - 서버에 구독 생성 요청
   - customerKey 받아서 토스 빌링키 발급 창 호출

5. 에러 처리
   - 에러 메시지 표시
   - 로딩 상태 표시

## 제약 조건
- 'use client' 컴포넌트
- shadcn/ui Card, Button 사용
- 반응형 디자인 (모바일 대응)
- 토스 클라이언트 키만 사용 (NEXT_PUBLIC_TOSS_CLIENT_KEY)

## 참고
토스 SDK 사용법:
```tsx
import { loadTossPayments } from '@tosspayments/payment-sdk';

const tossPayments = await loadTossPayments(CLIENT_KEY);
await tossPayments.requestBillingAuth('카드', {
  customerKey,
  successUrl: '...',
  failUrl: '...',
});
```

## 완료 후
- npm run dev로 페이지 확인
- 플랜 선택 → 토스 창 뜨는지 테스트
```

#### 2. 결제 성공 페이지

```markdown
## 목표
빌링키 발급 완료 후 결제 확정 페이지

## 현재 상황
- 파일 위치: frontend/app/payment/subscribe/success/page.tsx
- 토스에서 리다이렉트: ?authKey=xxx&customerKey=xxx

## 요청 사항
1. URL 파라미터 추출
   - authKey, customerKey

2. 서버에 구독 확정 요청
   - POST /api/subscription/confirm
   - authKey, customerKey 전달

3. 상태별 UI
   - 처리 중: 로딩 스피너 + "결제를 확인하고 있습니다..."
   - 성공: ✅ 아이콘 + "구독이 시작되었습니다! 🎉"
   - 실패: ❌ 아이콘 + 에러 메시지 + 다시 시도 버튼

4. 성공 시 3초 후 대시보드로 리다이렉트

## 제약 조건
- useSearchParams, useRouter 사용
- useEffect에서 확정 요청
- 에러 처리 철저히

## 완료 후
- 전체 플로우 테스트 (플랜 선택 → 토스 → 성공 페이지)
```

#### 3. 구독 관리 대시보드

```markdown
## 목표
현재 구독 상태 확인 및 관리 페이지

## 현재 상황
- 파일 위치: frontend/app/(main)/settings/subscription/page.tsx

## 요청 사항
1. 현재 구독 정보 표시
   - 플랜명 (Pro, Team 등)
   - 상태 (활성, 취소 예정 등)
   - 다음 결제일
   - 등록된 결제 수단 (카드사 + 마스킹 번호)

2. 결제 내역 목록
   - 최근 결제 내역 표시
   - 날짜, 금액, 상태

3. 구독 취소 버튼
   - 확인 모달
   - "즉시 취소" vs "기간 종료 시 취소" 선택
   - 취소 사유 입력

4. 플랜 변경 버튼
   - 업그레이드/다운그레이드

## 제약 조건
- 서버 컴포넌트로 초기 데이터 fetch
- 클라이언트 컴포넌트로 상호작용
- shadcn/ui Dialog, Table 사용

## 완료 후
- 취소 플로우 테스트
```

#### 4. 크레딧 구매 페이지

```markdown
## 목표
크레딧 패키지 단건 구매 페이지

## 현재 상황
- 파일 위치: frontend/app/payment/credits/page.tsx

## 요청 사항
1. 크레딧 패키지 옵션
   - Basic: ₩9,900 (50회) - ₩198/회
   - Standard: ₩24,900 (150회) - ₩166/회
   - Premium: ₩49,900 (350회) - ₩143/회

2. 패키지 선택 UI
   - 카드 형태로 표시
   - 단가 비교 표시 (Premium이 가장 저렴)

3. "구매하기" 버튼
   - 토스페이먼츠 일반 결제 창 호출

## 참고
단건 결제는 requestPayment 사용:
```tsx
await tossPayments.requestPayment('카드', {
  amount,
  orderId,
  orderName,
  successUrl: '...',
  failUrl: '...',
});
```

## 완료 후
- 결제 성공 페이지도 만들어줘 (frontend/app/payment/credits/success/page.tsx)
```

---

## 📌 터미널 3: 데이터베이스 & 스키마

### 🎯 역할
- PostgreSQL 스키마 설계
- SQLAlchemy 모델 정의
- 마이그레이션 관리
- 인덱스 최적화

### 📋 세션 시작 프롬프트

```markdown
## 세션 역할
이 세션은 **데이터베이스 & 스키마** 전담이야.

## 작업 범위
- backend/app/models/ (SQLAlchemy 모델)
- 마이그레이션 스크립트
- DB 스키마 관련 SQL

## 기술 스택
- PostgreSQL 15+
- SQLAlchemy 2.0 (async)
- Alembic (마이그레이션)

## 주요 테이블
- users (사용자 + 플랜 정보)
- subscriptions (구독)
- billing_keys (빌링키 - 암호화)
- payments (결제 내역)
- credit_transactions (크레딧 거래)
- webhook_logs (웹훅 로그)

## 제약 조건
- 프론트엔드 코드 건드리지 말 것
- 스키마 변경 시 마이그레이션 필수
- 인덱스 설계 고려
- 암호화 컬럼 주의

## 참고
@CLAUDE.md 프로젝트 컨텍스트
PRD의 DB 스키마 섹션 참고

시작하기 전에 backend/app/models/ 구조 확인해줘.
```

### 📝 주요 작업 프롬프트

#### 1. 결제 관련 모델 정의

```markdown
## 목표
결제 시스템에 필요한 SQLAlchemy 모델 정의

## 현재 상황
- 파일 위치: backend/app/models/
- 기존 User 모델 있음: @backend/app/models/user.py

## 요청 사항
다음 모델들 생성:

1. User 모델 확장 (user.py)
   - plan, plan_started_at, plan_expires_at 추가
   - credits_remaining, credits_reset_at 추가

2. Subscription 모델 (subscription.py)
   - user_id (FK)
   - plan, billing_cycle, amount
   - status (active, cancelled, past_due, expired)
   - current_period_start/end
   - next_billing_date
   - 취소 관련 필드

3. BillingKey 모델 (billing_key.py)
   - user_id, subscription_id (FK)
   - billing_key_encrypted (TEXT)
   - card_company, card_number_masked, card_type
   - is_active

4. Payment 모델 (payment.py)
   - user_id, subscription_id (FK)
   - toss_payment_key, toss_order_id
   - payment_type, product_type
   - amount, status
   - 카드 정보, 영수증 URL
   - 환불 관련 필드

5. CreditTransaction 모델 (credit_transaction.py)
   - user_id, payment_id (FK)
   - transaction_type, amount, balance_after
   - description

6. WebhookLog 모델 (webhook_log.py)
   - event_type, payload (JSONB)
   - processed, processed_at, error_message

## 제약 조건
- SQLAlchemy 2.0 스타일 (Mapped, mapped_column)
- 적절한 인덱스 설정
- ON DELETE 정책 명시
- created_at, updated_at 공통

## 완료 후
- Alembic 마이그레이션 스크립트 생성해줘
- 인덱스 설명해줘
```

#### 2. 마이그레이션 생성

```markdown
## 목표
결제 테이블 마이그레이션 스크립트 생성

## 현재 상황
- Alembic 설정 완료
- 모델 정의 완료

## 요청 사항
1. alembic revision 생성
   - 메시지: "add_payment_tables"

2. upgrade() 함수
   - 테이블 생성 순서 고려 (FK 의존성)
   - 인덱스 생성

3. downgrade() 함수
   - 역순으로 테이블 삭제

## 명령어
```bash
alembic revision --autogenerate -m "add_payment_tables"
alembic upgrade head
```

## 완료 후
- 로컬 DB에 적용하고 결과 확인
```

---

## 📌 터미널 4: 테스트 & QA

### 🎯 역할
- 결제 플로우 테스트
- API 엔드포인트 테스트
- 보안 검증
- 에러 케이스 테스트

### 📋 세션 시작 프롬프트

```markdown
## 세션 역할
이 세션은 **테스트 & QA** 전담이야.

## 작업 범위
- backend/tests/
- 결제 플로우 검증
- 보안 체크

## 기술 스택
- pytest + pytest-asyncio
- httpx (API 테스트)
- faker (테스트 데이터)

## 주요 테스트
1. 단건 결제 플로우
2. 구독 결제 플로우
3. 환불 플로우
4. 웹훅 처리
5. 에러 케이스

## 제약 조건
- 실제 코드 수정하지 말 것 (버그 발견 시 보고만)
- 토스 테스트 키/카드 사용
- 민감 정보 테스트 코드에 하드코딩 금지

## 토스 테스트 카드
- 성공: 4330000000000000
- 실패: 4000000000000000
- 잔액부족: 4111111111111111

시작하기 전에 현재 테스트 구조 확인해줘.
```

### 📝 주요 작업 프롬프트

#### 1. 결제 서비스 테스트

```markdown
## 목표
TossPaymentsService 단위 테스트 작성

## 현재 상황
- 파일 위치: backend/tests/services/test_payment_service.py
- 테스트 대상: @backend/app/services/payment_service.py

## 요청 사항
다음 테스트 케이스 작성:

1. test_confirm_payment_success
   - 정상 결제 승인

2. test_confirm_payment_invalid_amount
   - 금액 불일치 시 에러

3. test_cancel_payment_full
   - 전액 취소

4. test_cancel_payment_partial
   - 부분 취소

5. test_issue_billing_key_success
   - 빌링키 발급 성공

6. test_charge_billing_success
   - 빌링키 결제 성공

7. test_charge_billing_card_expired
   - 카드 만료 시 에러

8. test_verify_webhook_signature
   - 서명 검증 성공/실패

## 제약 조건
- pytest-asyncio 사용
- 토스 API는 mock 처리
- 실제 API 호출 테스트는 별도 integration test로

## 완료 후
- pytest 실행해서 결과 알려줘
```

#### 2. 결제 플로우 E2E 테스트

```markdown
## 목표
결제 전체 플로우 통합 테스트

## 현재 상황
- 파일 위치: backend/tests/e2e/test_payment_flow.py

## 요청 사항
다음 시나리오 테스트:

1. 크레딧 구매 플로우
   - 주문 생성 → 결제 승인 → 크레딧 증가 확인

2. 구독 시작 플로우
   - 구독 생성 → 빌링키 발급 → 첫 결제 → 플랜 변경 확인

3. 구독 갱신 플로우
   - 결제일 도래 → 자동 결제 → 기간 연장 확인

4. 구독 취소 플로우
   - 취소 요청 → 상태 변경 → 기간 종료 후 다운그레이드

5. 환불 플로우
   - 환불 요청 → 금액 확인 → 크레딧 차감

6. 결제 실패 플로우
   - 잔액 부족 → 에러 처리 → 상태 변경

## 제약 조건
- 테스트 DB 사용 (격리)
- 토스 테스트 환경 사용
- 각 테스트 후 데이터 정리

## 완료 후
- 실패하는 테스트 있으면 원인 분석해줘
```

#### 3. 보안 체크리스트 검증

```markdown
## 목표
결제 보안 요구사항 검증

## 체크리스트
다음 항목 코드에서 확인해줘:

1. 시크릿 키 관리
   ☐ 환경변수에서만 로드
   ☐ 코드에 하드코딩 없음
   ☐ 로그에 출력 안 됨

2. 클라이언트 노출
   ☐ 프론트엔드에 시크릿 키 없음
   ☐ API 응답에 민감 정보 없음

3. 금액 검증
   ☐ 서버에서 금액 검증
   ☐ 클라이언트 금액 신뢰 안 함

4. 빌링키 암호화
   ☐ AES-256 암호화 저장
   ☐ 복호화 키 환경변수

5. 웹훅 보안
   ☐ 서명 검증 구현
   ☐ 검증 실패 시 거부

6. SQL Injection
   ☐ SQLAlchemy ORM 사용
   ☐ raw query 있으면 파라미터 바인딩

## 요청 사항
- 각 항목 코드 위치와 함께 확인 결과 알려줘
- 문제 발견 시 수정 방법 제안해줘
```

---

## 📌 터미널 5: 문서 & 리뷰 (선택)

### 🎯 역할
- API 문서 작성
- 코드 리뷰
- 기술 문서

### 📋 세션 시작 프롬프트

```markdown
## 세션 역할
이 세션은 **문서 & 리뷰** 전담이야.

## 작업 범위
- docs/ 폴더
- README.md
- API 문서

## 주요 작업
1. 결제 API 문서 작성
2. 다른 터미널 결과물 리뷰
3. 환불 정책 문서
4. 개발 가이드

## 제약 조건
- 코드 직접 수정하지 말 것
- 리뷰 결과는 해당 터미널에 전달
- 한국어 문서

시작하기 전에 docs/ 구조 확인해줘.
```

### 📝 주요 작업 프롬프트

#### 1. 코드 리뷰 요청

```markdown
## 목표
터미널 1에서 구현한 결제 서비스 코드 리뷰

## 리뷰 대상
@backend/app/services/payment_service.py
@backend/app/services/subscription_service.py

## 리뷰 관점
1. 보안
   - 민감 정보 처리
   - 에러 메시지에 민감 정보 노출

2. 에러 처리
   - 예외 처리 누락
   - 에러 메시지 명확성

3. 성능
   - N+1 쿼리
   - 불필요한 DB 호출

4. 코드 품질
   - 타입 힌트 누락
   - 함수 크기 (너무 길면 분리 권장)

## 요청 사항
- 심각도별로 분류해줘 (Critical/Warning/Suggestion)
- 수정 코드 예시 포함
- 코드 직접 수정하지 말고 피드백만
```

#### 2. API 문서 작성

```markdown
## 목표
결제 API 문서 작성

## 현재 상황
- 파일 위치: docs/api/payment.md (새로 생성)

## 요청 사항
다음 내용 포함:

1. 개요
   - 결제 시스템 소개
   - 지원 결제 수단

2. 인증
   - Bearer 토큰 방식
   - 헤더 예시

3. 엔드포인트별 문서
   - URL, Method
   - Request Body (JSON 예시)
   - Response Body (JSON 예시)
   - 에러 코드

4. 웹훅
   - 이벤트 종류
   - 페이로드 구조
   - 서명 검증 방법

5. 테스트 가이드
   - 테스트 환경 설정
   - 테스트 카드 번호

## 형식
- Markdown
- 코드 블록에 언어 명시
```

---

## 📌 터미널 간 협업 플로우

### 🔄 Week 9: 토스페이먼츠 연동 주간

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Week 9 작업 플로우                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Day 1-2: 기반 작업                                                 │
│  ─────────────────────────────────────────────────────────────────  │
│  터미널 3 (DB)         터미널 1 (BE)                                 │
│      │                     │                                        │
│      ▼                     │                                        │
│  스키마 설계           대기                                          │
│  모델 정의               │                                          │
│  마이그레이션            │                                          │
│      │                     │                                        │
│      └──── 완료 알림 ─────►│                                        │
│                            ▼                                        │
│                     TossPaymentsService                             │
│                     구현 시작                                        │
│                                                                     │
│  Day 3-4: 핵심 기능                                                 │
│  ─────────────────────────────────────────────────────────────────  │
│  터미널 1 (BE)         터미널 2 (FE)        터미널 4 (Test)          │
│      │                     │                     │                  │
│      ▼                     ▼                     │                  │
│  결제 서비스           결제 UI                대기                   │
│  구독 서비스           구독 페이지              │                    │
│  API 엔드포인트          │                     │                    │
│      │                     │                     │                  │
│      └──── API 완료 ───────┼─────────────────────┤                  │
│                            │                     │                  │
│                            ▼                     ▼                  │
│                     API 연동              테스트 작성                │
│                     결제 플로우              │                       │
│                                                                     │
│  Day 5: 통합 & 테스트                                               │
│  ─────────────────────────────────────────────────────────────────  │
│  터미널 4 (Test)       터미널 5 (Review)                             │
│      │                     │                                        │
│      ▼                     ▼                                        │
│  E2E 테스트            코드 리뷰                                     │
│  보안 검증             문서 작성                                     │
│      │                     │                                        │
│      └──── 피드백 ─────────┘                                        │
│                                                                     │
│  터미널 1, 2: 피드백 반영                                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 📋 터미널 간 정보 전달 템플릿

```markdown
## 터미널 간 전달 메시지

### DB → Backend 전달
"터미널 3에서 DB 스키마 완료.
- 생성된 모델: Subscription, BillingKey, Payment, CreditTransaction
- 마이그레이션 적용 완료
- 모델 import: from app.models import Subscription, Payment, ...
이제 서비스 로직 구현 가능해."

### Backend → Frontend 전달
"터미널 1에서 API 완료.
- POST /api/v1/subscription/create → customerKey 반환
- POST /api/v1/subscription/confirm → authKey, customerKey 받음
- Swagger 문서: http://localhost:8000/docs
이제 프론트 연동 가능해."

### Frontend → Test 전달
"터미널 2에서 결제 UI 완료.
- 구독 페이지: /payment/subscribe
- 성공 페이지: /payment/subscribe/success
- 테스트 시 토스 테스트 카드 사용해줘."

### Test → All 전달
"터미널 4 테스트 결과:
- 통과: 12/15
- 실패: 3개 (상세 내용 아래)
1. 환불 금액 검증 누락 (터미널 1 수정 필요)
2. 에러 메시지 미표시 (터미널 2 수정 필요)
3. ..."
```

---

## 📌 빠른 참조: 터미널별 핵심 명령

| 터미널 | 세션명 | 시작 명령 | 주요 파일 |
|--------|--------|----------|----------|
| 1 | backend-api | `/rename backend-api` | backend/app/services/, api/v1/ |
| 2 | frontend-ui | `/rename frontend-ui` | frontend/app/payment/ |
| 3 | database | `/rename database` | backend/app/models/ |
| 4 | testing | `/rename testing` | backend/tests/ |
| 5 | docs-review | `/rename docs-review` | docs/ |

---

*CodeGen AI 프로젝트 멀티 터미널 가이드 v1.0*
*PRD v3.1 기반*
