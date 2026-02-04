-- ─────────────────────────────────────────────────────────
-- 016_learning_onboarding.sql
-- 적응형 학습 시스템 Phase 1: 온보딩 & 레벨 테스트
-- ─────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────
-- 학습자 프로필 테이블
-- ─────────────────────────────────────────────────────────
CREATE TABLE learner_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  experience_level TEXT CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
  learning_goals TEXT[] DEFAULT '{}',
  preferred_languages TEXT[] DEFAULT '{}',
  weekly_time_commitment INTEGER DEFAULT 5 CHECK (weekly_time_commitment >= 1 AND weekly_time_commitment <= 40),
  onboarding_completed BOOLEAN DEFAULT FALSE,
  onboarding_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_learner_profiles_user_id ON learner_profiles(user_id);
CREATE INDEX idx_learner_profiles_onboarding_completed ON learner_profiles(onboarding_completed) WHERE NOT onboarding_completed;

-- ─────────────────────────────────────────────────────────
-- 레벨 테스트 결과 테이블
-- ─────────────────────────────────────────────────────────
CREATE TABLE level_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('python', 'javascript', 'sql', 'java', 'typescript', 'go')),
  score INTEGER NOT NULL CHECK (score >= 0),
  total_questions INTEGER NOT NULL CHECK (total_questions > 0),
  determined_level TEXT NOT NULL CHECK (determined_level IN ('beginner', 'intermediate', 'advanced')),
  time_taken_seconds INTEGER CHECK (time_taken_seconds >= 0),
  answers JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_level_tests_user_id ON level_tests(user_id);
CREATE INDEX idx_level_tests_user_language ON level_tests(user_id, language);
CREATE INDEX idx_level_tests_created_at ON level_tests(created_at DESC);

-- ─────────────────────────────────────────────────────────
-- 레벨 테스트 문제 풀 테이블
-- ─────────────────────────────────────────────────────────
CREATE TABLE level_test_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language TEXT NOT NULL CHECK (language IN ('python', 'javascript', 'sql', 'java', 'typescript', 'go')),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  question TEXT NOT NULL,
  code_snippet TEXT,
  options JSONB NOT NULL,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  topic TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_level_test_questions_language ON level_test_questions(language);
CREATE INDEX idx_level_test_questions_language_difficulty ON level_test_questions(language, difficulty);
CREATE INDEX idx_level_test_questions_active ON level_test_questions(is_active) WHERE is_active;

-- ─────────────────────────────────────────────────────────
-- RLS 정책
-- ─────────────────────────────────────────────────────────
ALTER TABLE learner_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE level_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE level_test_questions ENABLE ROW LEVEL SECURITY;

-- learner_profiles 정책
CREATE POLICY "Users can view own learner profile"
  ON learner_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own learner profile"
  ON learner_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own learner profile"
  ON learner_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- level_tests 정책
CREATE POLICY "Users can view own level tests"
  ON level_tests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own level tests"
  ON level_tests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- level_test_questions 정책 (모든 인증 사용자가 활성 문제 조회 가능)
CREATE POLICY "Authenticated users can view active questions"
  ON level_test_questions FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = TRUE);

-- 관리자만 문제 추가/수정/삭제 가능
CREATE POLICY "Admins can manage questions"
  ON level_test_questions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- ─────────────────────────────────────────────────────────
-- 트리거: updated_at 자동 갱신
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_learner_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_learner_profiles_updated_at
  BEFORE UPDATE ON learner_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_learner_profile_updated_at();

CREATE OR REPLACE FUNCTION update_level_test_question_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_level_test_questions_updated_at
  BEFORE UPDATE ON level_test_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_level_test_question_updated_at();

-- ─────────────────────────────────────────────────────────
-- 함수: 레벨 결정 알고리즘
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION determine_level(
  p_score INTEGER,
  p_total_questions INTEGER
)
RETURNS TEXT AS $$
DECLARE
  v_percentage DECIMAL(5,2);
BEGIN
  IF p_total_questions = 0 THEN
    RETURN 'beginner';
  END IF;

  v_percentage := (p_score::DECIMAL / p_total_questions) * 100;

  IF v_percentage >= 80 THEN
    RETURN 'advanced';
  ELSIF v_percentage >= 50 THEN
    RETURN 'intermediate';
  ELSE
    RETURN 'beginner';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ─────────────────────────────────────────────────────────
