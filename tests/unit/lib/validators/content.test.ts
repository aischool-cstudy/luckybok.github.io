import { describe, it, expect } from 'vitest';
import {
  generateContentSchema,
  codeExampleSchema,
  quizQuestionSchema,
  generatedContentSchema,
  SUPPORTED_LANGUAGES,
  DIFFICULTY_LEVELS,
  TARGET_AUDIENCES,
  LANGUAGE_LABELS,
  DIFFICULTY_LABELS,
  TARGET_AUDIENCE_LABELS,
  LANGUAGE_ANALOGY_DOMAINS,
  type SupportedLanguage,
  type DifficultyLevel,
  type TargetAudience,
} from '@/lib/validators/content';

describe('Content Validators', () => {
  describe('generateContentSchema', () => {
    describe('유효한 입력', () => {
      it('모든 필드가 유효한 경우 검증을 통과해야 한다', () => {
        const validInput = {
          language: 'python',
          topic: '함수와 메서드',
          difficulty: 'beginner',
          targetAudience: 'non_tech_worker',
        };

        const result = generateContentSchema.safeParse(validInput);

        expect(result.success).toBe(true);
      });

      it('additionalContext가 선택적이어야 한다', () => {
        const withoutContext = {
          language: 'javascript',
          topic: '변수와 상수',
          difficulty: 'intermediate',
          targetAudience: 'junior_developer',
        };

        const withContext = {
          ...withoutContext,
          additionalContext: '웹 개발 관점에서 설명해주세요',
        };

        expect(generateContentSchema.safeParse(withoutContext).success).toBe(true);
        expect(generateContentSchema.safeParse(withContext).success).toBe(true);
      });

      it('모든 지원 언어를 허용해야 한다', () => {
        SUPPORTED_LANGUAGES.forEach((language) => {
          const input = {
            language,
            topic: '테스트 주제',
            difficulty: 'beginner',
            targetAudience: 'non_tech_worker',
          };

          expect(generateContentSchema.safeParse(input).success).toBe(true);
        });
      });

      it('모든 난이도 레벨을 허용해야 한다', () => {
        DIFFICULTY_LEVELS.forEach((difficulty) => {
          const input = {
            language: 'python',
            topic: '테스트 주제',
            difficulty,
            targetAudience: 'non_tech_worker',
          };

          expect(generateContentSchema.safeParse(input).success).toBe(true);
        });
      });

      it('모든 타겟 오디언스를 허용해야 한다', () => {
        TARGET_AUDIENCES.forEach((targetAudience) => {
          const input = {
            language: 'python',
            topic: '테스트 주제',
            difficulty: 'beginner',
            targetAudience,
          };

          expect(generateContentSchema.safeParse(input).success).toBe(true);
        });
      });
    });

    describe('유효하지 않은 입력', () => {
      it('지원하지 않는 언어는 거부해야 한다', () => {
        const input = {
          language: 'ruby',
          topic: '테스트',
          difficulty: 'beginner',
          targetAudience: 'non_tech_worker',
        };

        const result = generateContentSchema.safeParse(input);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('지원하지 않는 프로그래밍 언어입니다.');
        }
      });

      it('올바르지 않은 난이도는 거부해야 한다', () => {
        const input = {
          language: 'python',
          topic: '테스트',
          difficulty: 'expert',
          targetAudience: 'non_tech_worker',
        };

        const result = generateContentSchema.safeParse(input);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('올바른 난이도를 선택해주세요.');
        }
      });

      it('올바르지 않은 타겟 오디언스는 거부해야 한다', () => {
        const input = {
          language: 'python',
          topic: '테스트',
          difficulty: 'beginner',
          targetAudience: 'student',
        };

        const result = generateContentSchema.safeParse(input);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('올바른 학습자 유형을 선택해주세요.');
        }
      });

      it('2자 미만의 주제는 거부해야 한다', () => {
        const input = {
          language: 'python',
          topic: '함',
          difficulty: 'beginner',
          targetAudience: 'non_tech_worker',
        };

        const result = generateContentSchema.safeParse(input);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('주제는 최소 2자 이상이어야 합니다.');
        }
      });

      it('200자 초과 주제는 거부해야 한다', () => {
        const input = {
          language: 'python',
          topic: 'a'.repeat(201),
          difficulty: 'beginner',
          targetAudience: 'non_tech_worker',
        };

        const result = generateContentSchema.safeParse(input);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('주제는 200자를 초과할 수 없습니다.');
        }
      });

      it('500자 초과 추가 컨텍스트는 거부해야 한다', () => {
        const input = {
          language: 'python',
          topic: '테스트 주제',
          difficulty: 'beginner',
          targetAudience: 'non_tech_worker',
          additionalContext: 'a'.repeat(501),
        };

        const result = generateContentSchema.safeParse(input);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('추가 컨텍스트는 500자를 초과할 수 없습니다.');
        }
      });
    });
  });

  describe('codeExampleSchema', () => {
    it('유효한 코드 예제를 허용해야 한다', () => {
      const validExample = {
        title: 'Hello World',
        description: 'Python에서 Hello World 출력하기',
        code: 'print("Hello, World!")',
        explanation: '이 코드는 화면에 Hello, World!를 출력합니다.',
      };

      const result = codeExampleSchema.safeParse(validExample);

      expect(result.success).toBe(true);
    });

    it('languageVersion은 선택적이어야 한다', () => {
      const withVersion = {
        title: 'Hello World',
        description: '설명',
        code: 'print("Hello")',
        explanation: '설명',
        languageVersion: 'Python 3.10',
      };

      const withoutVersion = {
        title: 'Hello World',
        description: '설명',
        code: 'print("Hello")',
        explanation: '설명',
      };

      expect(codeExampleSchema.safeParse(withVersion).success).toBe(true);
      expect(codeExampleSchema.safeParse(withoutVersion).success).toBe(true);
    });

    it('필수 필드가 없으면 거부해야 한다', () => {
      const missingCode = {
        title: 'Hello World',
        description: '설명',
        explanation: '설명',
      };

      const result = codeExampleSchema.safeParse(missingCode);

      expect(result.success).toBe(false);
    });
  });

  describe('quizQuestionSchema', () => {
    it('유효한 퀴즈 문항을 허용해야 한다', () => {
      const validQuiz = {
        question: 'Python에서 변수를 선언하는 방법은?',
        options: ['var x = 1', 'x = 1', 'let x = 1', 'int x = 1'],
        correctAnswer: 1,
        explanation: 'Python은 타입 선언 없이 변수를 선언합니다.',
      };

      const result = quizQuestionSchema.safeParse(validQuiz);

      expect(result.success).toBe(true);
    });

    it('options는 정확히 4개여야 한다', () => {
      const threeOptions = {
        question: '질문',
        options: ['A', 'B', 'C'],
        correctAnswer: 0,
        explanation: '설명',
      };

      const fiveOptions = {
        question: '질문',
        options: ['A', 'B', 'C', 'D', 'E'],
        correctAnswer: 0,
        explanation: '설명',
      };

      expect(quizQuestionSchema.safeParse(threeOptions).success).toBe(false);
      expect(quizQuestionSchema.safeParse(fiveOptions).success).toBe(false);
    });

    it('correctAnswer는 0-3 범위여야 한다', () => {
      const baseQuiz = {
        question: '질문',
        options: ['A', 'B', 'C', 'D'],
        explanation: '설명',
      };

      expect(quizQuestionSchema.safeParse({ ...baseQuiz, correctAnswer: 0 }).success).toBe(true);
      expect(quizQuestionSchema.safeParse({ ...baseQuiz, correctAnswer: 3 }).success).toBe(true);
      expect(quizQuestionSchema.safeParse({ ...baseQuiz, correctAnswer: -1 }).success).toBe(false);
      expect(quizQuestionSchema.safeParse({ ...baseQuiz, correctAnswer: 4 }).success).toBe(false);
    });
  });

  describe('generatedContentSchema', () => {
    it('유효한 생성 콘텐츠를 허용해야 한다', () => {
      const validContent = {
        title: 'Python 함수 기초',
        summary: '함수의 기본 개념을 배웁니다.',
        introduction: '함수는 재사용 가능한 코드 블록입니다.',
        sections: [
          {
            heading: '함수 정의',
            content: '함수를 정의하는 방법을 알아봅니다.',
          },
        ],
        realWorldAnalogy: '함수는 레시피와 같습니다.',
        practicalApplication: '업무 자동화에 활용할 수 있습니다.',
        codeExamples: [
          {
            title: '기본 함수',
            description: '간단한 함수 예제',
            code: 'def hello(): print("Hello")',
            explanation: '이 함수는 Hello를 출력합니다.',
          },
        ],
        quiz: [
          {
            question: '함수를 정의하는 키워드는?',
            options: ['function', 'def', 'fn', 'func'],
            correctAnswer: 1,
            explanation: 'Python에서는 def 키워드를 사용합니다.',
          },
        ],
        keyTakeaways: ['함수로 코드를 재사용할 수 있습니다.'],
      };

      const result = generatedContentSchema.safeParse(validContent);

      expect(result.success).toBe(true);
    });

    it('furtherReading은 선택적이어야 한다', () => {
      const withReading = {
        title: '제목',
        summary: '요약',
        introduction: '소개',
        sections: [],
        realWorldAnalogy: '비유',
        practicalApplication: '적용',
        codeExamples: [],
        quiz: [],
        keyTakeaways: [],
        furtherReading: [{ title: '참고 자료', description: '추가 학습' }],
      };

      const withoutReading = {
        title: '제목',
        summary: '요약',
        introduction: '소개',
        sections: [],
        realWorldAnalogy: '비유',
        practicalApplication: '적용',
        codeExamples: [],
        quiz: [],
        keyTakeaways: [],
      };

      expect(generatedContentSchema.safeParse(withReading).success).toBe(true);
      expect(generatedContentSchema.safeParse(withoutReading).success).toBe(true);
    });
  });

  describe('상수 및 레이블', () => {
    it('SUPPORTED_LANGUAGES에 6개 언어가 있어야 한다', () => {
      expect(SUPPORTED_LANGUAGES).toHaveLength(6);
      expect(SUPPORTED_LANGUAGES).toContain('python');
      expect(SUPPORTED_LANGUAGES).toContain('javascript');
      expect(SUPPORTED_LANGUAGES).toContain('sql');
      expect(SUPPORTED_LANGUAGES).toContain('java');
      expect(SUPPORTED_LANGUAGES).toContain('typescript');
      expect(SUPPORTED_LANGUAGES).toContain('go');
    });

    it('DIFFICULTY_LEVELS에 3개 레벨이 있어야 한다', () => {
      expect(DIFFICULTY_LEVELS).toHaveLength(3);
      expect(DIFFICULTY_LEVELS).toContain('beginner');
      expect(DIFFICULTY_LEVELS).toContain('intermediate');
      expect(DIFFICULTY_LEVELS).toContain('advanced');
    });

    it('TARGET_AUDIENCES에 4개 유형이 있어야 한다', () => {
      expect(TARGET_AUDIENCES).toHaveLength(4);
      expect(TARGET_AUDIENCES).toContain('non_tech_worker');
      expect(TARGET_AUDIENCES).toContain('junior_developer');
      expect(TARGET_AUDIENCES).toContain('manager');
      expect(TARGET_AUDIENCES).toContain('career_changer');
    });

    it('모든 언어에 레이블이 있어야 한다', () => {
      SUPPORTED_LANGUAGES.forEach((lang) => {
        expect(LANGUAGE_LABELS[lang]).toBeDefined();
        expect(typeof LANGUAGE_LABELS[lang]).toBe('string');
      });
    });

    it('모든 난이도에 레이블이 있어야 한다', () => {
      DIFFICULTY_LEVELS.forEach((level) => {
        expect(DIFFICULTY_LABELS[level]).toBeDefined();
        expect(typeof DIFFICULTY_LABELS[level]).toBe('string');
      });
    });

    it('모든 타겟 오디언스에 레이블이 있어야 한다', () => {
      TARGET_AUDIENCES.forEach((audience) => {
        expect(TARGET_AUDIENCE_LABELS[audience]).toBeDefined();
        expect(typeof TARGET_AUDIENCE_LABELS[audience]).toBe('string');
      });
    });

    it('모든 언어에 비유 도메인이 있어야 한다', () => {
      SUPPORTED_LANGUAGES.forEach((lang) => {
        expect(LANGUAGE_ANALOGY_DOMAINS[lang]).toBeDefined();
        expect(typeof LANGUAGE_ANALOGY_DOMAINS[lang]).toBe('string');
      });
    });

    it('난이도 레이블이 한국어여야 한다', () => {
      expect(DIFFICULTY_LABELS.beginner).toBe('입문');
      expect(DIFFICULTY_LABELS.intermediate).toBe('중급');
      expect(DIFFICULTY_LABELS.advanced).toBe('고급');
    });

    it('타겟 오디언스 레이블이 한국어여야 한다', () => {
      expect(TARGET_AUDIENCE_LABELS.non_tech_worker).toBe('비전공 직장인');
      expect(TARGET_AUDIENCE_LABELS.junior_developer).toBe('주니어 개발자');
      expect(TARGET_AUDIENCE_LABELS.manager).toBe('관리자/임원');
      expect(TARGET_AUDIENCE_LABELS.career_changer).toBe('커리어 전환자');
    });
  });
});
