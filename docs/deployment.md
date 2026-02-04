# CodeGen AI 배포 가이드

## 목차

1. [사전 요구사항](#사전-요구사항)
2. [환경 변수 설정](#환경-변수-설정)
3. [Vercel 배포](#vercel-배포)
4. [Supabase 설정](#supabase-설정)
5. [TossPayments 설정](#tosspayments-설정)
6. [모니터링 설정](#모니터링-설정)
7. [CI/CD 파이프라인](#cicd-파이프라인)
8. [문제 해결](#문제-해결)

---

## 사전 요구사항

### 필수 계정

- [Vercel](https://vercel.com) - 호스팅
- [Supabase](https://supabase.com) - 데이터베이스 및 인증
- [Anthropic](https://anthropic.com) - Claude AI API
- [TossPayments](https://tosspayments.com) - 결제 시스템

### 로컬 개발 환경

```bash
# Node.js 20 이상 필요
node -v  # v20.x.x

# 의존성 설치
npm ci

# 개발 서버 실행
npm run dev
```

---

## 환경 변수 설정

### 로컬 개발 (.env.local)

```bash
# 이 파일을 복사하여 사용
cp .env.example .env.local
```

### 필수 환경 변수

```bash
# ═══════════════════════════════════════
# Supabase
# ═══════════════════════════════════════
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# ═══════════════════════════════════════
# AI API Keys
# ═══════════════════════════════════════
ANTHROPIC_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-xxx

# ═══════════════════════════════════════
# TossPayments
# ═══════════════════════════════════════
NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_xxx
TOSS_SECRET_KEY=test_sk_xxx

# ═══════════════════════════════════════
# Application
# ═══════════════════════════════════════
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 선택적 환경 변수

```bash
# Sentry 에러 모니터링
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_DSN=https://xxx@sentry.io/xxx

# 테스트 계정 (E2E 테스트용)
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword123
```

---

## Vercel 배포

### 1. 프로젝트 연결

```bash
# Vercel CLI 설치
npm i -g vercel

# 프로젝트 연결
vercel link
```

### 2. 환경 변수 설정

Vercel 대시보드에서 Settings → Environment Variables:

| 변수 이름 | 환경 | 설명 |
|-----------|------|------|
| NEXT_PUBLIC_SUPABASE_URL | All | Supabase URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | All | Supabase 익명 키 |
| SUPABASE_SERVICE_ROLE_KEY | Production | Supabase 서비스 롤 키 |
| ANTHROPIC_API_KEY | All | Anthropic API 키 |
| NEXT_PUBLIC_TOSS_CLIENT_KEY | All | TossPayments 클라이언트 키 |
| TOSS_SECRET_KEY | Production | TossPayments 시크릿 키 |

### 3. 배포

```bash
# 프로덕션 배포
vercel --prod

# 미리보기 배포
vercel
```

### 4. 도메인 설정

Vercel 대시보드 → Settings → Domains에서 커스텀 도메인 추가.

### 5. 빌드 설정 (vercel.json)

프로젝트 루트의 `vercel.json` 설정:

```json
{
  "functions": {
    "src/app/api/**/*.ts": { "maxDuration": 60 },
    "src/actions/**/*.ts": { "maxDuration": 60 }
  },
  "crons": [
    { "path": "/api/cron/reset-daily-limits", "schedule": "0 0 * * *" },
    { "path": "/api/cron/renew-subscriptions", "schedule": "0 */6 * * *" },
    { "path": "/api/cron/expire-credits", "schedule": "0 1 * * *" }
  ]
}
```

| 설정 | 값 | 설명 |
|------|-----|------|
| API/Actions 타임아웃 | 60초 | AI 생성 및 결제 처리를 위한 충분한 시간 |
| 일일 제한 리셋 | 매일 00:00 UTC | 사용자 일일 생성 횟수 리셋 |
| 구독 갱신 | 6시간마다 | 자동 결제 처리 |
| 크레딧 만료 | 매일 01:00 UTC | 만료된 크레딧 정리 |

### 6. 보안 헤더 (next.config.ts)

`next.config.ts`에서 관리하는 보안 헤더:

| 헤더 | 값 | 목적 |
|------|-----|------|
| `Strict-Transport-Security` | max-age=31536000 | HTTPS 강제 |
| `X-Content-Type-Options` | nosniff | MIME 타입 스니핑 방지 |
| `X-Frame-Options` | DENY | 클릭재킹 방지 |
| `Content-Security-Policy` | (복합) | XSS 및 데이터 인젝션 방지 |
| `Referrer-Policy` | strict-origin-when-cross-origin | Referrer 정보 제한 |
| `Permissions-Policy` | camera=(), microphone=() | 민감 API 제한 |

---

## Supabase 설정

### 1. 프로젝트 생성

1. [Supabase Dashboard](https://supabase.com/dashboard)에서 새 프로젝트 생성
2. 프로젝트 설정에서 API Keys 복사

### 2. 데이터베이스 마이그레이션

```bash
# Supabase CLI 설치
npm i -g supabase

# 로컬 Supabase 시작
supabase start

# 타입 생성
npm run db:generate

# 마이그레이션 적용
npm run db:migrate
```

### 3. Auth 설정

Supabase 대시보드 → Authentication → Providers:

- Email/Password 활성화
- (선택) OAuth 제공자 설정 (Google, GitHub 등)

### 4. RLS 정책

필수 Row Level Security 정책이 마이그레이션에 포함되어 있습니다.

---

## TossPayments 설정

### 1. 계정 생성

1. [TossPayments](https://tosspayments.com)에서 사업자 계정 생성
2. 테스트 API 키 발급

### 2. 웹훅 설정

TossPayments 대시보드 → 개발자 도구 → 웹훅:

```
웹훅 URL: https://your-domain.com/api/webhooks/toss
```

### 3. 테스트 모드

개발/스테이징 환경에서는 테스트 키(`test_ck_xxx`, `test_sk_xxx`) 사용.

---

## 모니터링 설정

### Vercel Analytics

자동으로 활성화됩니다. Vercel 대시보드에서 확인:

- Speed Insights: Core Web Vitals
- Analytics: 페이지 뷰, 사용자 행동

### Sentry (선택)

1. [Sentry](https://sentry.io)에서 프로젝트 생성
2. DSN을 환경 변수에 설정
3. `instrumentation.ts`에서 자동 초기화

---

## CI/CD 파이프라인

### GitHub Actions

`.github/workflows/ci.yml`이 자동으로 실행:

1. **Push/PR 시**: lint → type-check → unit-test → build
2. **Build 성공 시**: E2E 테스트

### GitHub Secrets 설정

Repository Settings → Secrets and variables → Actions:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_TOSS_CLIENT_KEY
TEST_USER_EMAIL
TEST_USER_PASSWORD
CODECOV_TOKEN (선택)
```

### Vercel 자동 배포

GitHub 연동 시:

- `main` 브랜치 push → 프로덕션 배포
- PR → 미리보기 배포

---

## 문제 해결

### 빌드 실패

```bash
# 캐시 정리
rm -rf .next node_modules
npm ci
npm run build
```

### 타입 에러

```bash
# 타입 체크
npm run type-check

# Supabase 타입 재생성
npm run db:generate
```

### 환경 변수 문제

```bash
# 환경 변수 확인
vercel env ls

# 로컬에서 Vercel 환경 변수 가져오기
vercel env pull .env.local
```

### 데이터베이스 연결

```bash
# Supabase 상태 확인
supabase status

# 연결 테스트
npm run db:migrate
```

### AI API 오류

- Rate limit: 재시도 로직 확인 (`AI_CONFIG.RETRY`)
- 타임아웃: `AI_CONFIG.TIMEOUT` 설정 확인

---

## 체크리스트

### 배포 전

- [ ] 환경 변수 모두 설정
- [ ] 데이터베이스 마이그레이션 완료
- [ ] 린트/타입 체크 통과
- [ ] 테스트 통과
- [ ] 빌드 성공

### 배포 후

- [ ] 사이트 접속 확인
- [ ] 로그인/회원가입 테스트
- [ ] 콘텐츠 생성 테스트
- [ ] 결제 테스트 (테스트 카드)
- [ ] 모니터링 대시보드 확인

---

## 관련 문서

- [Next.js 배포 가이드](https://nextjs.org/docs/deployment)
- [Vercel 문서](https://vercel.com/docs)
- [Supabase 문서](https://supabase.com/docs)
- [TossPayments 개발자 문서](https://docs.tosspayments.com)
