'use client';

import { useState, memo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
} from '@/components/ui';
import { BookOpen, Code, CheckCircle, Lightbulb, Clock, Loader2, Sparkles, Target, Copy, Check } from 'lucide-react';
import type { GeneratedContent } from '@/lib/ai/schemas';
import { cn } from '@/lib/utils';

interface ContentDisplayProps {
  content: Partial<GeneratedContent>;
  isStreaming?: boolean;
}

export const ContentDisplay = memo(function ContentDisplay({ content, isStreaming = false }: ContentDisplayProps) {
  const [activeTab, setActiveTab] = useState<'content' | 'quiz'>('content');

  return (
    <div className="w-full max-w-4xl space-y-6">
      {/* 스트리밍 표시 */}
      {isStreaming && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            </div>
          </div>
          <div>
            <p className="font-medium text-primary">AI가 콘텐츠를 생성하고 있어요</p>
            <p className="text-sm text-muted-foreground">잠시만 기다려주세요...</p>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <Card className="overflow-hidden shadow-lg">
        <div className="h-1.5 bg-gradient-to-r from-primary via-purple-500 to-pink-500" />
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between">
            {content.estimatedReadTime !== undefined && (
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                <Clock className="h-3 w-3 mr-1" />
                읽기 시간: {content.estimatedReadTime}분
              </Badge>
            )}
            {!isStreaming && content.title && (
              <Badge className="bg-green-500/10 text-green-600 border-0">
                <Check className="h-3 w-3 mr-1" />
                생성 완료
              </Badge>
            )}
          </div>
          {content.title ? (
            <CardTitle className="text-2xl bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              {content.title}
            </CardTitle>
          ) : (
            <div className="h-8 w-2/3 bg-muted animate-pulse rounded-lg" />
          )}
          {content.summary ? (
            <CardDescription className="text-base leading-relaxed">{content.summary}</CardDescription>
          ) : (
            <div className="space-y-2">
              <div className="h-4 w-full bg-muted animate-pulse rounded" />
              <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
            </div>
          )}
        </CardHeader>
      </Card>

      {/* 탭 */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-xl">
        <button
          type="button"
          onClick={() => setActiveTab('content')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all',
            activeTab === 'content'
              ? 'bg-background text-primary shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
          )}
        >
          <BookOpen className="h-4 w-4" />
          학습 콘텐츠
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('quiz')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all',
            activeTab === 'quiz'
              ? 'bg-background text-primary shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
          )}
        >
          <CheckCircle className="h-4 w-4" />
          퀴즈
          {content.exercises && content.exercises.length > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs">
              {content.exercises.length}
            </Badge>
          )}
        </button>
      </div>

      {/* 콘텐츠 탭 */}
      {activeTab === 'content' && (
        <div className="space-y-6">
          {/* 학습 목표 */}
          <Card className="overflow-hidden group hover:shadow-md transition-shadow">
            <div className="h-1 bg-gradient-to-r from-yellow-400 to-orange-400" />
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-100 to-orange-100 dark:from-yellow-900/30 dark:to-orange-900/30">
                  <Lightbulb className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                학습 목표
              </CardTitle>
            </CardHeader>
            <CardContent>
              {content.learningObjectives && content.learningObjectives.length > 0 ? (
                <ul className="space-y-3">
                  {content.learningObjectives.map((objective, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yellow-500/10 text-xs font-bold text-yellow-600 dark:text-yellow-400">
                        {index + 1}
                      </div>
                      <span className="text-muted-foreground leading-relaxed">{objective}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-6 w-6 rounded-full bg-muted animate-pulse" />
                      <div className={`h-4 bg-muted animate-pulse rounded flex-1`} style={{ width: `${100 - i * 10}%` }} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 핵심 개념 설명 */}
          <Card className="overflow-hidden group hover:shadow-md transition-shadow">
            <div className="h-1 bg-gradient-to-r from-purple-400 to-pink-400" />
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30">
                  <Target className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                핵심 개념
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {content.explanation ? (
                  <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">{content.explanation}</p>
                ) : (
                  <div className="space-y-2">
                    <div className="h-4 w-full bg-muted animate-pulse rounded" />
                    <div className="h-4 w-full bg-muted animate-pulse rounded" />
                    <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 코드 예제 */}
          <CodeExampleCard codeExample={content.codeExample} />

          {/* 핵심 요약 */}
          <Card className="overflow-hidden group hover:shadow-md transition-shadow">
            <div className="h-1 bg-gradient-to-r from-green-400 to-emerald-400" />
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                핵심 요약
              </CardTitle>
            </CardHeader>
            <CardContent>
              {content.summary ? (
                <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/10">
                  <p className="text-muted-foreground leading-relaxed">{content.summary}</p>
                </div>
              ) : (
                <div className="h-4 w-full bg-muted animate-pulse rounded" />
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 퀴즈 탭 */}
      {activeTab === 'quiz' && (
        <div className="space-y-4">
          {content.exercises && content.exercises.length > 0 ? (
            content.exercises.map((exercise, index) => (
              <QuizCard key={index} exercise={exercise} index={index} />
            ))
          ) : (
            <Card className="overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-blue-400 to-indigo-400" />
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                    <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <Loader2 className="h-6 w-6 text-primary animate-spin" />
                    </div>
                  </div>
                  <p className="font-medium">퀴즈를 생성하고 있습니다...</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
});

ContentDisplay.displayName = 'ContentDisplay';

// 코드 예제 카드 컴포넌트
const CodeExampleCard = memo(function CodeExampleCard({ codeExample }: { codeExample?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!codeExample) return;

    try {
      await navigator.clipboard.writeText(codeExample);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 API 미지원 브라우저 대응: 구형 방식 시도
      try {
        const textArea = document.createElement('textarea');
        textArea.value = codeExample;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        console.error('클립보드 복사 실패');
      }
    }
  };

  return (
    <Card className="overflow-hidden group hover:shadow-md transition-shadow">
      <div className="h-1 bg-gradient-to-r from-blue-400 to-indigo-400" />
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-lg">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30">
              <Code className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            예제 코드
          </CardTitle>
          {codeExample && (
            <button
              type="button"
              onClick={handleCopy}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                copied
                  ? 'bg-green-500/10 text-green-600'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
              )}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  복사됨
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  복사
                </>
              )}
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl bg-slate-900 dark:bg-slate-950 p-4 overflow-x-auto">
          {codeExample ? (
            <pre className="text-sm text-slate-100">
              <code>{codeExample}</code>
            </pre>
          ) : (
            <div className="space-y-2">
              <div className="h-4 w-1/2 bg-slate-800 animate-pulse rounded" />
              <div className="h-4 w-3/4 bg-slate-800 animate-pulse rounded" />
              <div className="h-4 w-2/3 bg-slate-800 animate-pulse rounded" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

CodeExampleCard.displayName = 'CodeExampleCard';

interface QuizCardProps {
  exercise: {
    question: string;
    hint?: string;
    difficulty: 'easy' | 'medium' | 'hard';
  };
  index: number;
}

const QuizCard = memo(function QuizCard({ exercise, index }: QuizCardProps) {
  const [showHint, setShowHint] = useState(false);

  const difficultyConfig = {
    easy: {
      bg: 'bg-green-500/10',
      text: 'text-green-600 dark:text-green-400',
      border: 'border-green-500/20',
      label: '쉬움',
      gradient: 'from-green-400 to-emerald-400',
    },
    medium: {
      bg: 'bg-yellow-500/10',
      text: 'text-yellow-600 dark:text-yellow-400',
      border: 'border-yellow-500/20',
      label: '보통',
      gradient: 'from-yellow-400 to-orange-400',
    },
    hard: {
      bg: 'bg-red-500/10',
      text: 'text-red-600 dark:text-red-400',
      border: 'border-red-500/20',
      label: '어려움',
      gradient: 'from-red-400 to-pink-400',
    },
  };

  const config = difficultyConfig[exercise.difficulty];

  return (
    <Card className="overflow-hidden group hover:shadow-md transition-shadow">
      <div className={cn('h-1 bg-gradient-to-r', config.gradient)} />
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex h-9 w-9 items-center justify-center rounded-xl font-bold',
              config.bg, config.text
            )}>
              {index + 1}
            </div>
            <CardTitle className="text-base">문제 {index + 1}</CardTitle>
          </div>
          <Badge className={cn('border', config.bg, config.text, config.border)}>
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="font-medium leading-relaxed">{exercise.question}</p>

        {exercise.hint && (
          <div>
            <button
              type="button"
              onClick={() => setShowHint(!showHint)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                showHint
                  ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
              )}
            >
              <Lightbulb className="h-4 w-4" />
              {showHint ? '힌트 숨기기' : '힌트 보기'}
            </button>
            {showHint && (
              <div className="mt-3 p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-yellow-500/10">
                    <Lightbulb className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{exercise.hint}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

QuizCard.displayName = 'QuizCard';
