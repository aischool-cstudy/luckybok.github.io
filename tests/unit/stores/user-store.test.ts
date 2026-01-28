import { describe, it, expect, beforeEach } from 'vitest';
import { useUserStore, type UserProfile } from '@/stores/user-store';

describe('userStore', () => {
  const mockProfile: UserProfile = {
    id: 'user-123',
    email: 'test@example.com',
    name: '테스트 사용자',
    plan: 'starter',
    dailyGenerationsRemaining: 10,
    dailyResetAt: new Date().toISOString(),
  };

  beforeEach(() => {
    // 스토어 초기화
    useUserStore.getState().reset();
  });

  describe('setProfile', () => {
    it('프로필을 설정해야 한다', () => {
      useUserStore.getState().setProfile(mockProfile);
      expect(useUserStore.getState().profile).toEqual(mockProfile);
      expect(useUserStore.getState().error).toBeNull();
    });

    it('null로 프로필을 초기화해야 한다', () => {
      useUserStore.getState().setProfile(mockProfile);
      useUserStore.getState().setProfile(null);
      expect(useUserStore.getState().profile).toBeNull();
    });
  });

  describe('updateGenerationsRemaining', () => {
    it('남은 생성 횟수를 업데이트해야 한다', () => {
      useUserStore.getState().setProfile(mockProfile);
      useUserStore.getState().updateGenerationsRemaining(5);
      expect(useUserStore.getState().profile?.dailyGenerationsRemaining).toBe(5);
    });

    it('프로필이 없으면 아무것도 하지 않아야 한다', () => {
      useUserStore.getState().updateGenerationsRemaining(5);
      expect(useUserStore.getState().profile).toBeNull();
    });
  });

  describe('decrementGenerations', () => {
    it('생성 횟수를 1 감소시켜야 한다', () => {
      useUserStore.getState().setProfile(mockProfile);
      useUserStore.getState().decrementGenerations();
      expect(useUserStore.getState().profile?.dailyGenerationsRemaining).toBe(9);
    });

    it('0 이하로 감소하지 않아야 한다', () => {
      useUserStore.getState().setProfile({
        ...mockProfile,
        dailyGenerationsRemaining: 0,
      });
      useUserStore.getState().decrementGenerations();
      expect(useUserStore.getState().profile?.dailyGenerationsRemaining).toBe(0);
    });
  });

  describe('setLoading', () => {
    it('로딩 상태를 설정해야 한다', () => {
      useUserStore.getState().setLoading(true);
      expect(useUserStore.getState().isLoading).toBe(true);
      useUserStore.getState().setLoading(false);
      expect(useUserStore.getState().isLoading).toBe(false);
    });
  });

  describe('setError', () => {
    it('에러를 설정해야 한다', () => {
      useUserStore.getState().setError('테스트 에러');
      expect(useUserStore.getState().error).toBe('테스트 에러');
    });

    it('에러를 null로 초기화해야 한다', () => {
      useUserStore.getState().setError('테스트 에러');
      useUserStore.getState().setError(null);
      expect(useUserStore.getState().error).toBeNull();
    });
  });

  describe('reset', () => {
    it('스토어를 초기 상태로 리셋해야 한다', () => {
      useUserStore.getState().setProfile(mockProfile);
      useUserStore.getState().setLoading(true);
      useUserStore.getState().setError('에러');
      useUserStore.getState().reset();

      expect(useUserStore.getState().profile).toBeNull();
      expect(useUserStore.getState().isLoading).toBe(false);
      expect(useUserStore.getState().error).toBeNull();
    });
  });
});
