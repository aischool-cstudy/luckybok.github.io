import Link from 'next/link';
import { Check, Minus, Crown, Zap, Users, Building2, Sparkles, ArrowRight, Shield } from 'lucide-react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@/components/ui';
import { siteConfig } from '@/config/site';
import { cn } from '@/lib/cn';
import { createServerClient } from '@/lib/supabase/server';

// ISR 캐싱: 1시간 (가격 정보는 자주 변경되지 않음)
export const revalidate = 3600;

const plans = [
  {
    name: 'Starter',
    description: '코딩 교육 콘텐츠 생성을 처음 시작하는 분',
    price: {
      monthly: 0,
      yearly: 0,
    },
    features: [
      { text: '일일 10회 생성', included: true },
      { text: 'Python만 지원', included: true },
      { text: '콘텐츠 무제한 저장', included: true },
      { text: '기본 템플릿', included: true },
      { text: '전체 언어 지원', included: false },
      { text: 'PDF 내보내기', included: false },
      { text: 'API 접근', included: false },
      { text: '우선 지원', included: false },
    ],
    cta: '무료로 시작하기',
    href: '/register',
    popular: false,
    icon: Zap,
    gradient: 'from-slate-400 to-slate-500',
    iconBg: 'bg-slate-100 dark:bg-slate-800',
    iconColor: 'text-slate-500',
  },
  {
    name: 'Pro',
    description: '전문 강사 및 콘텐츠 크리에이터',
    price: {
      monthly: 29900,
      yearly: 299000,
    },
    features: [
      { text: '일일 100회 생성', included: true },
      { text: '전체 6개 언어 지원', included: true },
      { text: '콘텐츠 무제한 저장', included: true },
      { text: '프리미엄 템플릿', included: true },
      { text: 'PDF 내보내기', included: true },
      { text: '히스토리 30일 보관', included: true },
      { text: 'API 접근', included: false },
      { text: '우선 지원', included: false },
    ],
    cta: 'Pro 시작하기',
    href: '/register?plan=pro',
    popular: true,
    icon: Crown,
    gradient: 'from-amber-400 to-orange-500',
    iconBg: 'bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  {
    name: 'Team',
    description: '기업 교육팀 및 부트캠프',
    price: {
      monthly: 99000,
      yearly: 990000,
    },
    features: [
      { text: '일일 500회 생성', included: true },
      { text: '전체 6개 언어 지원', included: true },
      { text: '콘텐츠 무제한 저장', included: true },
      { text: '프리미엄 템플릿', included: true },
      { text: 'PDF 내보내기', included: true },
      { text: '히스토리 무제한 보관', included: true },
      { text: 'API 접근', included: true },
      { text: '5명 팀원 계정', included: true },
    ],
    cta: 'Team 시작하기',
    href: '/register?plan=team',
    popular: false,
    icon: Users,
    gradient: 'from-purple-400 to-pink-500',
    iconBg: 'bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30',
    iconColor: 'text-purple-600 dark:text-purple-400',
  },
];

function formatPrice(price: number) {
  return new Intl.NumberFormat('ko-KR').format(price);
}

