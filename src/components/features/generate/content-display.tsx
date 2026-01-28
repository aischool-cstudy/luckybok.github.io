'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui';
import { BookOpen, Code, CheckCircle, Lightbulb, Clock, Loader2 } from 'lucide-react';
import type { GeneratedContent } from '@/lib/ai/schemas';

interface ContentDisplayProps {
  content: Partial<GeneratedContent>;
  isStreaming?: boolean;
}

export function ContentDisplay({ content, isStreaming = false }: ContentDisplayProps) {
  const [activeTab, setActiveTab] = useState<'content' | 'quiz'>('content');

  return (
    <div className="w-full max-w-4xl space-y-6">
      {/* 스트리밍 표시 */}
      {isStreaming && (
        <div className="flex items-center gap-2 text-sm text-primary animate-pulse">
          <Loader2 className="h-4 w-4 animate-spin" />
          AI가 콘텐츠를 생성하고 있습니다...
        </div>
      )}

      {/* 헤더 */}
      <Card>
        <CardHeader>
          {content.estimatedReadTime !== undefined && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              예상 읽기 시간: {content.estimatedReadTime}분
            </div>
          )}
          {content.title ? (
            <CardTitle className="text-2xl">{content.title}</CardTitle>
          ) : (
            <div className="h-8 w-2/3 bg-muted animate-pulse rounded" />
          )}
          {content.summary ? (
            <CardDescription className="text-base">{content.summary}</CardDescription>
          ) : (
            <div className="h-4 w-full bg-muted animate-pulse rounded" />
          )}
        </CardHeader>
      </Card>

      {/* 탭 */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('content')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'content'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <BookOpen className="mr-2 inline-block h-4 w-4" />
          학습 콘텐츠
        </button>
        <button
          onClick={() => setActiveTab('quiz')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'quiz'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <CheckCircle className="mr-2 inline-block h-4 w-4" />
          퀴즈 ({content.exercises?.length ?? 0}문제)
        </button>
      </div>

      {/* 콘텐츠 탭 */}
      {activeTab === 'content' && (
        <div className="space-y-6">
          {/* 학습 목표 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                학습 목표
              </CardTitle>
            </CardHeader>
            <CardContent>
              {content.learningObjectives && content.learningObjectives.length > 0 ? (
                <ul className="list-inside list-disc space-y-2">
                  {content.learningObjectives.map((objective, index) => (
                    <li key={index} className="text-muted-foreground">
                      {objective}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="space-y-2">
                  <div className="h-4 w-full bg-muted animate-pulse rounded" />
                  <div className="h-4 w-4/5 bg-muted animate-pulse rounded" />
                  <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* 핵심 개념 설명 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">핵심 개념</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {content.explanation ? (
                  <p className="whitespace-pre-wrap">{content.explanation}</p>
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Code className="h-5 w-5 text-blue-500" />
                예제 코드
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-muted p-4 overflow-x-auto">
                {content.codeExample ? (
                  <pre className="text-sm">
                    <code>{content.codeExample}</code>
                  </pre>
                ) : (
                  <div className="space-y-2">
                    <div className="h-4 w-1/2 bg-background animate-pulse rounded" />
                    <div className="h-4 w-3/4 bg-background animate-pulse rounded" />
                    <div className="h-4 w-2/3 bg-background animate-pulse rounded" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 핵심 요약 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">핵심 요약</CardTitle>
            </CardHeader>
            <CardContent>
              {content.summary ? (
                <p className="text-muted-foreground">{content.summary}</p>
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
            <Card>
              <CardContent className="py-8">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  퀴즈를 생성하고 있습니다...
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

interface QuizCardProps {
  exercise: {
    question: string;
    hint?: string;
    difficulty: 'easy' | 'medium' | 'hard';
  };
  index: number;
}

function QuizCard({ exercise, index }: QuizCardProps) {
  const [showHint, setShowHint] = useState(false);

  const difficultyColors = {
    easy: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
    hard: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
  };

  const difficultyLabels = {
    easy: '쉬움',
    medium: '보통',
    hard: '어려움',
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">문제 {index + 1}</CardTitle>
          <span
            className={`rounded-full px-2 py-1 text-xs font-medium ${
              difficultyColors[exercise.difficulty]
            }`}
          >
            {difficultyLabels[exercise.difficulty]}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="font-medium">{exercise.question}</p>

        {exercise.hint && (
          <div>
            <button
              onClick={() => setShowHint(!showHint)}
              className="text-sm text-primary hover:underline"
            >
              {showHint ? '힌트 숨기기' : '힌트 보기'}
            </button>
            {showHint && (
              <p className="mt-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
                💡 {exercise.hint}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
