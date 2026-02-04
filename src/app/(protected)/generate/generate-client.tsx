'use client';

/**
 * 콘텐츠 생성 클라이언트 컴포넌트
 * - 스트리밍 상태 관리
 * - 콘텐츠 표시 로직
 */

import { useState, useCallback } from 'react';
import { Sparkles, FileText, Zap, BookOpen, Code } from 'lucide-react';
import { GenerateForm, ContentDisplay } from '@/components/features/generate';
import { Badge } from '@/components/ui/badge';
import type { GeneratedContent } from '@/lib/ai/schemas';

interface GenerationStats {
  remaining: number;
  limit: number;
  plan: string;
}

interface GenerateClientProps {
  /** 서버에서 미리 fetch된 초기 통계 */
  initialStats: GenerationStats;
}

export function GenerateClient({ initialStats }: GenerateClientProps) {
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  // 스트리밍 기능은 추후 구현 예정
  // const [streamingContent, setStreamingContent] = useState<Partial<GeneratedContent> | null>(null);
  const [isStreaming] = useState(false);
  const [stats, setStats] = useState<GenerationStats>(initialStats);

  const handleGenerated = useCallback((content: GeneratedContent) => {
    setGeneratedContent(content);
    // 생성 완료 후 remaining 카운트 업데이트
    setStats(prev => ({
      ...prev,
      remaining: Math.max(0, prev.remaining - 1),
    }));
  }, []);

  // 표시할 콘텐츠 결정
  const displayContent = generatedContent;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 헤더 섹션 */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-purple-500/10 to-pink-500/10 p-8 border mb-8">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 h-64 w-64 rounded-full bg-gradient-to-br from-primary/20 to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-16 -ml-16 h-48 w-48 rounded-full bg-gradient-to-tr from-purple-500/20 to-transparent blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              <Sparkles className="h-3 w-3 mr-1" />
              AI 콘텐츠 생성기
            </Badge>
          </div>
          <h1 className="text-3xl font-bold">콘텐츠 생성</h1>
          <p className="mt-2 text-muted-foreground text-lg">
            Claude AI가 맞춤형 코딩 교육 콘텐츠를 실시간으로 생성합니다
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* 생성 폼 */}
        <div className="lg:w-1/3 lg:sticky lg:top-8 lg:self-start">
          <GenerateForm
            onGenerated={handleGenerated}
            remainingGenerations={stats.remaining}
            plan={stats.plan}
          />
        </div>

        {/* 생성된 콘텐츠 */}
        <div className="lg:w-2/3">
          {displayContent ? (
            <ContentDisplay content={displayContent} isStreaming={isStreaming} />
          ) : (
            <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-muted-foreground/20 p-12">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5" />
              <div className="relative text-center">
                <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-purple-500/10">
                  <FileText className="h-12 w-12 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">생성된 콘텐츠가 여기에 표시됩니다</h3>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                  왼쪽 폼에서 프로그래밍 언어, 주제, 난이도를 선택하고 생성 버튼을 클릭하세요
                </p>

                {/* 생성 가이드 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto">
                  <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-muted/50">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                      <Code className="h-5 w-5 text-blue-500" />
                    </div>
                    <span className="text-sm font-medium">언어 선택</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-muted/50">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                      <BookOpen className="h-5 w-5 text-purple-500" />
                    </div>
                    <span className="text-sm font-medium">주제 입력</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-muted/50">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                      <Zap className="h-5 w-5 text-green-500" />
                    </div>
                    <span className="text-sm font-medium">생성하기</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
