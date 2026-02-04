# CodeGen AI

> AI 기반 코딩 교육 콘텐츠 자동 생성기

성인 학습자를 위한 맞춤형 코딩 교육 콘텐츠를 AI가 자동으로 생성하는 SaaS 플랫폼입니다.

## 주요 기능

- **AI 콘텐츠 생성**: Claude AI를 활용한 고품질 교육 콘텐츠 자동 생성
- **맞춤형 학습**: 학습자 수준과 배경에 맞는 비유와 예제 제공
- **다양한 언어 지원**: Python, JavaScript, SQL, Java, TypeScript, Go
- **PDF 내보내기**: 생성된 콘텐츠를 PDF로 저장
- **히스토리 관리**: 생성 이력 조회 및 재사용

## 기술 스택

| 카테고리 | 기술 |
|---------|-----|
| **프레임워크** | Next.js 16 (App Router) |
| **언어** | TypeScript 5 |
| **스타일링** | Tailwind CSS 4, shadcn/ui |
| **데이터베이스** | Supabase (PostgreSQL) |
| **인증** | Supabase Auth |
| **AI** | Vercel AI SDK, Anthropic Claude |
| **결제** | TossPayments |
| **배포** | Vercel |
| **모니터링** | Sentry |

## 시작하기

### 요구사항

- Node.js 20.0.0 이상
- npm 또는 pnpm
- Supabase 프로젝트
- Anthropic API 키

### 설치

```bash
# 저장소 클론
git clone https://github.com/your-org/codegen-ai.git
cd codegen-ai

# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env.local
# .env.local 파일을 편집하여 실제 값 입력
```

### 환경 변수 설정

`.env.example`을 참고하여 `.env.local`에 다음 환경 변수를 설정하세요:

```bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 필수 환경 변수
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI APIs
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...                  # 폴백용 (선택)

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_ENV=development        # development | staging | production

# TossPayments (결제)
NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_...
TOSS_SECRET_KEY=test_sk_...
TOSS_WEBHOOK_SECRET=your-webhook-secret
BILLING_KEY_ENCRYPTION_KEY=32-character-key  # 정확히 32자

# Cron Jobs
CRON_SECRET=your-cron-secret

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 선택 환경 변수 (프로덕션 권장)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Sentry (에러 트래킹)
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx  # 클라이언트용
SENTRY_DSN=https://xxx@sentry.io/xxx              # 서버용

# Vercel KV (Rate Limiting)
KV_REST_API_URL=https://xxx.kv.vercel-storage.com
KV_REST_API_TOKEN=xxx

# Vercel Analytics
VERCEL_ANALYTICS_ID=xxx

# Slack 관리자 알림 (결제 실패 등 중요 알림)
SLACK_ADMIN_WEBHOOK_URL=https://hooks.slack.com/services/xxx/xxx/xxx
```

### 개발 서버 실행

```bash
# Turbopack으로 개발 서버 실행 (권장)
npm run dev

# 일반 개발 서버
npm run dev:standard
```

http://localhost:3000 에서 애플리케이션을 확인할 수 있습니다.

## 스크립트

| 스크립트 | 설명 |
|---------|------|
| `npm run dev` | 개발 서버 (Turbopack) |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 프로덕션 서버 |
| `npm run lint` | ESLint 검사 |
| `npm run lint:fix` | ESLint 자동 수정 |
| `npm run type-check` | TypeScript 타입 검사 |
| `npm run test` | 단위 테스트 |
| `npm run test:e2e` | E2E 테스트 (Playwright) |
| `npm run db:generate` | Supabase 타입 생성 |
| `npm run db:migrate` | DB 마이그레이션 |

## 프로젝트 구조

```
src/
├── app/                 # Next.js App Router
│   ├── (auth)/          # 인증 관련 페이지
│   ├── (protected)/     # 로그인 필수 페이지
│   ├── (marketing)/     # 마케팅 페이지
│   └── api/             # API 라우트
├── actions/             # Server Actions
├── components/          # React 컴포넌트
│   ├── ui/              # shadcn/ui 컴포넌트
│   ├── features/        # 기능별 컴포넌트
│   └── layout/          # 레이아웃 컴포넌트
├── hooks/               # 커스텀 훅
├── lib/                 # 유틸리티 및 설정
│   ├── ai/              # AI 관련
│   ├── supabase/        # Supabase 클라이언트
│   └── payment/         # 결제 관련
├── types/               # TypeScript 타입 정의
└── styles/              # 글로벌 스타일
```

## 테스트

```bash
# 단위 테스트
npm run test

# 테스트 커버리지
npm run test:coverage

# E2E 테스트
npm run test:e2e
```

## 배포

Vercel을 통한 자동 배포가 설정되어 있습니다.

1. `main` 브랜치에 푸시하면 프로덕션 배포
2. PR 생성 시 Preview 배포

### 환경 변수

Vercel 대시보드에서 환경 변수를 설정하세요:
- Production: 실제 API 키 사용
- Preview: 테스트 API 키 사용

## 기여하기

1. Fork 후 feature 브랜치 생성
2. 변경사항 커밋
3. Pull Request 생성

### 커밋 컨벤션

```
feat: 새로운 기능 추가
fix: 버그 수정
docs: 문서 수정
style: 코드 스타일 변경
refactor: 리팩토링
test: 테스트 추가/수정
chore: 기타 변경사항
```

## 라이선스

이 프로젝트는 비공개 소프트웨어입니다. 무단 복제 및 배포를 금지합니다.

## 문의

- 이슈: [GitHub Issues](https://github.com/your-org/codegen-ai/issues)
- 이메일: support@codegen.ai
