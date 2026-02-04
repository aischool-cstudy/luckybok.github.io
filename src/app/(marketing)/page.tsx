import Link from 'next/link';
import { ArrowRight, Sparkles, Clock, Users, Code2, Zap, Shield, Languages, Play, CheckCircle } from 'lucide-react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@/components/ui';
import { siteConfig } from '@/config/site';

// 정적 페이지 캐싱: 24시간 (콘텐츠 변경 시 재배포로 갱신)
export const revalidate = 86400;

export default function LandingPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 md:py-40">
        {/* 배경 효과 */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(45%_40%_at_50%_40%,hsl(var(--primary)/0.12),transparent)]" />
          <div className="absolute top-0 right-0 -mt-32 -mr-32 h-96 w-96 rounded-full bg-gradient-to-br from-primary/20 to-transparent blur-3xl" />
          <div className="absolute bottom-0 left-0 -mb-32 -ml-32 h-96 w-96 rounded-full bg-gradient-to-tr from-purple-500/20 to-transparent blur-3xl" />
        </div>

        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-10">
            {/* 뱃지 */}
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-primary/10 to-purple-500/10 text-primary text-sm font-medium border border-primary/20 shadow-sm">
              <Sparkles className="h-4 w-4" />
              AI 기반 코딩 교육 콘텐츠 자동 생성
              <Badge variant="secondary" className="ml-1 text-xs bg-primary/20">NEW</Badge>
            </div>

            {/* 메인 타이틀 */}
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
              10분 안에{' '}
              <span className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
                실무형 코딩 교육 콘텐츠
              </span>{' '}
              완성
            </h1>

            {/* 서브 타이틀 */}
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              성인 학습자 맞춤형 비유와 실무 예제로 구성된 코딩 교육 콘텐츠를
              <span className="text-foreground font-medium"> Claude AI</span>가 자동으로 생성합니다.
            </p>

            {/* CTA 버튼 */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button asChild size="lg" className="h-14 text-lg px-10 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/25">
                <Link href="/login">
                  <Play className="mr-2 h-5 w-5" />
                  무료로 시작하기
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-14 text-lg px-10">
                <Link href="#features">기능 살펴보기</Link>
              </Button>
            </div>

            {/* 신뢰 표시 */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                신용카드 필요 없음
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                매일 10회 무료 생성
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                즉시 사용 가능
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 border-y bg-gradient-to-r from-muted/30 via-muted/50 to-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: '10분', label: '평균 생성 시간', icon: Clock, color: 'text-blue-500', bg: 'bg-blue-500/10' },
              { value: '6개', label: '지원 언어', icon: Code2, color: 'text-purple-500', bg: 'bg-purple-500/10' },
              { value: '4가지', label: '학습자 유형', icon: Users, color: 'text-green-500', bg: 'bg-green-500/10' },
              { value: '무제한', label: '콘텐츠 저장', icon: Shield, color: 'text-orange-500', bg: 'bg-orange-500/10' },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center text-center p-6 rounded-2xl bg-background/50 border">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.bg} mb-4`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div className={`text-3xl md:text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent`}>
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4 bg-primary/10 text-primary">
              <Sparkles className="h-3 w-3 mr-1" />
              핵심 기능
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              왜 <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">{siteConfig.name}</span>인가요?
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
                gradient: 'from-blue-400 to-blue-500',
                bg: 'bg-blue-500/10',
                color: 'text-blue-500',
              },
              {
                icon: Code2,
                title: '실무 중심 예제',
                description:
                  '현업에서 바로 활용할 수 있는 실용적인 코드 예제를 제공합니다.',
                gradient: 'from-purple-400 to-purple-500',
                bg: 'bg-purple-500/10',
                color: 'text-purple-500',
              },
              {
                icon: Clock,
                title: '빠른 생성 속도',
                description:
                  '몇 시간 걸리던 콘텐츠 제작을 10분 만에 완료합니다.',
                gradient: 'from-green-400 to-green-500',
                bg: 'bg-green-500/10',
                color: 'text-green-500',
              },
              {
                icon: Languages,
                title: '6개 언어 지원',
                description:
                  'Python, JavaScript, SQL, Java, TypeScript, Go를 지원합니다.',
                gradient: 'from-orange-400 to-orange-500',
                bg: 'bg-orange-500/10',
                color: 'text-orange-500',
              },
              {
                icon: Shield,
                title: '검증된 코드',
                description:
                  '생성된 모든 코드는 실행 가능하고 베스트 프랙티스를 따릅니다.',
                gradient: 'from-pink-400 to-pink-500',
                bg: 'bg-pink-500/10',
                color: 'text-pink-500',
              },
              {
                icon: Zap,
                title: '즉시 사용 가능',
                description:
                  '학습 목표, 설명, 코드, 퀴즈까지 완벽한 교육 자료를 제공합니다.',
                gradient: 'from-yellow-400 to-orange-400',
                bg: 'bg-yellow-500/10',
                color: 'text-yellow-500',
              },
            ].map((feature) => (
              <Card key={feature.title} className="group relative overflow-hidden border-2 hover:border-primary/30 hover:shadow-lg transition-all duration-300">
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.bg} opacity-0 group-hover:opacity-100 transition-opacity`} />
                <div className={`h-1 bg-gradient-to-r ${feature.gradient}`} />
                <CardHeader className="relative">
                  <div className={`h-14 w-14 rounded-2xl ${feature.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <feature.icon className={`h-7 w-7 ${feature.color}`} />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <CardDescription className="text-base leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Target Audience Section */}
      <section className="py-24 bg-gradient-to-b from-muted/30 via-muted/50 to-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4 bg-purple-500/10 text-purple-600">
              <Users className="h-3 w-3 mr-1" />
              대상 사용자
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              이런 분들께 추천합니다
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: '코딩 강사',
                description: '성인 대상 코딩 교육 콘텐츠를 빠르게 준비하세요.',
                emoji: '👨‍🏫',
                gradient: 'from-blue-400 to-indigo-400',
                bg: 'bg-blue-500/10',
              },
              {
                title: 'HRD 담당자',
                description: '임직원 개발 교육 자료를 효율적으로 제작하세요.',
                emoji: '👩‍💼',
                gradient: 'from-purple-400 to-pink-400',
                bg: 'bg-purple-500/10',
              },
              {
                title: '부트캠프 운영자',
                description: '다양한 레벨의 커리큘럼을 빠르게 구성하세요.',
                emoji: '🏫',
                gradient: 'from-green-400 to-emerald-400',
                bg: 'bg-green-500/10',
              },
              {
                title: '콘텐츠 크리에이터',
                description: '블로그, 유튜브용 코딩 콘텐츠를 제작하세요.',
                emoji: '✍️',
                gradient: 'from-orange-400 to-red-400',
                bg: 'bg-orange-500/10',
              },
            ].map((audience) => (
              <div
                key={audience.title}
                className="group relative overflow-hidden p-8 rounded-2xl bg-background border text-center hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                <div className={`absolute inset-0 ${audience.bg} opacity-0 group-hover:opacity-100 transition-opacity`} />
                <div className={`h-1 absolute top-0 left-0 right-0 bg-gradient-to-r ${audience.gradient}`} />
                <div className="relative">
                  <div className="text-5xl mb-6 group-hover:scale-110 transition-transform">{audience.emoji}</div>
                  <h3 className="text-lg font-semibold mb-3">{audience.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{audience.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4 bg-green-500/10 text-green-600">
              FAQ
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              자주 묻는 질문
            </h2>
          </div>

          <div className="max-w-3xl mx-auto space-y-4">
            {[
              {
                q: '무료 플랜으로 무엇을 할 수 있나요?',
                a: '매일 10회의 콘텐츠 생성이 가능하며, Python 언어를 지원합니다. 생성된 콘텐츠는 무제한 저장됩니다.',
                icon: Zap,
                color: 'text-yellow-500',
                bg: 'bg-yellow-500/10',
              },
              {
                q: '생성된 콘텐츠의 저작권은 누구에게 있나요?',
                a: '생성된 콘텐츠의 저작권은 사용자에게 있습니다. 상업적 용도로 자유롭게 활용하실 수 있습니다.',
                icon: Shield,
                color: 'text-blue-500',
                bg: 'bg-blue-500/10',
              },
              {
                q: '어떤 AI 모델을 사용하나요?',
                a: 'Claude(Anthropic)와 GPT-4(OpenAI)의 최신 모델을 사용하여 고품질의 콘텐츠를 생성합니다.',
                icon: Sparkles,
                color: 'text-purple-500',
                bg: 'bg-purple-500/10',
              },
              {
                q: 'Pro 플랜으로 업그레이드하면 무엇이 달라지나요?',
                a: '일일 100회 생성, 전체 6개 언어 지원, PDF 내보내기, 30일 히스토리 보관이 가능합니다.',
                icon: ArrowRight,
                color: 'text-green-500',
                bg: 'bg-green-500/10',
              },
            ].map((faq, index) => (
              <div key={index} className="group p-6 rounded-2xl border hover:border-primary/30 hover:shadow-lg transition-all">
                <div className="flex items-start gap-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${faq.bg} group-hover:scale-110 transition-transform`}>
                    <faq.icon className={`h-5 w-5 ${faq.color}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">{faq.q}</h3>
                    <p className="text-muted-foreground leading-relaxed">{faq.a}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden py-24 bg-gradient-to-r from-primary via-purple-600 to-pink-600 text-primary-foreground">
        <div className="absolute inset-0 bg-[radial-gradient(45%_40%_at_50%_50%,rgba(255,255,255,0.15),transparent)]" />
        <div className="absolute top-0 left-0 -mt-20 -ml-20 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 -mb-20 -mr-20 h-60 w-60 rounded-full bg-white/10 blur-3xl" />

        <div className="container relative mx-auto px-4 text-center">
          <Badge variant="secondary" className="mb-6 bg-white/20 text-white border-0">
            <Sparkles className="h-3 w-3 mr-1" />
            지금 시작하세요
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            코딩 교육의 미래를 경험하세요
          </h2>
          <p className="text-xl opacity-90 mb-10 max-w-2xl mx-auto">
            매일 10회 무료 생성으로 {siteConfig.name}의 강력한 AI 콘텐츠 생성을 체험해보세요.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" variant="secondary" className="h-14 text-lg px-10 shadow-lg">
              <Link href="/login">
                <Play className="mr-2 h-5 w-5" />
                무료로 시작하기
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-14 text-lg px-10 bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white">
              <Link href="/pricing">요금제 보기</Link>
            </Button>
          </div>
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
