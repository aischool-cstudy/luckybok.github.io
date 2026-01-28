# AI 기반 코딩 교육 콘텐츠 자동 생성기 PRD v3.1
## 성인 대상 프로그래밍 언어 특화 + 토스페이먼츠 결제 시스템

---

# Executive Summary

| 항목 | 내용 |
|------|------|
| **프로젝트명** | CodeGen AI - 코딩 교육 콘텐츠 자동 생성기 |
| **버전** | 3.1 (토스페이먼츠 결제 시스템 포함) |
| **작성일** | 2025년 1월 28일 |
| **타겟 사용자** | 성인 학습자 대상 코딩 강사, 기업 개발 교육 담당자 |
| **핵심 가치** | "10분 안에 실무형 코딩 교육 콘텐츠 완성" |
| **결제 시스템** | 토스페이먼츠 (정기결제 + 단건결제) |

---

# Part A: 타겟 및 시장 분석

## 1. 타겟 사용자 세분화

### 1.1 학습자 페르소나 (성인 전용)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    성인 코딩 학습자 4대 페르소나                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [A: 비전공 직장인]        [B: 주니어 개발자]                          │
│  ├─ 마케팅, 기획, 영업     ├─ 전공자/부트캠프 수료                     │
│  ├─ 업무 자동화, 분석 목표  ├─ 신기술 습득, 실무 강화                   │
│  └─ 비유: 엑셀, 업무 도구   └─ 비유: 언어 비교, 아키텍처                │
│                                                                     │
│  [C: 관리자/임원]          [D: 커리어 전환자]                          │
│  ├─ PM, CTO, 창업자        ├─ 타 업종 경력자                          │
│  ├─ 기술 이해, 팀 소통     ├─ 개발자 취업, 포트폴리오                  │
│  └─ 비유: 조직, 경영       └─ 비유: 범용 (요리, 건축)                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. 지원 프로그래밍 언어

| 우선순위 | 언어 | 타겟 | 비유 도메인 |
|---------|------|------|-----------|
| **P0** | Python | 비전공자, 데이터 분석 | 엑셀, 업무 자동화 |
| **P0** | JavaScript | 웹 개발 입문 | 웹페이지, 인터랙션 |
| **P1** | SQL | 기획자, 마케터 | 엑셀 필터, 피벗 |
| **P1** | Java | 기업 개발자 | 설계도, 공장 |
| **P2** | TypeScript | 주니어 개발자 | JS + 계약서 |
| **P2** | Go | 백엔드 개발자 | 효율적 공장 |

---

# Part B: 전문가 페르소나 검토

## 3. 검토 패널 (7인)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Expert Review Panel (7인)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [교육]                    [기술]                   [비즈니스]        │
│  👨‍🏫 성인교육 전문가         💻 시니어 개발자          📊 부트캠프 운영자 │
│  🎓 기업교육 설계자 (ISD)   🔧 DevRel               💼 기업 HRD       │
│                                                                     │
│  [결제/보안]                                                         │
│  💳 PG 연동 전문가 (신규)                                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 4. 💳 PG 연동 전문가 검토

### 토스페이먼츠 선정 이유

| 항목 | 토스페이먼츠 | 경쟁사 A | 경쟁사 B |
|------|------------|---------|---------|
| 개발자 문서 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| 테스트 환경 | 즉시 사용 가능 | 신청 필요 | 신청 필요 |
| 정기결제 | 빌링키 방식 | 가능 | 가능 |
| 수수료 | 3.3% | 3.5% | 3.4% |
| Next.js 지원 | 공식 SDK | 커뮤니티 | 비공식 |
| 웹훅 안정성 | 높음 | 중간 | 중간 |

### 결제 보안 체크리스트

```
[필수 보안 요구사항]
☑ 시크릿 키 서버 사이드만 저장 (환경변수)
☑ 클라이언트에 시크릿 키 노출 금지
☑ 결제 금액 서버 사이드 검증
☑ 웹훅 서명 검증
☑ HTTPS 필수
☑ PCI-DSS 준수 (토스페이먼츠가 처리)

[권장 보안 사항]
☐ 결제 요청 중복 방지 (멱등성 키)
☐ 이상 결제 탐지 로직
☐ 결제 시도 횟수 제한
☐ 환불 권한 분리
```

---

# Part C: 결제 시스템 상세 설계

## 5. 가격 정책

### 5.1 요금제 구조

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CodeGen AI 요금제                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [Starter]          [Pro]              [Team]         [Enterprise]  │
│  ────────────       ────────────       ────────────   ────────────  │
│  무료               ₩29,900/월         ₩99,000/월     문의          │
│                     (연 ₩299,000)      (연 ₩990,000)                │
│                     17% 할인           17% 할인                      │
│                                                                     │
│  • 10회/일          • 100회/일         • 500회/일     • 무제한      │
│  • Python만         • 전체 언어        • 전체 언어    • 전체 언어   │
│  • 기본 기능        • 전체 기능        • 전체 기능    • 전체 기능   │
│                     • PDF 내보내기     • API 제공     • 전용 지원   │
│                     • 히스토리 30일    • 히스토리 무제한 • 온프레미스│
│                                        • 5명 계정                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 토큰/크레딧 추가 구매

| 패키지 | 가격 | 생성 횟수 | 단가 | 유효기간 |
|--------|------|----------|------|---------|
| Basic | ₩9,900 | 50회 | ₩198/회 | 90일 |
| Standard | ₩24,900 | 150회 | ₩166/회 | 90일 |
| Premium | ₩49,900 | 350회 | ₩143/회 | 180일 |

---

## 6. 토스페이먼츠 연동 아키텍처

### 6.1 결제 플로우 개요

