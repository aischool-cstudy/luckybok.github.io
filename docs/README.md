# CodeGen AI 문서 허브

> **Version**: 1.0.0
> **Last Updated**: 2026-01-31
> **Status**: Active Development

---

## 📚 문서 구조

```
docs/
├── 📖 README.md                    # 이 파일 (문서 색인)
│
├── 🏗️ architecture/                # 아키텍처 문서
│   └── overview.md                 # 시스템 아키텍처 개요
│
├── 🔌 api/                         # API 문서
│   ├── payment.md                  # 결제 API 문서
│   ├── payment-security.md         # 결제 보안 API
│   └── ai-generation.md            # AI 생성 API 문서
│
├── 🔒 security/                    # 보안 가이드
│   ├── index.md                    # 보안 가이드 총람
│   ├── csrf-protection.md          # CSRF 보호
│   └── rate-limiting.md            # Rate Limiting
│
├── 🧪 testing/                     # 테스트 가이드
│   └── strategy.md                 # 테스트 전략
│
├── 👤 user-guide/                  # 사용자 가이드
│   └── getting-started.md          # 시작 가이드
│
├── 🚀 operations/                  # 운영 가이드
│   └── monitoring.md               # 모니터링 & 운영
│
├── 💾 database-schema.md           # 데이터베이스 스키마
├── 📦 deployment.md                # 배포 가이드
├── 🛠️ development-guide.md         # 개발 가이드
├── 💰 refund-policy.md             # 환불 정책
│
└── 📋 reviews/                     # 코드 리뷰 (archive)
    └── [날짜별 리뷰 문서들]
```

---

## 🎯 빠른 시작

### 처음 오셨나요?

1. **[개발 환경 설정](./development-guide.md)** - 로컬 개발 환경 구축
2. **[CONTRIBUTING.md](../CONTRIBUTING.md)** - 기여 가이드라인
3. **[아키텍처 개요](./architecture/overview.md)** - 시스템 이해

### 개발자용

| 필요한 것 | 문서 |
|----------|------|
| API 연동 | [AI 생성 API](./api/ai-generation.md), [결제 API](./api/payment.md) |
| DB 스키마 | [데이터베이스 스키마](./database-schema.md) |
| 테스트 작성 | [테스트 전략](./testing/strategy.md) |
| 보안 구현 | [보안 가이드](./security/index.md) |
| 배포 | [배포 가이드](./deployment.md) |

### 운영자용

