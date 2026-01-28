import { describe, it, expect, beforeEach } from 'vitest';
import { useGenerateStore } from '@/stores/generate-store';

describe('generateStore', () => {
  beforeEach(() => {
    useGenerateStore.getState().reset();
  });

  describe('setFormField', () => {
    it('단일 폼 필드를 업데이트해야 한다', () => {
      useGenerateStore.getState().setFormField('topic', '변수와 함수');
      expect(useGenerateStore.getState().formData.topic).toBe('변수와 함수');
    });

    it('언어 필드를 업데이트해야 한다', () => {
      useGenerateStore.getState().setFormField('language', 'javascript');
      expect(useGenerateStore.getState().formData.language).toBe('javascript');
    });

    it('난이도 필드를 업데이트해야 한다', () => {
      useGenerateStore.getState().setFormField('difficulty', 'advanced');
      expect(useGenerateStore.getState().formData.difficulty).toBe('advanced');
    });
  });

  describe('setFormData', () => {
    it('여러 폼 필드를 동시에 업데이트해야 한다', () => {
      useGenerateStore.getState().setFormData({
        topic: '함수형 프로그래밍',
        language: 'typescript',
        difficulty: 'intermediate',
      });

      const { formData } = useGenerateStore.getState();
      expect(formData.topic).toBe('함수형 프로그래밍');
      expect(formData.language).toBe('typescript');
      expect(formData.difficulty).toBe('intermediate');
    });
  });

  describe('resetForm', () => {
    it('폼을 기본값으로 리셋해야 한다', () => {
      useGenerateStore.getState().setFormData({
        topic: '테스트',
        language: 'java',
        difficulty: 'advanced',
      });
      useGenerateStore.getState().resetForm();

      const { formData } = useGenerateStore.getState();
      expect(formData.topic).toBe('');
      expect(formData.language).toBe('python');
      expect(formData.difficulty).toBe('beginner');
    });

    it('생성된 콘텐츠도 초기화해야 한다', () => {
      useGenerateStore.getState().setGeneratedContent({ title: '테스트' } as never, 'content-123');
      useGenerateStore.getState().resetForm();

      expect(useGenerateStore.getState().generatedContent).toBeNull();
      expect(useGenerateStore.getState().contentId).toBeNull();
    });
  });

  describe('setGenerating', () => {
    it('생성 중 상태를 설정해야 한다', () => {
      useGenerateStore.getState().setGenerating(true);
      expect(useGenerateStore.getState().isGenerating).toBe(true);
    });
  });

  describe('setGeneratedContent', () => {
    it('생성된 콘텐츠를 설정해야 한다', () => {
      const mockContent = {
        title: '테스트 콘텐츠',
        learningObjectives: ['목표1'],
      };

      useGenerateStore.getState().setGeneratedContent(mockContent as never, 'content-123');

      expect(useGenerateStore.getState().generatedContent).toEqual(mockContent);
      expect(useGenerateStore.getState().contentId).toBe('content-123');
      expect(useGenerateStore.getState().isGenerating).toBe(false);
      expect(useGenerateStore.getState().error).toBeNull();
    });
  });

  describe('setError', () => {
    it('에러를 설정하고 생성 상태를 false로 해야 한다', () => {
      useGenerateStore.getState().setGenerating(true);
      useGenerateStore.getState().setError('생성 실패');

      expect(useGenerateStore.getState().error).toBe('생성 실패');
      expect(useGenerateStore.getState().isGenerating).toBe(false);
    });
  });

  describe('recentTopics', () => {
    it('최근 주제를 추가해야 한다', () => {
      useGenerateStore.getState().addRecentTopic('변수');
      useGenerateStore.getState().addRecentTopic('함수');

      expect(useGenerateStore.getState().recentTopics).toContain('변수');
      expect(useGenerateStore.getState().recentTopics).toContain('함수');
    });

    it('중복 주제는 맨 앞으로 이동해야 한다', () => {
      useGenerateStore.getState().addRecentTopic('변수');
      useGenerateStore.getState().addRecentTopic('함수');
      useGenerateStore.getState().addRecentTopic('변수');

      const topics = useGenerateStore.getState().recentTopics;
      expect(topics[0]).toBe('변수');
      expect(topics.filter((t) => t === '변수').length).toBe(1);
    });

    it('최대 10개까지만 유지해야 한다', () => {
      for (let i = 0; i < 15; i++) {
        useGenerateStore.getState().addRecentTopic(`주제${i}`);
      }

      expect(useGenerateStore.getState().recentTopics.length).toBe(10);
    });

    it('빈 문자열은 추가하지 않아야 한다', () => {
      useGenerateStore.getState().addRecentTopic('');
      useGenerateStore.getState().addRecentTopic('   ');

      expect(useGenerateStore.getState().recentTopics.length).toBe(0);
    });

    it('clearRecentTopics로 모두 삭제해야 한다', () => {
      useGenerateStore.getState().addRecentTopic('변수');
      useGenerateStore.getState().addRecentTopic('함수');
      useGenerateStore.getState().clearRecentTopics();

      expect(useGenerateStore.getState().recentTopics.length).toBe(0);
    });
  });
});