-- 함수: 레벨 테스트 제출 처리
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION submit_level_test(
  p_user_id UUID,
  p_language TEXT,
  p_answers JSONB,
  p_time_taken_seconds INTEGER DEFAULT NULL
)
RETURNS TABLE (
  test_id UUID,
  score INTEGER,
  total_questions INTEGER,
  determined_level TEXT,
  percentage DECIMAL(5,2)
) AS $$
DECLARE
  v_test_id UUID;
  v_score INTEGER := 0;
  v_total INTEGER := 0;
  v_level TEXT;
  v_answer RECORD;
  v_correct_answer TEXT;
BEGIN
  -- 답안 채점
  FOR v_answer IN SELECT * FROM jsonb_to_recordset(p_answers) AS x(question_id UUID, selected_answer TEXT)
  LOOP
    SELECT ltq.correct_answer INTO v_correct_answer
    FROM level_test_questions ltq
    WHERE ltq.id = v_answer.question_id;

    IF FOUND THEN
      v_total := v_total + 1;
      IF v_correct_answer = v_answer.selected_answer THEN
        v_score := v_score + 1;
      END IF;
    END IF;
  END LOOP;

  -- 레벨 결정
  v_level := determine_level(v_score, v_total);

  -- 결과 저장
  INSERT INTO level_tests (user_id, language, score, total_questions, determined_level, time_taken_seconds, answers)
  VALUES (p_user_id, p_language, v_score, v_total, v_level, p_time_taken_seconds, p_answers)
  RETURNING id INTO v_test_id;

  -- 결과 반환
  RETURN QUERY SELECT
    v_test_id,
    v_score,
    v_total,
    v_level,
    CASE WHEN v_total > 0 THEN (v_score::DECIMAL / v_total) * 100 ELSE 0.00 END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────
