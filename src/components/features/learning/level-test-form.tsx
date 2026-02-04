'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Loader2 } from 'lucide-react';
import type { ProgrammingLanguage } from '@/types/database.types';

interface LevelTestQuestion {
  id: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  question: string;
  code_snippet: string | null;
  options: string[];
  topic: string;
  order_index: number;
}

interface LevelTestFormProps {
  language: ProgrammingLanguage;
  questions: LevelTestQuestion[];
}

export function LevelTestForm({ language: _language, questions }: LevelTestFormProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const handleComplete = async () => {
    setIsLoading(true);
    // TODO: Implement actual test submission logic
    setTimeout(() => {
      router.push('/dashboard');
    }, 1000);
  };

  const currentQuestion = questions[currentIndex];

  if (!currentQuestion) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">문제를 불러올 수 없습니다.</p>
          <Button onClick={() => router.push('/dashboard')} className="mt-4">
            대시보드로 이동
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          문제 {currentIndex + 1} / {questions.length}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="font-medium">{currentQuestion.question}</p>

        {currentQuestion.code_snippet && (
          <pre className="p-4 rounded-lg bg-muted overflow-x-auto text-sm">
            <code>{currentQuestion.code_snippet}</code>
          </pre>
        )}

        <div className="space-y-2">
          {currentQuestion.options.map((option, index) => (
            <Button
              key={index}
              variant="outline"
              className="w-full justify-start text-left h-auto py-3"
              onClick={() => {
                if (currentIndex < questions.length - 1) {
                  setCurrentIndex(currentIndex + 1);
                } else {
                  handleComplete();
                }
              }}
            >
              {option}
            </Button>
          ))}
        </div>

        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
          >
            이전
          </Button>
          <Button onClick={handleComplete} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-2 h-4 w-4" />
            )}
            {currentIndex === questions.length - 1 ? '제출' : '건너뛰기'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
