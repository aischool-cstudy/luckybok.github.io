-- =====================================================
-- generated_contents 테이블 생성
-- AI로 생성된 교육 콘텐츠 저장
-- =====================================================

CREATE TABLE IF NOT EXISTS generated_contents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- 콘텐츠 메타데이터
    language VARCHAR(20) NOT NULL CHECK (language IN ('python', 'javascript', 'sql', 'java', 'typescript', 'go')),
    topic VARCHAR(200) NOT NULL,
    difficulty VARCHAR(20) NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    target_audience VARCHAR(50) NOT NULL CHECK (target_audience IN ('non_tech', 'junior_dev', 'manager', 'career_changer')),

    -- 생성된 콘텐츠
    title VARCHAR(300),
    content TEXT NOT NULL,
    code_examples JSONB,                     -- 코드 예제들
    quiz JSONB,                              -- 퀴즈 문제들

    -- AI 메타데이터
    model_used VARCHAR(100),                 -- claude-sonnet-4, gpt-4o 등
    tokens_used INTEGER,
    generation_time_ms INTEGER,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_generated_contents_user ON generated_contents(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_contents_language ON generated_contents(language);
CREATE INDEX IF NOT EXISTS idx_generated_contents_created ON generated_contents(created_at DESC);

-- RLS 활성화
ALTER TABLE generated_contents ENABLE ROW LEVEL SECURITY;

-- RLS 정책
CREATE POLICY "Users can view own contents"
    ON generated_contents FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own contents"
    ON generated_contents FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own contents"
    ON generated_contents FOR DELETE
    USING (auth.uid() = user_id);
