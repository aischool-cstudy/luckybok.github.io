import Link from 'next/link';
import { Check, Minus } from 'lucide-react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { siteConfig } from '@/config/site';
import { cn } from '@/lib/cn';

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
  },
];

function formatPrice(price: number) {
  return new Intl.NumberFormat('ko-KR').format(price);
}

export default function PricingPage() {
  return (
    <div className="py-20">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            간단하고 투명한 요금제
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            필요한 만큼만 사용하세요. 언제든지 업그레이드하거나 취소할 수 있습니다.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={cn(
                'relative flex flex-col',
                plan.popular && 'border-primary shadow-lg scale-105'
              )}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-sm font-medium rounded-full">
                  가장 인기
                </div>
              )}
              <CardHeader className="text-center pb-8 pt-6">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription className="mt-2">{plan.description}</CardDescription>
                <div className="mt-6">
                  <span className="text-4xl font-bold">
                    ₩{formatPrice(plan.price.monthly)}
                  </span>
                  {plan.price.monthly > 0 && (
                    <span className="text-muted-foreground">/월</span>
                  )}
                </div>
                {plan.price.yearly > 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    연간 결제 시 ₩{formatPrice(plan.price.yearly)}/년
                    <span className="text-primary ml-1">
                      (
                      {Math.round(
                        ((plan.price.monthly * 12 - plan.price.yearly) /
                          (plan.price.monthly * 12)) *
                          100
                      )}
                      % 할인)
                    </span>
                  </p>
                )}
              </CardHeader>

              <CardContent className="flex-1 flex flex-col">
                <ul className="space-y-3 flex-1">
                  {plan.features.map((feature) => (
                    <li
                      key={feature.text}
                      className={cn(
                        'flex items-center gap-3 text-sm',
                        !feature.included && 'text-muted-foreground'
                      )}
                    >
                      {feature.included ? (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <Minus className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                      )}
                      {feature.text}
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  className="mt-8 w-full"
                  variant={plan.popular ? 'default' : 'outline'}
                >
                  <Link href={plan.href}>{plan.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Enterprise CTA */}
        <div className="mt-16 text-center p-8 rounded-lg bg-muted/50 max-w-3xl mx-auto">
          <h3 className="text-xl font-semibold mb-2">Enterprise</h3>
          <p className="text-muted-foreground mb-4">
            대규모 조직을 위한 맞춤 솔루션이 필요하신가요?
            온프레미스 배포, 무제한 생성, 전담 지원을 제공합니다.
          </p>
          <Button asChild variant="outline">
            <Link href="/contact">문의하기</Link>
          </Button>
        </div>

        {/* FAQ */}
        <div className="mt-20 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">요금제 FAQ</h2>
          <div className="space-y-4">
            {[
              {
                q: '무료 플랜에서 Pro로 업그레이드하면 데이터가 유지되나요?',
                a: '네, 모든 생성된 콘텐츠와 히스토리가 그대로 유지됩니다.',
              },
              {
                q: '결제 주기는 어떻게 되나요?',
                a: '월간 또는 연간 결제를 선택하실 수 있습니다. 연간 결제 시 약 17% 할인이 적용됩니다.',
              },
              {
                q: '환불 정책은 어떻게 되나요?',
                a: '결제 후 7일 이내 사용량이 없는 경우 전액 환불이 가능합니다.',
              },
              {
                q: '팀원을 추가하려면 어떻게 해야 하나요?',
                a: 'Team 플랜에서는 최대 5명의 팀원을 초대할 수 있습니다. 추가 팀원이 필요하시면 Enterprise 문의를 해주세요.',
              },
            ].map((faq, index) => (
              <div key={index} className="p-6 rounded-lg border">
                <h3 className="font-semibold mb-2">{faq.q}</h3>
                <p className="text-muted-foreground">{faq.a}</p>
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
