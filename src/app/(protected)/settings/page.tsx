import { Settings } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getProfile } from '@/actions/settings';
import { getSubscription, getPaymentMethods } from '@/actions/billing';
import { getCreditBalance, getCreditHistory } from '@/actions/credits';
import { ProfileForm } from './profile-form';
import { PasswordForm } from './password-form';
import { AccountSection } from './account-section';
import { SubscriptionSection } from './subscription-section';
import { PaymentMethodSection } from './payment-method-section';
import { CreditsSection } from './credits-section';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import type { PlanType } from '@/types/payment.types';

export const metadata = {
  title: '설정 | CodeGen AI',
  description: '계정 설정 및 프로필 관리',
};

export default async function SettingsPage() {
  // 병렬로 데이터 조회
  const [profileResult, subscriptionResult, paymentMethodsResult, creditBalanceResult, creditHistoryResult] =
    await Promise.all([
      getProfile(),
      getSubscription(),
      getPaymentMethods(),
      getCreditBalance(),
      getCreditHistory(1, 5),
    ]);

  if (!profileResult.success) {
    redirect('/login');
  }

  const profile = profileResult.data;
  const subscription = subscriptionResult.success ? subscriptionResult.data ?? null : null;
  const paymentMethods = paymentMethodsResult.success ? paymentMethodsResult.data ?? [] : [];
  const creditBalance = creditBalanceResult;
  const recentTransactions = creditHistoryResult.transactions;

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">설정</h1>
          <p className="text-sm text-muted-foreground">계정 설정 및 프로필 관리</p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* 프로필 설정 */}
        <Card>
          <CardHeader>
            <CardTitle>프로필</CardTitle>
            <CardDescription>이름 및 기본 정보를 수정합니다</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm
              initialData={{
                name: profile.name || '',
                email: profile.email,
              }}
            />
          </CardContent>
        </Card>

        {/* 구독 관리 */}
        <SubscriptionSection
          subscription={subscription}
          currentPlan={profile.plan as PlanType}
        />

        {/* 결제 수단 */}
        <PaymentMethodSection
          paymentMethods={paymentMethods}
          hasActiveSubscription={subscription?.status === 'active' && !subscription.cancelAtPeriodEnd}
        />

        {/* 크레딧 현황 */}
        <CreditsSection creditBalance={creditBalance} recentTransactions={recentTransactions} />

        {/* 비밀번호 변경 */}
        <Card>
          <CardHeader>
            <CardTitle>비밀번호 변경</CardTitle>
            <CardDescription>계정 보안을 위해 정기적으로 변경하세요</CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>

        {/* 계정 관리 */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">위험 구역</CardTitle>
            <CardDescription>계정 삭제 시 모든 데이터가 영구적으로 삭제됩니다</CardDescription>
          </CardHeader>
          <CardContent>
            <AccountSection />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