```
┌─────────────────────────────────────────────────────────────────────┐
│                    토스페이먼츠 결제 플로우                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [단건 결제 - 토큰 추가 구매]                                         │
│                                                                     │
│  Client              Server              TossPayments               │
│    │                   │                      │                     │
│    │ 1. 결제 요청       │                      │                     │
│    │──────────────────▶│                      │                     │
│    │                   │ 2. 주문 생성          │                     │
│    │                   │─────────────────────▶│                     │
│    │                   │                      │                     │
│    │ 3. 결제창 호출 (SDK)                      │                     │
│    │─────────────────────────────────────────▶│                     │
│    │                   │                      │                     │
│    │ 4. 결제 완료 (리다이렉트)                  │                     │
│    │◀─────────────────────────────────────────│                     │
│    │                   │                      │                     │
│    │ 5. 결제 승인 요청  │                      │                     │
│    │──────────────────▶│ 6. 승인 API 호출     │                     │
│    │                   │─────────────────────▶│                     │
│    │                   │ 7. 승인 결과         │                     │
│    │                   │◀─────────────────────│                     │
│    │ 8. 결과 반환      │                      │                     │
│    │◀──────────────────│                      │                     │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  [정기 결제 - 구독]                                                  │
│                                                                     │
│  Client              Server              TossPayments               │
│    │                   │                      │                     │
│    │ 1. 구독 신청       │                      │                     │
│    │──────────────────▶│                      │                     │
│    │                   │                      │                     │
│    │ 2. 빌링키 발급 창  │                      │                     │
│    │─────────────────────────────────────────▶│                     │
│    │                   │                      │                     │
│    │ 3. 카드 정보 입력 완료                     │                     │
│    │◀─────────────────────────────────────────│                     │
│    │                   │                      │                     │
│    │ 4. authKey 전달   │                      │                     │
│    │──────────────────▶│ 5. 빌링키 발급 요청   │                     │
│    │                   │─────────────────────▶│                     │
│    │                   │ 6. billingKey 반환   │                     │
│    │                   │◀─────────────────────│                     │
│    │                   │                      │                     │
│    │                   │ [매월 결제일]         │                     │
│    │                   │ 7. 자동 결제 요청     │                     │
│    │                   │─────────────────────▶│                     │
│    │                   │ 8. 결제 결과         │                     │
│    │                   │◀─────────────────────│                     │
│    │                   │ 9. 웹훅 수신         │                     │
│    │                   │◀─────────────────────│                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 시스템 아키텍처 (결제 포함)

```
┌─────────────────────────────────────────────────────────────────────┐
│                  CodeGen AI - Full Architecture                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [Client Layer]                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Next.js App                                                  │  │
│  │  ├─ 콘텐츠 생성 UI                                            │  │
│  │  ├─ 결제 페이지 (토스페이먼츠 SDK)                             │  │
│  │  ├─ 구독 관리 대시보드                                        │  │
│  │  └─ 결제 완료/실패 페이지                                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│  [API Layer]                                                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  FastAPI Server                                               │  │
│  │  ├─ /api/content/*     (콘텐츠 생성)                          │  │
│  │  ├─ /api/payment/*     (결제 처리)                            │  │
│  │  ├─ /api/subscription/*(구독 관리)                            │  │
│  │  └─ /api/webhook/toss  (웹훅 수신)                            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│         ┌────────────────────┼────────────────────┐                │
│         ▼                    ▼                    ▼                │
│  ┌────────────┐      ┌────────────┐      ┌────────────┐           │
│  │  Content   │      │  Payment   │      │Subscription│           │
│  │  Service   │      │  Service   │      │  Service   │           │
│  │            │      │            │      │            │           │
│  │ • 생성     │      │ • 단건결제 │      │ • 구독생성 │           │
│  │ • 검증     │      │ • 승인     │      │ • 빌링키   │           │
│  │ • 내보내기 │      │ • 환불     │      │ • 자동결제 │           │
│  └────────────┘      └────────────┘      └────────────┘           │
│         │                    │                    │                │
│         │                    ▼                    │                │
│         │           ┌────────────┐                │                │
│         │           │TossPayments│                │                │
│         │           │   API      │                │                │
│         │           └────────────┘                │                │
│         │                    │                    │                │
│         └────────────────────┼────────────────────┘                │
│                              ▼                                      │
│  [Data Layer]                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  PostgreSQL                                                   │  │
│  │  ├─ users              (사용자)                               │  │
│  │  ├─ subscriptions      (구독 정보)                            │  │
│  │  ├─ billing_keys       (빌링키 - 암호화)                      │  │
│  │  ├─ payments           (결제 내역)                            │  │
│  │  ├─ credits            (크레딧/토큰)                          │  │
│  │  └─ generated_contents (생성 콘텐츠)                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  [Scheduler]                                                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Cron Jobs (정기 결제 처리)                                    │  │
│  │  ├─ 매일 00:00 - 당일 결제 대상 조회                           │  │
│  │  ├─ 결제 실행 (재시도 로직 포함)                               │  │
│  │  └─ 결제 실패 시 알림 발송                                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. 데이터베이스 스키마 (결제 관련)

```sql
-- =====================================================
-- 사용자 테이블 (확장)
-- =====================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    name VARCHAR(100),
    
    -- 요금제 정보
    plan VARCHAR(20) DEFAULT 'starter',  -- starter, pro, team, enterprise
    plan_started_at TIMESTAMP,
    plan_expires_at TIMESTAMP,
    
    -- 크레딧 정보
    credits_remaining INTEGER DEFAULT 10,
    credits_reset_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 구독 테이블
-- =====================================================
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- 구독 정보
    plan VARCHAR(20) NOT NULL,           -- pro, team
    billing_cycle VARCHAR(10) NOT NULL,  -- monthly, yearly
    amount INTEGER NOT NULL,              -- 결제 금액 (원)
    
    -- 상태
    status VARCHAR(20) DEFAULT 'active', -- active, cancelled, past_due, expired
    
    -- 결제 주기
    current_period_start TIMESTAMP NOT NULL,
    current_period_end TIMESTAMP NOT NULL,
    next_billing_date DATE NOT NULL,
    
    -- 취소 정보
    cancelled_at TIMESTAMP,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    cancellation_reason TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_next_billing ON subscriptions(next_billing_date);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- =====================================================
-- 빌링키 테이블 (암호화 저장)
-- =====================================================
CREATE TABLE billing_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
    
    -- 토스페이먼츠 빌링키 (암호화)
    billing_key_encrypted TEXT NOT NULL,  -- AES-256 암호화
    
    -- 카드 정보 (마스킹)
    card_company VARCHAR(50),             -- 카드사
    card_number_masked VARCHAR(20),       -- **** **** **** 1234
    card_type VARCHAR(20),                -- 신용, 체크
    
    -- 상태
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_billing_keys_user ON billing_keys(user_id);

-- =====================================================
-- 결제 내역 테이블
-- =====================================================
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    
    -- 토스페이먼츠 정보
    toss_payment_key VARCHAR(200) UNIQUE, -- paymentKey
    toss_order_id VARCHAR(100) NOT NULL,  -- orderId
    
    -- 결제 정보
    payment_type VARCHAR(20) NOT NULL,    -- one_time, subscription
    product_type VARCHAR(50) NOT NULL,    -- pro_monthly, credits_50, etc.
    amount INTEGER NOT NULL,               -- 결제 금액
    
    -- 상태
    status VARCHAR(20) NOT NULL,          -- pending, completed, failed, cancelled, refunded
    
    -- 결제 수단 정보
    method VARCHAR(30),                   -- 카드, 계좌이체, 가상계좌
    card_company VARCHAR(50),
    card_number_masked VARCHAR(20),
    
    -- 영수증
    receipt_url TEXT,
    
    -- 실패 정보
    failure_code VARCHAR(50),
    failure_message TEXT,
    
    -- 환불 정보
    refunded_amount INTEGER DEFAULT 0,
    refunded_at TIMESTAMP,
    refund_reason TEXT,
    
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_toss_order ON payments(toss_order_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created ON payments(created_at DESC);

-- =====================================================
-- 크레딧 거래 내역
-- =====================================================
CREATE TABLE credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    
    -- 거래 정보
    transaction_type VARCHAR(20) NOT NULL, -- purchase, use, refund, bonus, reset
    amount INTEGER NOT NULL,                -- 변동량 (+/-)
    balance_after INTEGER NOT NULL,         -- 거래 후 잔액
    
    -- 상세
    description TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_credit_tx_user ON credit_transactions(user_id);

-- =====================================================
-- 결제 웹훅 로그
-- =====================================================
CREATE TABLE webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 웹훅 정보
    event_type VARCHAR(50) NOT NULL,       -- PAYMENT_STATUS_CHANGED, etc.
    payload JSONB NOT NULL,
    
    -- 처리 결과
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP,
    error_message TEXT,
    
    received_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_webhook_processed ON webhook_logs(processed);
```

---

## 8. API 엔드포인트 (결제)

### 8.1 결제 API 명세

```yaml
# =====================================================
# 결제 관련 API 엔드포인트
# =====================================================

# 단건 결제 (크레딧 구매)
POST /api/v1/payment/credits:
  summary: 크레딧 패키지 결제 시작
  request:
    body:
      package_type: "basic" | "standard" | "premium"
  response:
    order_id: string
    amount: number
    order_name: string
    customer_key: string

POST /api/v1/payment/confirm:
  summary: 결제 승인 (토스페이먼츠 → 서버)
  request:
    body:
      payment_key: string   # 토스페이먼츠 paymentKey
      order_id: string
      amount: number
  response:
    success: boolean
    payment_id: string
    credits_added: number

# 구독 결제
POST /api/v1/subscription/create:
  summary: 구독 시작 (빌링키 발급 요청)
  request:
    body:
      plan: "pro" | "team"
      billing_cycle: "monthly" | "yearly"
  response:
    customer_key: string
    # 클라이언트에서 토스 빌링키 발급 창 호출

POST /api/v1/subscription/confirm:
  summary: 빌링키 발급 완료 및 첫 결제
  request:
    body:
      auth_key: string      # 토스에서 받은 authKey
      customer_key: string
  response:
    success: boolean
    subscription_id: string
    next_billing_date: string

DELETE /api/v1/subscription/{subscription_id}:
  summary: 구독 취소
  request:
    body:
      reason: string
      cancel_immediately: boolean  # true: 즉시, false: 기간 종료 시
  response:
    success: boolean
    cancel_at: string

# 구독 조회
GET /api/v1/subscription/current:
  summary: 현재 구독 정보 조회
  response:
    plan: string
    status: string
    current_period_end: string
    next_billing_date: string
    payment_method:
      card_company: string
      card_number_masked: string

# 결제 내역
GET /api/v1/payments:
  summary: 결제 내역 조회
  query:
    page: number
    limit: number
  response:
    payments: Payment[]
    total: number

# 환불 요청
POST /api/v1/payment/{payment_id}/refund:
  summary: 환불 요청
  request:
    body:
      amount: number        # 부분 환불 시 금액
      reason: string
  response:
    success: boolean
    refunded_amount: number

# 웹훅
POST /api/v1/webhook/toss:
  summary: 토스페이먼츠 웹훅 수신
  headers:
    TossPayments-Signature: string  # 서명 검증용
  request:
    body:
      eventType: string
      data: object
```

---

## 9. 핵심 코드 구현

### 9.1 토스페이먼츠 서비스 클래스

```python
# services/payment_service.py

import httpx
import base64
from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel

class TossPaymentsService:
    """토스페이먼츠 API 연동 서비스"""
    
    BASE_URL = "https://api.tosspayments.com/v1"
    
    def __init__(self, secret_key: str):
        # Base64 인코딩된 시크릿 키 (시크릿키:)
        self.auth_header = base64.b64encode(
            f"{secret_key}:".encode()
        ).decode()
        
        self.headers = {
            "Authorization": f"Basic {self.auth_header}",
            "Content-Type": "application/json"
        }
    
    # ─────────────────────────────────────────────
    # 단건 결제
    # ─────────────────────────────────────────────
    
    async def confirm_payment(
        self, 
        payment_key: str, 
        order_id: str, 
        amount: int
    ) -> dict:
        """결제 승인"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.BASE_URL}/payments/confirm",
                headers=self.headers,
                json={
                    "paymentKey": payment_key,
                    "orderId": order_id,
                    "amount": amount
                }
            )
            
            if response.status_code != 200:
                error = response.json()
                raise PaymentError(
                    code=error.get("code"),
                    message=error.get("message")
                )
            
            return response.json()
    
    async def cancel_payment(
        self,
        payment_key: str,
        cancel_reason: str,
        cancel_amount: Optional[int] = None  # None이면 전액 취소
    ) -> dict:
        """결제 취소/환불"""
        payload = {"cancelReason": cancel_reason}
        if cancel_amount:
            payload["cancelAmount"] = cancel_amount
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.BASE_URL}/payments/{payment_key}/cancel",
                headers=self.headers,
                json=payload
            )
            
            if response.status_code != 200:
                error = response.json()
                raise PaymentError(
                    code=error.get("code"),
                    message=error.get("message")
                )
            
            return response.json()
    
    # ─────────────────────────────────────────────
    # 정기 결제 (빌링)
    # ─────────────────────────────────────────────
    
    async def issue_billing_key(
        self,
        auth_key: str,
        customer_key: str
    ) -> dict:
        """빌링키 발급"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.BASE_URL}/billing/authorizations/issue",
                headers=self.headers,
                json={
                    "authKey": auth_key,
                    "customerKey": customer_key
                }
            )
            
            if response.status_code != 200:
                error = response.json()
                raise PaymentError(
                    code=error.get("code"),
                    message=error.get("message")
                )
            
            return response.json()
    
    async def charge_billing(
        self,
        billing_key: str,
        customer_key: str,
        amount: int,
        order_id: str,
        order_name: str
    ) -> dict:
        """빌링키로 자동 결제"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.BASE_URL}/billing/{billing_key}",
                headers=self.headers,
                json={
                    "customerKey": customer_key,
                    "amount": amount,
                    "orderId": order_id,
                    "orderName": order_name
                }
            )
            
            if response.status_code != 200:
                error = response.json()
                raise PaymentError(
                    code=error.get("code"),
                    message=error.get("message")
                )
            
            return response.json()
    
    # ─────────────────────────────────────────────
    # 웹훅 검증
    # ─────────────────────────────────────────────
    
    def verify_webhook_signature(
        self,
        payload: bytes,
        signature: str
    ) -> bool:
        """웹훅 서명 검증"""
        import hmac
        import hashlib
        
        expected = hmac.new(
            self.secret_key.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(expected, signature)


class PaymentError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(f"[{code}] {message}")
```

### 9.2 구독 서비스

```python
# services/subscription_service.py

from datetime import datetime, date
from dateutil.relativedelta import relativedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

class SubscriptionService:
    """구독 관리 서비스"""
    
    PLANS = {
        "pro": {
            "monthly": {"amount": 29900, "credits": 100},
            "yearly": {"amount": 299000, "credits": 100}
        },
        "team": {
            "monthly": {"amount": 99000, "credits": 500},
            "yearly": {"amount": 990000, "credits": 500}
        }
    }
    
    def __init__(
        self, 
        db: AsyncSession,
        toss_service: TossPaymentsService
    ):
        self.db = db
        self.toss = toss_service
    
    async def create_subscription(
        self,
        user_id: str,
        auth_key: str,
        customer_key: str,
        plan: str,
        billing_cycle: str
    ) -> Subscription:
        """구독 생성 및 첫 결제"""
        
        plan_info = self.PLANS[plan][billing_cycle]
        amount = plan_info["amount"]
        
        # 1. 빌링키 발급
        billing_result = await self.toss.issue_billing_key(
            auth_key=auth_key,
            customer_key=customer_key
        )
        
        billing_key = billing_result["billingKey"]
        card_info = billing_result.get("card", {})
        
        # 2. 빌링키 저장 (암호화)
        encrypted_key = encrypt_billing_key(billing_key)
        
        billing_key_record = BillingKey(
            user_id=user_id,
            billing_key_encrypted=encrypted_key,
            card_company=card_info.get("company"),
            card_number_masked=card_info.get("number"),
            card_type=card_info.get("cardType")
        )
        self.db.add(billing_key_record)
        
        # 3. 첫 결제 실행
        order_id = generate_order_id()
        order_name = f"CodeGen AI {plan.upper()} ({billing_cycle})"
        
        payment_result = await self.toss.charge_billing(
            billing_key=billing_key,
            customer_key=customer_key,
            amount=amount,
            order_id=order_id,
            order_name=order_name
        )
        
        # 4. 구독 정보 저장
        now = datetime.now()
        if billing_cycle == "monthly":
            period_end = now + relativedelta(months=1)
        else:
            period_end = now + relativedelta(years=1)
        
        subscription = Subscription(
            user_id=user_id,
            plan=plan,
            billing_cycle=billing_cycle,
            amount=amount,
            status="active",
            current_period_start=now,
            current_period_end=period_end,
            next_billing_date=period_end.date()
        )
        self.db.add(subscription)
        
        # 5. 결제 내역 저장
        payment = Payment(
            user_id=user_id,
            subscription_id=subscription.id,
            toss_payment_key=payment_result["paymentKey"],
            toss_order_id=order_id,
            payment_type="subscription",
            product_type=f"{plan}_{billing_cycle}",
            amount=amount,
            status="completed",
            method=payment_result.get("method"),
            card_company=card_info.get("company"),
            card_number_masked=card_info.get("number"),
            receipt_url=payment_result.get("receipt", {}).get("url"),
            paid_at=now
        )
        self.db.add(payment)
        
        # 6. 사용자 플랜 업데이트
        await self.db.execute(
            update(User)
            .where(User.id == user_id)
            .values(
                plan=plan,
                plan_started_at=now,
                plan_expires_at=period_end,
                credits_remaining=plan_info["credits"]
            )
        )
        
        await self.db.commit()
        
        return subscription
    
    async def cancel_subscription(
        self,
        subscription_id: str,
        reason: str,
        cancel_immediately: bool = False
    ) -> Subscription:
        """구독 취소"""
        
        subscription = await self.db.get(Subscription, subscription_id)
        
        if cancel_immediately:
            subscription.status = "cancelled"
            subscription.cancelled_at = datetime.now()
            
            # 사용자 플랜 다운그레이드
            await self.db.execute(
                update(User)
                .where(User.id == subscription.user_id)
                .values(plan="starter")
            )
        else:
            # 기간 종료 시 취소
            subscription.cancel_at_period_end = True
        
        subscription.cancellation_reason = reason
        
        await self.db.commit()
        
        return subscription
    
    async def process_recurring_payments(self):
        """정기 결제 처리 (스케줄러에서 호출)"""
        
        today = date.today()
        
        # 오늘 결제 대상 구독 조회
        result = await self.db.execute(
            select(Subscription)
            .where(
                Subscription.next_billing_date == today,
                Subscription.status == "active",
                Subscription.cancel_at_period_end == False
            )
        )
        subscriptions = result.scalars().all()
        
        for sub in subscriptions:
            try:
                await self._process_single_payment(sub)
            except PaymentError as e:
                await self._handle_payment_failure(sub, e)
    
    async def _process_single_payment(self, sub: Subscription):
        """개별 구독 결제 처리"""
        
        # 빌링키 조회 및 복호화
        billing_key_record = await self.db.execute(
            select(BillingKey)
            .where(
                BillingKey.subscription_id == sub.id,
                BillingKey.is_active == True
            )
        )
        billing_key_record = billing_key_record.scalar_one()
        billing_key = decrypt_billing_key(
            billing_key_record.billing_key_encrypted
        )
        
        # 결제 실행
        order_id = generate_order_id()
        result = await self.toss.charge_billing(
            billing_key=billing_key,
            customer_key=str(sub.user_id),
            amount=sub.amount,
            order_id=order_id,
            order_name=f"CodeGen AI {sub.plan.upper()} 정기결제"
        )
        
        # 구독 기간 갱신
        now = datetime.now()
        if sub.billing_cycle == "monthly":
            new_period_end = now + relativedelta(months=1)
        else:
            new_period_end = now + relativedelta(years=1)
        
        sub.current_period_start = now
        sub.current_period_end = new_period_end
        sub.next_billing_date = new_period_end.date()
        
        # 크레딧 리셋
        plan_info = self.PLANS[sub.plan][sub.billing_cycle]
        await self.db.execute(
            update(User)
            .where(User.id == sub.user_id)
            .values(
                credits_remaining=plan_info["credits"],
                credits_reset_at=now
            )
        )
        
        await self.db.commit()
    
    async def _handle_payment_failure(
        self, 
        sub: Subscription, 
        error: PaymentError
    ):
        """결제 실패 처리"""
        
        # 실패 횟수 체크 (3회까지 재시도)
        # past_due 상태로 변경
        # 사용자에게 알림 발송
        
        sub.status = "past_due"
        await self.db.commit()
        
        # 이메일/푸시 알림 발송
        await send_payment_failure_notification(
            user_id=sub.user_id,
            error_message=error.message
        )
```

### 9.3 Next.js 결제 페이지

```tsx
// app/payment/subscribe/page.tsx

'use client';

import { useState } from 'react';
import { loadTossPayments } from '@tosspayments/payment-sdk';

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!;

interface PlanOption {
  plan: 'pro' | 'team';
  billingCycle: 'monthly' | 'yearly';
  amount: number;
  displayPrice: string;
}

const PLAN_OPTIONS: PlanOption[] = [
  { plan: 'pro', billingCycle: 'monthly', amount: 29900, displayPrice: '₩29,900/월' },
  { plan: 'pro', billingCycle: 'yearly', amount: 299000, displayPrice: '₩299,000/년 (17% 할인)' },
  { plan: 'team', billingCycle: 'monthly', amount: 99000, displayPrice: '₩99,000/월' },
  { plan: 'team', billingCycle: 'yearly', amount: 990000, displayPrice: '₩990,000/년 (17% 할인)' },
];

export default function SubscribePage() {
  const [selectedPlan, setSelectedPlan] = useState<PlanOption | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async () => {
    if (!selectedPlan) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // 1. 서버에서 customerKey 발급
      const response = await fetch('/api/subscription/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: selectedPlan.plan,
          billing_cycle: selectedPlan.billingCycle,
        }),
      });

      const { customerKey } = await response.json();

      // 2. 토스페이먼츠 SDK 로드
      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);

      // 3. 빌링키 발급 (카드 등록) 창 호출
      await tossPayments.requestBillingAuth('카드', {
        customerKey,
        successUrl: `${window.location.origin}/payment/subscribe/success`,
        failUrl: `${window.location.origin}/payment/subscribe/fail`,
      });
    } catch (err) {
      setError('결제 준비 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">구독 플랜 선택</h1>

      <div className="space-y-4">
        {PLAN_OPTIONS.map((option) => (
          <div
            key={`${option.plan}-${option.billingCycle}`}
            onClick={() => setSelectedPlan(option)}
            className={`p-4 border rounded-lg cursor-pointer transition
              ${selectedPlan === option 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
              }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <span className="font-semibold text-lg">
                  {option.plan.toUpperCase()}
                </span>
                <span className="text-gray-500 ml-2">
                  ({option.billingCycle === 'monthly' ? '월간' : '연간'})
                </span>
              </div>
              <span className="text-lg font-bold">{option.displayPrice}</span>
            </div>
            <ul className="mt-2 text-sm text-gray-600">
              <li>• {option.plan === 'pro' ? '100회/일' : '500회/일'} 생성</li>
              <li>• 전체 언어 지원</li>
              <li>• {option.plan === 'team' ? 'API 제공 + 5명 계정' : 'PDF 내보내기'}</li>
            </ul>
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-600 rounded">
          {error}
        </div>
      )}

      <button
        onClick={handleSubscribe}
        disabled={!selectedPlan || isLoading}
        className={`mt-6 w-full py-3 rounded-lg font-semibold text-white
          ${selectedPlan && !isLoading
            ? 'bg-blue-600 hover:bg-blue-700'
            : 'bg-gray-300 cursor-not-allowed'
          }`}
      >
        {isLoading ? '처리 중...' : '구독 시작하기'}
      </button>

      <p className="mt-4 text-sm text-gray-500 text-center">
        결제는 토스페이먼츠를 통해 안전하게 처리됩니다.
        <br />
        언제든지 구독을 취소할 수 있습니다.
      </p>
    </div>
  );
}
```

### 9.4 결제 성공 처리

```tsx
// app/payment/subscribe/success/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function SubscribeSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('결제를 확인하고 있습니다...');

  useEffect(() => {
    const confirmSubscription = async () => {
      const authKey = searchParams.get('authKey');
      const customerKey = searchParams.get('customerKey');

      if (!authKey || !customerKey) {
        setStatus('error');
        setMessage('잘못된 접근입니다.');
        return;
      }

      try {
        const response = await fetch('/api/subscription/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ authKey, customerKey }),
        });

        const result = await response.json();

        if (response.ok) {
          setStatus('success');
          setMessage('구독이 시작되었습니다! 🎉');
          
          // 3초 후 대시보드로 이동
          setTimeout(() => {
            router.push('/dashboard');
          }, 3000);
        } else {
          setStatus('error');
          setMessage(result.message || '결제 처리 중 오류가 발생했습니다.');
        }
      } catch (err) {
        setStatus('error');
        setMessage('서버 오류가 발생했습니다.');
      }
    };

    confirmSubscription();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center p-8">
        {status === 'processing' && (
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
        )}
        
        {status === 'success' && (
          <div className="text-6xl mb-4">✅</div>
        )}
        
        {status === 'error' && (
          <div className="text-6xl mb-4">❌</div>
        )}

        <h1 className="text-2xl font-bold mt-4">{message}</h1>
        
        {status === 'success' && (
          <p className="text-gray-500 mt-2">잠시 후 대시보드로 이동합니다...</p>
        )}
        
        {status === 'error' && (
          <button
            onClick={() => router.push('/payment/subscribe')}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            다시 시도
          </button>
        )}
      </div>
    </div>
  );
}
```

### 9.5 웹훅 처리

```python
# api/webhook/toss.py

from fastapi import APIRouter, Request, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

@router.post("/webhook/toss")
async def handle_toss_webhook(
    request: Request,
    toss_signature: str = Header(None, alias="TossPayments-Signature"),
    db: AsyncSession = Depends(get_db)
):
    """토스페이먼츠 웹훅 수신"""
    
    # 1. 원본 페이로드 추출
    payload = await request.body()
    
    # 2. 서명 검증
    toss_service = TossPaymentsService(settings.TOSS_SECRET_KEY)
    if not toss_service.verify_webhook_signature(payload, toss_signature):
        raise HTTPException(status_code=401, detail="Invalid signature")
    
    # 3. 이벤트 파싱
    data = await request.json()
    event_type = data.get("eventType")
    
    # 4. 웹훅 로그 저장
    webhook_log = WebhookLog(
        event_type=event_type,
        payload=data
    )
    db.add(webhook_log)
    
    # 5. 이벤트 타입별 처리
    try:
        if event_type == "PAYMENT_STATUS_CHANGED":
            await handle_payment_status_changed(db, data)
        elif event_type == "BILLING_KEY_DELETED":
            await handle_billing_key_deleted(db, data)
        # ... 기타 이벤트
        
        webhook_log.processed = True
        webhook_log.processed_at = datetime.now()
        
    except Exception as e:
        webhook_log.error_message = str(e)
        raise
    
    finally:
        await db.commit()
    
    return {"success": True}


async def handle_payment_status_changed(db: AsyncSession, data: dict):
    """결제 상태 변경 처리"""
    
    payment_data = data.get("data", {})
    payment_key = payment_data.get("paymentKey")
    status = payment_data.get("status")
    
    # 결제 상태 업데이트
    await db.execute(
        update(Payment)
        .where(Payment.toss_payment_key == payment_key)
        .values(status=map_toss_status(status))
    )


async def handle_billing_key_deleted(db: AsyncSession, data: dict):
    """빌링키 삭제 처리 (카드 변경 등)"""
    
    billing_key = data.get("data", {}).get("billingKey")
    
    # 빌링키 비활성화
    await db.execute(
        update(BillingKey)
        .where(BillingKey.billing_key_encrypted == encrypt_billing_key(billing_key))
        .values(is_active=False)
    )
```

---

## 10. 환불 정책

### 10.1 환불 규정

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CodeGen AI 환불 정책                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [구독 환불]                                                         │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  • 결제 후 7일 이내: 전액 환불                                        │
│    - 단, 해당 기간 크레딧 사용량 50% 미만인 경우                       │
│    - 50% 이상 사용 시 환불 불가                                       │
│                                                                     │
│  • 결제 후 7일 초과: 환불 불가                                        │
│    - 남은 기간 종료 시까지 서비스 이용 가능                            │
│    - 다음 결제부터 자동 취소                                          │
│                                                                     │
│  • 연간 구독 중도 해지:                                               │
│    - 월할 계산 후 잔여 기간 환불 (수수료 10% 공제)                     │
│    - 예: 6개월 사용 후 해지 시                                        │
│      299,000 ÷ 12 × 6 = 149,500원 사용                               │
│      환불액 = (299,000 - 149,500) × 0.9 = 134,550원                  │
│                                                                     │
│  [크레딧 환불]                                                       │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  • 구매 후 7일 이내 + 미사용: 전액 환불                               │
│  • 부분 사용: 미사용분 환불 (최소 50% 이상 잔여 시)                    │
│  • 유효기간 만료: 환불 불가                                           │
│                                                                     │
│  [환불 처리 기간]                                                    │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  • 신용카드: 3-5 영업일                                              │
│  • 계좌이체: 1-2 영업일                                              │
│  • 가상계좌: 1-2 영업일 (환불 계좌 필요)                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 10.2 환불 처리 로직

```python
# services/refund_service.py

class RefundService:
    """환불 처리 서비스"""
    
    async def process_refund(
        self,
        payment_id: str,
        user_id: str,
        reason: str,
        amount: Optional[int] = None  # None이면 전액
    ) -> RefundResult:
        """환불 처리"""
        
        payment = await self.db.get(Payment, payment_id)
        
        # 1. 환불 가능 여부 검증
        validation = await self._validate_refund(payment, user_id, amount)
        if not validation.is_valid:
            raise RefundError(validation.error_message)
        
        # 2. 환불 금액 계산
        refund_amount = amount or payment.amount - payment.refunded_amount
        
        # 3. 토스페이먼츠 환불 요청
        result = await self.toss.cancel_payment(
            payment_key=payment.toss_payment_key,
            cancel_reason=reason,
            cancel_amount=refund_amount
        )
        
        # 4. DB 업데이트
        payment.refunded_amount += refund_amount
        payment.refunded_at = datetime.now()
        payment.refund_reason = reason
        
        if payment.refunded_amount >= payment.amount:
            payment.status = "refunded"
        
        # 5. 구독인 경우 플랜 다운그레이드
        if payment.payment_type == "subscription":
            await self._handle_subscription_refund(payment)
        
        # 6. 크레딧인 경우 크레딧 차감
        if payment.payment_type == "one_time":
            await self._handle_credit_refund(payment, refund_amount)
        
        await self.db.commit()
        
        return RefundResult(
            success=True,
            refunded_amount=refund_amount,
            payment_status=payment.status
        )
    
    async def _validate_refund(
        self, 
        payment: Payment, 
        user_id: str,
        amount: Optional[int]
    ) -> ValidationResult:
        """환불 유효성 검증"""
        
        # 본인 결제인지 확인
        if str(payment.user_id) != user_id:
            return ValidationResult(False, "본인의 결제만 환불 가능합니다.")
        
        # 이미 환불된 결제인지 확인
        if payment.status == "refunded":
            return ValidationResult(False, "이미 환불된 결제입니다.")
        
        # 결제 후 7일 체크
        days_since_payment = (datetime.now() - payment.paid_at).days
        
        if payment.payment_type == "subscription":
            if days_since_payment > 7:
                # 7일 초과 시 사용량 체크
                usage = await self._get_period_usage(payment.user_id)
                if usage > 0.5:
                    return ValidationResult(
                        False, 
                        "7일 초과 및 50% 이상 사용하여 환불이 불가합니다."
                    )
        
        return ValidationResult(True)
```

---

## 11. 보안 체크리스트

### 11.1 결제 보안

```python
# 환경 변수 설정 예시 (.env)
# ⚠️ 절대 코드에 하드코딩 금지!

# 토스페이먼츠 키
TOSS_CLIENT_KEY=test_ck_xxx        # 클라이언트 키 (공개 가능)
TOSS_SECRET_KEY=test_sk_xxx        # 시크릿 키 (서버만!)

# 암호화 키 (빌링키 암호화용)
BILLING_KEY_ENCRYPTION_KEY=your-32-char-key-here

# 웹훅 시크릿
TOSS_WEBHOOK_SECRET=your-webhook-secret
```

### 11.2 보안 설정 코드

```python
# config/security.py

from cryptography.fernet import Fernet
import os

class SecurityConfig:
    """보안 설정"""
    
    # 빌링키 암호화
    @staticmethod
    def encrypt_billing_key(billing_key: str) -> str:
        """빌링키 AES 암호화"""
        key = os.environ["BILLING_KEY_ENCRYPTION_KEY"].encode()
        f = Fernet(key)
        return f.encrypt(billing_key.encode()).decode()
    
    @staticmethod
    def decrypt_billing_key(encrypted: str) -> str:
        """빌링키 복호화"""
        key = os.environ["BILLING_KEY_ENCRYPTION_KEY"].encode()
        f = Fernet(key)
        return f.decrypt(encrypted.encode()).decode()
    
    # 결제 금액 검증
    @staticmethod
    def validate_payment_amount(
        product_type: str, 
        claimed_amount: int
    ) -> bool:
        """서버 사이드 결제 금액 검증"""
        VALID_AMOUNTS = {
            "pro_monthly": 29900,
            "pro_yearly": 299000,
            "team_monthly": 99000,
            "team_yearly": 990000,
            "credits_basic": 9900,
            "credits_standard": 24900,
            "credits_premium": 49900,
        }
        
        expected = VALID_AMOUNTS.get(product_type)
        return expected is not None and expected == claimed_amount
```

---

## 12. 개발 로드맵 (결제 포함)

```
┌─────────────────────────────────────────────────────────────────────┐
│                 CodeGen AI - 14주 개발 로드맵 (결제 포함)             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  PHASE 1: Core (Week 1-4)                                           │
│  ════════════════════════════════════════════════════════════       │
│  Week 1-2: 프롬프트 엔지니어링 + 백엔드 기초                          │
│  Week 3-4: 콘텐츠 생성 API + 코드 검증                               │
│  ★ Milestone: Python 설명문 생성 작동                                │
│                                                                     │
│  PHASE 2: Features (Week 5-8)                                       │
│  ════════════════════════════════════════════════════════════       │
│  Week 5-6: 프론트엔드 + 퀴즈/실습                                    │
│  Week 7-8: JS/SQL 확장 + PDF 내보내기                                │
│  ★ Milestone: Alpha Release (3개 언어)                               │
│                                                                     │
│  PHASE 3: Payment (Week 9-11) ← 결제 시스템                          │
│  ════════════════════════════════════════════════════════════       │
│  Week 9: 토스페이먼츠 연동                                           │
│  ├─ 테스트 환경 설정                                                 │
│  ├─ 단건 결제 (크레딧 구매) 구현                                     │
│  └─ 결제 UI 개발                                                     │
│                                                                     │
│  Week 10: 정기 결제 (구독)                                           │
│  ├─ 빌링키 발급/저장 구현                                            │
│  ├─ 자동 결제 스케줄러                                               │
│  ├─ 구독 관리 UI                                                     │
│  └─ 웹훅 처리                                                        │
│                                                                     │
│  Week 11: 환불 + 결제 QA                                             │
│  ├─ 환불 로직 구현                                                   │
│  ├─ 결제 실패 처리                                                   │
│  ├─ 결제 플로우 전체 테스트                                          │
│  └─ 보안 감사                                                        │
│  ★ Milestone: 결제 시스템 완료                                       │
│                                                                     │
│  PHASE 4: Launch (Week 12-14)                                       │
│  ════════════════════════════════════════════════════════════       │
│  Week 12: 베타 테스트 (결제 포함)                                     │
│  Week 13: 피드백 반영 + Java/TS 추가                                 │
│  Week 14: 정식 출시                                                  │
│  ★ Milestone: Public Launch 🚀                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 13. 운영 대시보드 (결제 모니터링)

```
┌─────────────────────────────────────────────────────────────────────┐
│                  CodeGen AI - Payment Dashboard                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [Revenue - This Month]                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │   MRR       │  │   New Sub   │  │  Churn Rate │                 │
│  │ ₩4,850,000  │  │     47      │  │    3.2%     │                 │
│  │   ▲ 12%    │  │   ▲ 8%     │  │   ▼ 0.5%   │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
│                                                                     │
│  [Subscription Distribution]                                        │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Starter (Free)  ████████████████████████████████  68%        │ │
│  │  Pro Monthly     ████████████████  22%                        │ │
│  │  Pro Yearly      ████  6%                                     │ │
│  │  Team           ██  4%                                        │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  [Payment Status - Last 24h]                                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │  Success    │  │   Failed    │  │  Refunded   │                 │
│  │     127     │  │      3      │  │      2      │                 │
│  │    96.2%    │  │    2.3%     │  │    1.5%     │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
│                                                                     │
│  [Alerts]                                                           │
│  ⚠️ 결제 실패율 2% 초과 (임계값: 2%)                                 │
│  ⚠️ 3명 고객 결제 재시도 필요                                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 14. 성공 지표 (결제 포함)

| 지표 | 목표 | 측정 방법 |
|------|------|----------|
| **결제 전환율** | 8%+ | 가입자 → 유료 전환 |
| **MRR** | ₩10M (Y1) | 월간 반복 매출 |
| **결제 성공률** | 98%+ | 성공/시도 |
| **환불율** | <3% | 환불/전체 결제 |
| **구독 유지율** | 85%+ | 월간 갱신율 |
| **LTV** | ₩300,000+ | 고객 생애 가치 |
| **CAC Payback** | <3개월 | 획득 비용 회수 기간 |

---

# 부록

## A. 토스페이먼츠 테스트 정보

```yaml
# 테스트 환경 설정

테스트 URL: https://api.tosspayments.com
테스트 클라이언트 키: test_ck_... (콘솔에서 발급)
테스트 시크릿 키: test_sk_... (콘솔에서 발급)

# 테스트 카드 번호
성공: 4330000000000000 (만료: 12/24, CVC: 123, 비밀번호: 00)
실패: 4000000000000000
잔액부족: 4111111111111111

# 테스트 시 주의사항
- 테스트 키로 결제 시 실제 결제되지 않음
- 웹훅은 테스트 환경에서도 동작
- 라이브 전환 전 반드시 테스트 결제 시나리오 검증
```

## B. 체크리스트 (출시 전)

```
[결제 시스템 출시 체크리스트]

☐ 토스페이먼츠 심사 완료
☐ 사업자등록증 등록
☐ 라이브 API 키 발급
☐ 웹훅 URL 등록 (라이브)
☐ 환불 정책 페이지 게시
☐ 이용약관 결제 조항 추가
☐ 개인정보처리방침 결제 정보 추가
☐ 결제 플로우 전체 테스트 (라이브 키)
☐ PCI-DSS 준수 확인
☐ 보안 감사 완료
☐ 결제 실패 알림 설정
☐ 모니터링 대시보드 설정
```

---

**문서 버전**: 3.1 (토스페이먼츠 결제 시스템 포함)
**작성일**: 2025-01-28
**결제 PG**: 토스페이먼츠

---

*이 PRD는 성인 코딩 교육 + 토스페이먼츠 결제 시스템을 포함한 완전한 서비스 설계서입니다.*