| 필요한 것 | 문서 |
|----------|------|
| 모니터링 | [모니터링 가이드](./operations/monitoring.md) |
| 장애 대응 | [모니터링 > 장애 대응](./operations/monitoring.md#장애-대응) |
| 보안 체크 | [보안 체크리스트](./security/index.md#보안-체크리스트) |

### 사용자용

- **[시작 가이드](./user-guide/getting-started.md)** - 서비스 사용법
- **[환불 정책](./refund-policy.md)** - 환불 안내

---

## 📊 문서 상태

### 완성도

| 문서 | 상태 | 버전 | 마지막 업데이트 |
|------|------|------|----------------|
| [아키텍처 개요](./architecture/overview.md) | ✅ 완성 | 1.0.0 | 2026-01-31 |
| [AI 생성 API](./api/ai-generation.md) | ✅ 완성 | 1.0.0 | 2026-01-31 |
| [결제 API](./api/payment.md) | ✅ 완성 | 1.3.0 | 2026-01-30 |
| [결제 보안](./api/payment-security.md) | ✅ 완성 | 1.0.0 | 2026-01-30 |
| [보안 가이드](./security/index.md) | ✅ 완성 | 1.0.0 | 2026-01-31 |
| [CSRF 보호](./security/csrf-protection.md) | ✅ 완성 | 1.0.0 | 2026-01-30 |
| [Rate Limiting](./security/rate-limiting.md) | ✅ 완성 | 1.0.0 | 2026-01-30 |
| [테스트 전략](./testing/strategy.md) | ✅ 완성 | 1.0.0 | 2026-01-31 |
| [시작 가이드](./user-guide/getting-started.md) | ✅ 완성 | 1.0.0 | 2026-01-31 |
| [모니터링](./operations/monitoring.md) | ✅ 완성 | 1.0.0 | 2026-01-31 |
| [DB 스키마](./database-schema.md) | ⚠️ 업데이트 필요 | 1.1.0 | 2026-01-29 |
| [배포 가이드](./deployment.md) | ⚠️ 업데이트 필요 | - | - |
| [개발 가이드](./development-guide.md) | ⚠️ 업데이트 필요 | 1.2.0 | - |

### 필요한 문서

| 문서 | 우선순위 | 담당 | 예상 완료 |
|------|----------|------|----------|
| OpenAPI 스펙 | 🔴 High | - | - |
| 고급 기능 가이드 | 🟡 Medium | - | - |
| API 연동 가이드 (Team) | 🟡 Medium | - | - |
| 성능 최적화 가이드 | 🟢 Low | - | - |
| 다국어 가이드 | 🟢 Low | - | - |

---

## 🔍 주제별 색인

### 아키텍처 & 설계

- [시스템 아키텍처](./architecture/overview.md)
- [데이터 모델](./database-schema.md)
- [기술 결정 기록 (ADR)](./architecture/overview.md#기술-결정-기록)

### API & 통합

- [AI 콘텐츠 생성 API](./api/ai-generation.md)
- [결제 API](./api/payment.md)
- [결제 보안 API](./api/payment-security.md)
- [웹훅 처리](./api/payment-security.md#웹훅-보안)

### 보안

- [보안 가이드 총람](./security/index.md)
- [CSRF 보호](./security/csrf-protection.md)
- [Rate Limiting](./security/rate-limiting.md)
- [인증 & 인가](./security/index.md#인증-및-인가)
- [데이터 암호화](./security/index.md#데이터-보호)

### 테스트 & 품질

- [테스트 전략](./testing/strategy.md)
- [단위 테스트](./testing/strategy.md#1-단위-테스트-unit-tests)
- [E2E 테스트](./testing/strategy.md#3-e2e-테스트-end-to-end-tests)
- [커버리지 목표](./testing/strategy.md#테스트-커버리지-목표)

### 운영 & 배포

- [배포 가이드](./deployment.md)
- [모니터링](./operations/monitoring.md)
- [장애 대응](./operations/monitoring.md#장애-대응)
- [알림 설정](./operations/monitoring.md#알림-설정)

### 개발 프로세스

- [개발 가이드](./development-guide.md)
- [기여 가이드](../CONTRIBUTING.md)
- [코드 스타일](../CONTRIBUTING.md#코드-스타일)
- [커밋 컨벤션](../CONTRIBUTING.md#커밋-컨벤션)

### 사용자 문서

- [시작 가이드](./user-guide/getting-started.md)
- [크레딧 시스템](./user-guide/getting-started.md#크레딧-시스템)
- [구독 플랜](./user-guide/getting-started.md#구독-플랜)
- [환불 정책](./refund-policy.md)

---

## 📝 문서 작성 가이드

### 문서 템플릿

```markdown
# 문서 제목

> **Version**: 1.0.0
> **Last Updated**: YYYY-MM-DD
> **Author**: 작성자/담당 페르소나
> **Status**: Draft | Active | Deprecated

---

## 목차

1. [섹션 1](#섹션-1)
2. [섹션 2](#섹션-2)

---

## 섹션 1

내용...

---

## 참고 자료

- [링크](URL)

---

*마지막 업데이트: YYYY-MM-DD*
```

### 작성 원칙

1. **명확성**: 기술 용어 최소화, 필요시 설명 추가
2. **완전성**: 전제 조건, 예시, 예외 상황 포함
3. **최신성**: 코드 변경 시 문서도 업데이트
4. **검색 용이성**: 명확한 제목과 목차

### 다이어그램 도구

- ASCII 다이어그램: 코드 블록 내 작성
- Mermaid: GitHub에서 렌더링 지원
- 외부 도구: draw.io, Excalidraw

---

## 🔄 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|----------|
| 2026-01-31 | 1.0.0 | 초기 문서 허브 구성 |
| | | - 아키텍처 문서 추가 |
| | | - AI 생성 API 문서 추가 |
| | | - 테스트 전략 문서 추가 |
| | | - 사용자 가이드 추가 |
| | | - 보안 가이드 통합 |
| | | - 운영 가이드 추가 |

---

## 📞 도움이 필요하신가요?

- **문서 오류 제보**: GitHub Issue 생성
- **문서 기여**: PR 제출 (CONTRIBUTING.md 참조)
- **일반 문의**: support@codegen.ai

---

*이 문서 허브는 지속적으로 업데이트됩니다.*