-- 함수: 사용자의 최신 레벨 테스트 결과 조회
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_user_level_by_language(
  p_user_id UUID,
  p_language TEXT
)
RETURNS TABLE (
  determined_level TEXT,
  score INTEGER,
  total_questions INTEGER,
  tested_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT lt.determined_level, lt.score, lt.total_questions, lt.created_at
  FROM level_tests lt
  WHERE lt.user_id = p_user_id AND lt.language = p_language
  ORDER BY lt.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────
-- 함수: 온보딩 완료 처리
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION complete_onboarding(
  p_user_id UUID,
  p_experience_level TEXT,
  p_learning_goals TEXT[],
  p_preferred_languages TEXT[],
  p_weekly_time_commitment INTEGER DEFAULT 5
)
RETURNS TABLE (
  success BOOLEAN,
  profile_id UUID,
  error_message TEXT
) AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  -- 기존 프로필 확인 및 업데이트/생성
  INSERT INTO learner_profiles (
    user_id,
    experience_level,
    learning_goals,
    preferred_languages,
    weekly_time_commitment,
    onboarding_completed,
    onboarding_completed_at
  )
  VALUES (
    p_user_id,
    p_experience_level,
    p_learning_goals,
    p_preferred_languages,
    p_weekly_time_commitment,
    TRUE,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    experience_level = EXCLUDED.experience_level,
    learning_goals = EXCLUDED.learning_goals,
    preferred_languages = EXCLUDED.preferred_languages,
    weekly_time_commitment = EXCLUDED.weekly_time_commitment,
    onboarding_completed = TRUE,
    onboarding_completed_at = NOW(),
    updated_at = NOW()
  RETURNING id INTO v_profile_id;

  RETURN QUERY SELECT TRUE, v_profile_id, NULL::TEXT;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────
-- 함수: 레벨 테스트 문제 조회 (랜덤 선택)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_level_test_questions(
  p_language TEXT,
  p_questions_per_level INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  difficulty TEXT,
  question TEXT,
  code_snippet TEXT,
  options JSONB,
  topic TEXT,
  order_index INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH ranked_questions AS (
    SELECT
      ltq.id,
      ltq.difficulty,
      ltq.question,
      ltq.code_snippet,
      ltq.options,
      ltq.topic,
      ltq.order_index,
      ROW_NUMBER() OVER (PARTITION BY ltq.difficulty ORDER BY RANDOM()) as rn
    FROM level_test_questions ltq
    WHERE ltq.language = p_language AND ltq.is_active = TRUE
  )
  SELECT
    rq.id,
    rq.difficulty,
    rq.question,
    rq.code_snippet,
    rq.options,
    rq.topic,
    rq.order_index
  FROM ranked_questions rq
  WHERE rq.rn <= p_questions_per_level
  ORDER BY
    CASE rq.difficulty
      WHEN 'beginner' THEN 1
      WHEN 'intermediate' THEN 2
      WHEN 'advanced' THEN 3
    END,
    rq.order_index,
    RANDOM();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────
-- 기본 레벨 테스트 문제 데이터 (Python)
-- ─────────────────────────────────────────────────────────
INSERT INTO level_test_questions (language, difficulty, question, code_snippet, options, correct_answer, explanation, topic, order_index) VALUES
-- Python Beginner
('python', 'beginner', '다음 코드의 출력 결과는 무엇인가요?', 'print(type(42))',
  '["<class ''int''>", "<class ''str''>", "<class ''float''>", "42"]',
  '<class ''int''>', '42는 정수(int)이므로 type() 함수는 <class ''int''>를 반환합니다.', 'data_types', 1),

('python', 'beginner', '리스트에 요소를 추가하는 메서드는 무엇인가요?', NULL,
  '["append()", "add()", "insert()", "push()"]',
  'append()', 'Python 리스트에서 요소를 끝에 추가할 때는 append() 메서드를 사용합니다.', 'lists', 2),

('python', 'beginner', '다음 중 Python의 주석 표시 방법은?', NULL,
  '["# 주석", "// 주석", "/* 주석 */", "-- 주석"]',
  '# 주석', 'Python에서 한 줄 주석은 # 기호로 시작합니다.', 'syntax', 3),

('python', 'beginner', '문자열을 정수로 변환하는 함수는?', NULL,
  '["int()", "str()", "float()", "num()"]',
  'int()', 'int() 함수는 문자열이나 다른 숫자 타입을 정수로 변환합니다.', 'type_conversion', 4),

('python', 'beginner', '다음 코드의 결과는?', 'len([1, 2, 3, 4, 5])',
  '["5", "4", "6", "오류 발생"]',
  '5', 'len() 함수는 리스트의 요소 개수를 반환합니다. [1, 2, 3, 4, 5]는 5개의 요소를 가지고 있습니다.', 'lists', 5),

-- Python Intermediate
('python', 'intermediate', '다음 코드의 출력 결과는?', '[x**2 for x in range(3)]',
  '["[0, 1, 4]", "[1, 4, 9]", "[0, 1, 2]", "[1, 2, 3]"]',
  '[0, 1, 4]', 'range(3)은 0, 1, 2를 생성하고, 각 값의 제곱은 0, 1, 4입니다.', 'list_comprehension', 1),

('python', 'intermediate', '딕셔너리에서 키가 없을 때 기본값을 반환하는 메서드는?', NULL,
  '["get()", "find()", "search()", "default()"]',
  'get()', 'dict.get(key, default)는 키가 없을 때 KeyError 대신 기본값을 반환합니다.', 'dictionaries', 2),

('python', 'intermediate', '다음 중 불변(immutable) 자료형은?', NULL,
  '["tuple", "list", "dict", "set"]',
  'tuple', '튜플(tuple)은 한 번 생성되면 수정할 수 없는 불변 자료형입니다.', 'data_types', 3),

('python', 'intermediate', '예외 처리에서 finally 블록의 특징은?', NULL,
  '["항상 실행됨", "예외 발생 시에만 실행", "예외가 없을 때만 실행", "선택적으로 실행"]',
  '항상 실행됨', 'finally 블록은 예외 발생 여부와 관계없이 항상 실행됩니다.', 'exception_handling', 4),

('python', 'intermediate', '다음 코드의 출력은?', '"hello".upper().replace("L", "X")',
  '["HEXXO", "hexxo", "HELLO", "hello"]',
  'HEXXO', 'upper()로 대문자 변환 후 "HELLO"에서 "L"을 "X"로 바꾸면 "HEXXO"입니다.', 'strings', 5),

-- Python Advanced
('python', 'advanced', '데코레이터의 주된 용도는?', NULL,
  '["함수 기능 확장", "메모리 절약", "타입 검사", "컴파일 최적화"]',
  '함수 기능 확장', '데코레이터는 기존 함수를 수정하지 않고 기능을 추가하거나 확장하는 데 사용됩니다.', 'decorators', 1),

('python', 'advanced', '제너레이터의 장점은?', NULL,
  '["메모리 효율성", "실행 속도", "코드 가독성", "타입 안전성"]',
  '메모리 효율성', '제너레이터는 값을 한 번에 하나씩 생성하여 메모리를 효율적으로 사용합니다.', 'generators', 2),

('python', 'advanced', 'GIL(Global Interpreter Lock)의 영향을 받는 것은?', NULL,
  '["CPU 바운드 멀티스레딩", "I/O 바운드 작업", "멀티프로세싱", "비동기 프로그래밍"]',
  'CPU 바운드 멀티스레딩', 'GIL은 CPU 바운드 멀티스레딩의 성능을 제한하지만, I/O 바운드나 멀티프로세싱에는 영향이 적습니다.', 'concurrency', 3),

('python', 'advanced', '__slots__를 사용하는 이유는?', NULL,
  '["메모리 절약", "속도 향상", "타입 검사", "캡슐화"]',
  '메모리 절약', '__slots__는 인스턴스가 __dict__를 사용하지 않게 하여 메모리를 절약합니다.', 'oop', 4),

('python', 'advanced', 'asyncio에서 await의 역할은?', NULL,
  '["코루틴 실행 대기", "스레드 생성", "프로세스 종료", "예외 발생"]',
  '코루틴 실행 대기', 'await는 비동기 함수에서 코루틴의 실행을 대기하고 결과를 반환받습니다.', 'async', 5);

-- ─────────────────────────────────────────────────────────
-- 기본 레벨 테스트 문제 데이터 (JavaScript)
-- ─────────────────────────────────────────────────────────
INSERT INTO level_test_questions (language, difficulty, question, code_snippet, options, correct_answer, explanation, topic, order_index) VALUES
-- JavaScript Beginner
('javascript', 'beginner', '변수를 선언하는 키워드가 아닌 것은?', NULL,
  '["var", "let", "const", "int"]',
  'int', 'JavaScript에서 변수 선언은 var, let, const를 사용합니다. int는 다른 언어의 키워드입니다.', 'variables', 1),

('javascript', 'beginner', '다음 코드의 출력 결과는?', 'console.log(typeof [])',
  '["object", "array", "list", "undefined"]',
  'object', 'JavaScript에서 배열은 객체의 일종이므로 typeof는 "object"를 반환합니다.', 'data_types', 2),

('javascript', 'beginner', '문자열 길이를 구하는 속성은?', NULL,
  '["length", "size", "count", "len()"]',
  'length', '문자열의 길이는 length 속성으로 확인합니다. (예: "hello".length)', 'strings', 3),

('javascript', 'beginner', '== 와 === 의 차이점은?', NULL,
  '["타입 비교 여부", "속도 차이", "사용 범위", "문법 차이"]',
  '타입 비교 여부', '===는 값과 타입을 모두 비교하고, ==는 값만 비교합니다 (타입 변환 발생).', 'operators', 4),

('javascript', 'beginner', '배열의 마지막 요소를 제거하는 메서드는?', NULL,
  '["pop()", "shift()", "splice()", "slice()"]',
  'pop()', 'pop()은 배열의 마지막 요소를 제거하고 반환합니다.', 'arrays', 5),

-- JavaScript Intermediate
('javascript', 'intermediate', '클로저(Closure)란?', NULL,
  '["함수와 렉시컬 환경의 조합", "비동기 처리 방식", "객체 생성 패턴", "에러 처리 방법"]',
  '함수와 렉시컬 환경의 조합', '클로저는 함수가 선언될 때의 렉시컬 환경을 기억하는 것입니다.', 'closures', 1),

('javascript', 'intermediate', 'Promise의 세 가지 상태는?', NULL,
  '["pending, fulfilled, rejected", "start, process, end", "open, active, closed", "init, run, done"]',
  'pending, fulfilled, rejected', 'Promise는 대기(pending), 이행(fulfilled), 거부(rejected) 상태를 가집니다.', 'promises', 2),

('javascript', 'intermediate', '다음 코드의 결과는?', '[1, 2, 3].map(x => x * 2)',
  '["[2, 4, 6]", "[1, 2, 3, 1, 2, 3]", "[1, 4, 9]", "[2, 3, 4]"]',
  '[2, 4, 6]', 'map()은 각 요소에 함수를 적용한 새 배열을 반환합니다.', 'array_methods', 3),

('javascript', 'intermediate', 'this 바인딩을 명시적으로 지정하는 메서드는?', NULL,
  '["call, apply, bind", "new, create, make", "get, set, define", "push, pop, shift"]',
  'call, apply, bind', 'call(), apply(), bind()는 함수의 this를 명시적으로 지정합니다.', 'this', 4),

('javascript', 'intermediate', 'spread 연산자(...)의 용도가 아닌 것은?', NULL,
  '["배열 복사", "객체 병합", "함수 정의", "나머지 매개변수"]',
  '함수 정의', 'spread 연산자는 배열/객체 전개, 복사, 병합, rest 파라미터에 사용되지만 함수 정의 자체에는 사용되지 않습니다.', 'spread', 5),

-- JavaScript Advanced
('javascript', 'advanced', 'Event Loop에서 Microtask Queue의 우선순위는?', NULL,
  '["Macrotask보다 높음", "Macrotask보다 낮음", "동일함", "상황에 따라 다름"]',
  'Macrotask보다 높음', 'Microtask(Promise)는 Macrotask(setTimeout)보다 먼저 실행됩니다.', 'event_loop', 1),

('javascript', 'advanced', 'WeakMap과 Map의 주요 차이점은?', NULL,
  '["키의 가비지 컬렉션", "값의 타입", "크기 제한", "순회 가능 여부"]',
  '키의 가비지 컬렉션', 'WeakMap의 키는 약한 참조로, 다른 참조가 없으면 가비지 컬렉션됩니다.', 'collections', 2),

('javascript', 'advanced', 'Proxy 객체의 용도는?', NULL,
  '["객체 작업 가로채기", "비동기 처리", "메모리 관리", "타입 검사"]',
  '객체 작업 가로채기', 'Proxy는 객체의 기본 작업(읽기, 쓰기 등)을 가로채서 커스텀 동작을 정의합니다.', 'proxy', 3),

('javascript', 'advanced', 'Generator 함수의 특징은?', NULL,
  '["실행 중단/재개 가능", "자동 비동기 처리", "메모리 자동 관리", "타입 안전성 보장"]',
  '실행 중단/재개 가능', 'Generator는 yield로 실행을 중단하고 next()로 재개할 수 있습니다.', 'generators', 4),

('javascript', 'advanced', 'Symbol의 주요 사용 사례는?', NULL,
  '["고유 속성 키", "암호화", "타입 정의", "메모리 최적화"]',
  '고유 속성 키', 'Symbol은 충돌 없는 고유한 객체 속성 키를 만드는 데 사용됩니다.', 'symbols', 5);

-- ─────────────────────────────────────────────────────────
-- 코멘트 추가
-- ─────────────────────────────────────────────────────────
COMMENT ON TABLE learner_profiles IS '학습자 온보딩 프로필 정보';
COMMENT ON TABLE level_tests IS '언어별 레벨 테스트 결과';
COMMENT ON TABLE level_test_questions IS '레벨 테스트 문제 풀';
COMMENT ON FUNCTION determine_level IS '점수 기반 레벨 결정 (beginner/intermediate/advanced)';
COMMENT ON FUNCTION submit_level_test IS '레벨 테스트 답안 제출 및 채점';
COMMENT ON FUNCTION complete_onboarding IS '온보딩 완료 처리';
COMMENT ON FUNCTION get_level_test_questions IS '언어별 레벨 테스트 문제 조회 (난이도별 랜덤 선택)';
