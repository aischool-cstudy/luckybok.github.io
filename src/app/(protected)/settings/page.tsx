import { Settings, User, Lock, AlertTriangle } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getProfile } from '@/actions/settings';
import { getSubscription, getPaymentMethods, getPaymentHistory } from '@/actions/billing';
import { getCreditBalance, getCreditHistory } from '@/actions/credits';
import { getScheduledPlanChange } from '@/actions/subscription';
import { ProfileForm } from './profile-form';
import { PasswordForm } from './password-form';
import { AccountSection } from './account-section';
import { SubscriptionSection } from './subscription-section';
import { PaymentMethodSection } from './payment-method-section';
import { PaymentHistorySection } from './payment-history-section';
import { CreditsSection } from './credits-section';
import { LearningProfileSection } from './learning-profile-section';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import type { PlanType } from '@/types/payment.types';

// 동적 페이지: 사용자별 실시간 데이터 표시 (캐싱 비활성화)
export const revalidate = 0;

export const metadata = {
  title: '설정 | CodeGen AI',
  description: '계정 설정 및 프로필 관리',
};

export default async function SettingsPage() {
  // 병렬로 데이터 조회
  const [
    profileResult,
    subscriptionResult,
    paymentMethodsResult,
    creditBalanceResult,
    creditHistoryResult,
    paymentHistoryResult,
    scheduledChangeResult,
  ] = await Promise.all([
    getProfile(),
    getSubscription(),
    getPaymentMethods(),
    getCreditBalance(),
    getCreditHistory(1, 5),
    getPaymentHistory(1, 5),
    getScheduledPlanChange(),
  ]);

  if (!profileResult.success) {
    redirect('/login');
  }

  const profile = profileResult.data;
  const subscription = subscriptionResult.success ? subscriptionResult.data ?? null : null;
  const paymentMethods = paymentMethodsResult.success ? paymentMethodsResult.data ?? [] : [];
  const creditBalance = creditBalanceResult;
  const recentTransactions = creditHistoryResult.transactions;
  const { payments, total: totalPayments } = paymentHistoryResult;
  const scheduledChange = scheduledChangeResult.success ? scheduledChangeResult.data : null;

  return (
    <div className="space-y-8">
      {/* 페이지 헤더 */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(45%_40%_at_70%_50%,rgba(124,58,237,0.15),transparent)]" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
            <Settings className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">설정</h1>
            <p className="text-sm text-slate-300">계정 설정 및 프로필 관리</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        {/* 프로필 설정 */}
        <Card className="overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-blue-400 to-blue-500" />
          <CardHeader className="flex flex-row items-center gap-4 space-y-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
              <User className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <CardTitle>프로필</CardTitle>
              <CardDescription>이름 및 기본 정보를 수정합니다</CardDescription>
            </div>
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

        {/* 학습 프로필 (나이 설정) */}
        <LearningProfileSection />

        {/* 구독 관리 */}
        <SubscriptionSection
          subscription={subscription}
          currentPlan={profile.plan as PlanType}
          scheduledChange={scheduledChange}
        />

        {/* 결제 수단 */}
        <PaymentMethodSection
          paymentMethods={paymentMethods}
          hasActiveSubscription={subscription?.status === 'active' && !subscription.cancelAtPeriodEnd}
        />

        {/* 크레딧 현황 */}
        <CreditsSection creditBalance={creditBalance} recentTransactions={recentTransactions} />

        {/* 결제 내역 */}
        <PaymentHistorySection payments={payments} totalPayments={totalPayments} />

        {/* 비밀번호 변경 */}
        <Card className="overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-green-400 to-emerald-500" />
          <CardHeader className="flex flex-row items-center gap-4 space-y-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
              <Lock className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <CardTitle>비밀번호 변경</CardTitle>
              <CardDescription>계정 보안을 위해 정기적으로 변경하세요</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>

        {/* 계정 관리 */}
        <Card className="overflow-hidden border-destructive/30">
          <div className="h-1 bg-gradient-to-r from-red-400 to-red-500" />
          <CardHeader className="flex flex-row items-center gap-4 space-y-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <CardTitle className="text-destructive">위험 구역</CardTitle>
              <CardDescription>계정 삭제 시 모든 데이터가 영구적으로 삭제됩니다</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <AccountSection />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
