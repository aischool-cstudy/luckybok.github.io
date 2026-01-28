'use client';

import { useState, useEffect, useCallback } from 'react';
import { GenerateForm, ContentDisplay } from '@/components/features/generate';
import { getRemainingGenerations } from '@/actions/generate';
import type { GeneratedContent } from '@/lib/ai/schemas';

export default function GeneratePage() {
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(
    null
  );
  const [streamingContent, setStreamingContent] = useState<Partial<GeneratedContent> | null>(
    null
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [stats, setStats] = useState<{
    remaining: number;
    limit: number;
    plan: string;
  } | null>(null);

  useEffect(() => {
    async function loadStats() {
      const result = await getRemainingGenerations();
      setStats(result);
    }
    loadStats();
  }, [generatedContent]);

  const handleStreamUpdate = useCallback((partial: Partial<GeneratedContent>) => {
    setIsStreaming(true);
    setStreamingContent(partial);
    setGeneratedContent(null);
  }, []);

  const handleGenerated = useCallback((content: GeneratedContent) => {
    setIsStreaming(false);
    setStreamingContent(null);
    setGeneratedContent(content);
  }, []);

  // 표시할 콘텐츠 결정: 스트리밍 중이면 부분 콘텐츠, 완료되면 전체 콘텐츠
  const displayContent = streamingContent || generatedContent;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">콘텐츠 생성</h1>
        <p className="mt-2 text-muted-foreground">
          AI가 맞춤형 코딩 교육 콘텐츠를 실시간으로 생성합니다.
        </p>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* 생성 폼 */}
        <div className="lg:w-1/3">
          <GenerateForm
            onGenerated={handleGenerated}
            onStreamUpdate={handleStreamUpdate}
            remainingGenerations={stats?.remaining ?? 0}
            plan={stats?.plan ?? 'starter'}
          />
        </div>

        {/* 생성된 콘텐츠 */}
        <div className="lg:w-2/3">
          {displayContent ? (
            <ContentDisplay content={displayContent} isStreaming={isStreaming} />
          ) : (
            <div className="flex h-96 items-center justify-center rounded-lg border-2 border-dashed border-muted">
              <div className="text-center text-muted-foreground">
                <p className="text-lg font-medium">생성된 콘텐츠가 여기에 표시됩니다</p>
                <p className="mt-2 text-sm">
                  왼쪽 폼에서 주제와 옵션을 선택하고 생성 버튼을 클릭하세요
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