export default async function PricingPage() {
  // 로그인 상태 확인
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  // 로그인 상태에 따라 플랜별 링크 결정
  const getHref = (planName: string) => {
    if (planName === 'Starter') {
      return isLoggedIn ? '/dashboard' : '/register';
    }
    const planParam = planName.toLowerCase();
    return isLoggedIn ? `/payment/subscribe` : `/register?plan=${planParam}`;
  };

  // 로그인 상태에 따라 CTA 텍스트 결정
  const getCta = (planName: string, defaultCta: string) => {
    if (!isLoggedIn) return defaultCta;
    if (planName === 'Starter') return '현재 플랜';
    return '구독하기';
  };

  return (
    <div className="py-24">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-20">
          <Badge variant="secondary" className="mb-4 bg-primary/10 text-primary">
            <Sparkles className="h-3 w-3 mr-1" />
            요금제
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            간단하고{' '}
            <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              투명한
            </span>{' '}
            요금제
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            필요한 만큼만 사용하세요. 언제든지 업그레이드하거나 취소할 수 있습니다.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const Icon = plan.icon;
            return (
              <Card
                key={plan.name}
                className={cn(
                  'relative flex flex-col overflow-hidden transition-all duration-300 hover:shadow-xl',
                  plan.popular && 'border-primary shadow-lg md:scale-105 z-10'
                )}
              >
                {/* 상단 그라데이션 바 */}
                <div className={cn('h-1.5 bg-gradient-to-r', plan.gradient)} />

                {plan.popular && (
                  <div className="absolute -top-0 right-4 px-4 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium rounded-b-xl shadow-lg">
                    <Crown className="h-3 w-3 inline-block mr-1" />
                    가장 인기
                  </div>
                )}

                <CardHeader className="text-center pb-8 pt-8">
                  <div className={cn('mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl', plan.iconBg)}>
                    <Icon className={cn('h-8 w-8', plan.iconColor)} />
                  </div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription className="mt-2">{plan.description}</CardDescription>
                  <div className="mt-6">
                    {plan.price.monthly === 0 ? (
                      <span className="text-5xl font-bold">무료</span>
                    ) : (
                      <>
                        <span className="text-5xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                          ₩{formatPrice(plan.price.monthly)}
                        </span>
                        <span className="text-muted-foreground text-lg">/월</span>
                      </>
                    )}
                  </div>
                  {plan.price.yearly > 0 && (
                    <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 text-sm">
                      <span className="text-muted-foreground">
                        연간 ₩{formatPrice(plan.price.yearly)}
                      </span>
                      <Badge className="bg-green-500 text-white border-0 text-xs">
                        {Math.round(
                          ((plan.price.monthly * 12 - plan.price.yearly) /
                            (plan.price.monthly * 12)) *
                            100
                        )}% 할인
                      </Badge>
                    </div>
                  )}
                </CardHeader>

                <CardContent className="flex-1 flex flex-col pt-0">
                  <ul className="space-y-3 flex-1">
                    {plan.features.map((feature) => (
                      <li
                        key={feature.text}
                        className={cn(
                          'flex items-center gap-3 text-sm',
                          !feature.included && 'text-muted-foreground/60'
                        )}
                      >
                        {feature.included ? (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500/10">
                            <Check className="h-3 w-3 text-green-600" />
                          </div>
                        ) : (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted">
                            <Minus className="h-3 w-3 text-muted-foreground/50" />
                          </div>
                        )}
                        {feature.text}
                      </li>
                    ))}
                  </ul>

                  <Button
                    asChild
                    className={cn(
                      'mt-8 w-full h-12 text-base font-semibold',
                      plan.popular && 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-orange-500/25'
                    )}
                    variant={plan.popular ? 'default' : 'outline'}
                    disabled={isLoggedIn && plan.name === 'Starter'}
                  >
                    <Link href={getHref(plan.name)} className="flex items-center gap-2">
                      {getCta(plan.name, plan.cta)}
                      {plan.name !== 'Starter' && <ArrowRight className="h-4 w-4" />}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Enterprise CTA */}
        <div className="relative overflow-hidden mt-20 p-10 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 text-white max-w-4xl mx-auto">
          <div className="absolute inset-0 bg-[radial-gradient(45%_40%_at_70%_50%,rgba(168,85,247,0.15),transparent)]" />
          <div className="relative flex flex-col md:flex-row items-center gap-8">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20">
              <Building2 className="h-10 w-10 text-purple-400" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-2xl font-bold mb-2">Enterprise</h3>
              <p className="text-slate-300 leading-relaxed">
                대규모 조직을 위한 맞춤 솔루션이 필요하신가요?
                온프레미스 배포, 무제한 생성, 전담 지원을 제공합니다.
              </p>
            </div>
            <Button asChild size="lg" variant="secondary" className="shrink-0 h-12 px-8">
              <Link href="/contact" className="flex items-center gap-2">
                문의하기
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Trust badges */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-500" />
            안전한 결제
          </span>
          <span className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-500" />
            7일 환불 보장
          </span>
          <span className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-green-500" />
            언제든 취소 가능
          </span>
        </div>

        {/* FAQ */}
        <div className="mt-24 max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="secondary" className="mb-4 bg-blue-500/10 text-blue-600">
              FAQ
            </Badge>
            <h2 className="text-3xl font-bold">요금제 FAQ</h2>
          </div>
          <div className="space-y-4">
            {[
              {
                q: '무료 플랜에서 Pro로 업그레이드하면 데이터가 유지되나요?',
                a: '네, 모든 생성된 콘텐츠와 히스토리가 그대로 유지됩니다.',
                icon: Zap,
                color: 'text-yellow-500',
                bg: 'bg-yellow-500/10',
              },
              {
                q: '결제 주기는 어떻게 되나요?',
                a: '월간 또는 연간 결제를 선택하실 수 있습니다. 연간 결제 시 약 17% 할인이 적용됩니다.',
                icon: Crown,
                color: 'text-purple-500',
                bg: 'bg-purple-500/10',
              },
              {
                q: '환불 정책은 어떻게 되나요?',
                a: '결제 후 7일 이내 사용량이 없는 경우 전액 환불이 가능합니다.',
                icon: Shield,
                color: 'text-green-500',
                bg: 'bg-green-500/10',
              },
              {
                q: '팀원을 추가하려면 어떻게 해야 하나요?',
                a: 'Team 플랜에서는 최대 5명의 팀원을 초대할 수 있습니다. 추가 팀원이 필요하시면 Enterprise 문의를 해주세요.',
                icon: Users,
                color: 'text-blue-500',
                bg: 'bg-blue-500/10',
              },
            ].map((faq, index) => (
              <div key={index} className="group p-6 rounded-2xl border hover:border-primary/30 hover:shadow-lg transition-all">
                <div className="flex items-start gap-4">
                  <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl group-hover:scale-110 transition-transform', faq.bg)}>
                    <faq.icon className={cn('h-5 w-5', faq.color)} />
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
      </div>
    </div>
  );
}

export const metadata = {
  title: `요금제 | ${siteConfig.name}`,
  description:
    '간단하고 투명한 요금제. 무료로 시작하고 필요한 만큼만 업그레이드하세요.',
};
