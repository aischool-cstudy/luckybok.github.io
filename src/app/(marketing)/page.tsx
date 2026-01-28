import Link from 'next/link';
import { ArrowRight, Sparkles, Clock, Users, Code2, Zap, Shield, Languages } from 'lucide-react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { siteConfig } from '@/config/site';

export default function LandingPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(45%_40%_at_50%_60%,hsl(var(--primary)/0.1),transparent)]" />
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
              <Sparkles className="h-4 w-4" />
              AI 기반 코딩 교육 콘텐츠 자동 생성
            </div>

            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              10분 안에{' '}
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                실무형 코딩 교육 콘텐츠
              </span>{' '}
              완성
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              성인 학습자 맞춤형 비유와 실무 예제로 구성된 코딩 교육 콘텐츠를
              AI가 자동으로 생성합니다. 강사, HRD 담당자, 부트캠프 운영자를 위한 최적의 도구입니다.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button asChild size="lg" className="text-base px-8">
                <Link href="/register">
                  무료로 시작하기
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-base px-8">
                <Link href="#features">기능 살펴보기</Link>
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              신용카드 없이 시작 · 매일 10회 무료 생성
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 border-y bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '10분', label: '평균 생성 시간' },
              { value: '6개', label: '지원 언어' },
              { value: '4가지', label: '학습자 유형' },
              { value: '무제한', label: '콘텐츠 저장' },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-3xl md:text-4xl font-bold text-primary">{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              왜 {siteConfig.name}인가요?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              성인 학습자의 특성을 고려한 AI 기반 콘텐츠 생성으로
              교육 효과를 극대화합니다.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Users,
                title: '학습자 맞춤 비유',
                description:
                  '비전공자에게는 엑셀, 관리자에게는 조직 비유로 개념을 쉽게 설명합니다.',
              },
              {
                icon: Code2,
                title: '실무 중심 예제',
                description:
                  '현업에서 바로 활용할 수 있는 실용적인 코드 예제를 제공합니다.',
              },
              {
                icon: Clock,
                title: '빠른 생성 속도',
                description:
                  '몇 시간 걸리던 콘텐츠 제작을 10분 만에 완료합니다.',
              },
              {
                icon: Languages,
                title: '6개 언어 지원',
                description:
                  'Python, JavaScript, SQL, Java, TypeScript, Go를 지원합니다.',
              },
              {
                icon: Shield,
                title: '검증된 코드',
                description:
                  '생성된 모든 코드는 실행 가능하고 베스트 프랙티스를 따릅니다.',
              },
              {
                icon: Zap,
                title: '즉시 사용 가능',
                description:
                  '학습 목표, 설명, 코드, 퀴즈까지 완벽한 교육 자료를 제공합니다.',
              },
            ].map((feature) => (
              <Card key={feature.title} className="border-2 hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Target Audience Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              이런 분들께 추천합니다
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: '코딩 강사',
                description: '성인 대상 코딩 교육 콘텐츠를 빠르게 준비하세요.',
                emoji: '👨‍🏫',
              },
              {
                title: 'HRD 담당자',
                description: '임직원 개발 교육 자료를 효율적으로 제작하세요.',
                emoji: '👩‍💼',
              },
              {
                title: '부트캠프 운영자',
                description: '다양한 레벨의 커리큘럼을 빠르게 구성하세요.',
                emoji: '🏫',
              },
              {
                title: '콘텐츠 크리에이터',
                description: '블로그, 유튜브용 코딩 콘텐츠를 제작하세요.',
                emoji: '✍️',
              },
            ].map((audience) => (
              <div
                key={audience.title}
                className="p-6 rounded-lg bg-background border text-center hover:shadow-md transition-shadow"
              >
                <div className="text-4xl mb-4">{audience.emoji}</div>
                <h3 className="font-semibold mb-2">{audience.title}</h3>
                <p className="text-sm text-muted-foreground">{audience.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              자주 묻는 질문
            </h2>
          </div>

          <div className="max-w-3xl mx-auto space-y-4">
            {[
              {
                q: '무료 플랜으로 무엇을 할 수 있나요?',
                a: '매일 10회의 콘텐츠 생성이 가능하며, Python 언어를 지원합니다. 생성된 콘텐츠는 무제한 저장됩니다.',
              },
              {
                q: '생성된 콘텐츠의 저작권은 누구에게 있나요?',
                a: '생성된 콘텐츠의 저작권은 사용자에게 있습니다. 상업적 용도로 자유롭게 활용하실 수 있습니다.',
              },
              {
                q: '어떤 AI 모델을 사용하나요?',
                a: 'Claude(Anthropic)와 GPT-4(OpenAI)의 최신 모델을 사용하여 고품질의 콘텐츠를 생성합니다.',
              },
              {
                q: 'Pro 플랜으로 업그레이드하면 무엇이 달라지나요?',
                a: '일일 100회 생성, 전체 6개 언어 지원, PDF 내보내기, 30일 히스토리 보관이 가능합니다.',
              },
            ].map((faq, index) => (
              <div key={index} className="p-6 rounded-lg border">
                <h3 className="font-semibold mb-2">{faq.q}</h3>
                <p className="text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            지금 바로 시작하세요
          </h2>
          <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
            매일 10회 무료 생성으로 {siteConfig.name}의 강력한 기능을 경험해보세요.
          </p>
          <Button asChild size="lg" variant="secondary" className="text-base px-8">
            <Link href="/register">
              무료로 시작하기
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}

export const metadata = {
  title: `${siteConfig.name} - AI 기반 코딩 교육 콘텐츠 자동 생성기`,
  description:
    '성인 학습자 맞춤형 코딩 교육 콘텐츠를 AI가 10분 만에 생성합니다. 강사, HRD 담당자, 부트캠프 운영자를 위한 최적의 도구.',
};
