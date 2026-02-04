-- ─────────────────────────────────────────────────────────
-- 018_content_feedback.sql
-- 콘텐츠 피드백/평가 시스템
-- ─────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────
-- 1. 콘텐츠 평가 테이블
-- ─────────────────────────────────────────────────────────
CREATE TABLE content_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content_id UUID REFERENCES generated_contents(id) ON DELETE CASCADE NOT NULL,

  -- 기본 평가
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5), -- 1-5 별점

  -- 세부 평가 (각 항목 1-5점)
  accuracy_score INTEGER CHECK (accuracy_score >= 1 AND accuracy_score <= 5), -- 내용 정확도
  clarity_score INTEGER CHECK (clarity_score >= 1 AND clarity_score <= 5), -- 설명 명확성
  code_quality_score INTEGER CHECK (code_quality_score >= 1 AND code_quality_score <= 5), -- 코드 품질
  difficulty_match_score INTEGER CHECK (difficulty_match_score >= 1 AND difficulty_match_score <= 5), -- 난이도 적절성

  -- 텍스트 피드백
  feedback_text TEXT,

  -- 유용성 평가
  was_helpful BOOLEAN,
  would_recommend BOOLEAN,

  -- 개선 요청 사항 (다중 선택)
  improvement_requests TEXT[] DEFAULT '{}',

  -- 메타데이터
  feedback_source VARCHAR(50) DEFAULT 'web', -- web, mobile, api

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 사용자당 콘텐츠별 평가는 하나만 (중복 방지)
CREATE UNIQUE INDEX idx_content_ratings_unique
  ON content_ratings(user_id, content_id);

-- 인덱스
CREATE INDEX idx_content_ratings_user_id ON content_ratings(user_id);
CREATE INDEX idx_content_ratings_content_id ON content_ratings(content_id);
CREATE INDEX idx_content_ratings_rating ON content_ratings(rating);
CREATE INDEX idx_content_ratings_created_at ON content_ratings(created_at DESC);
CREATE INDEX idx_content_ratings_helpful ON content_ratings(was_helpful) WHERE was_helpful IS NOT NULL;

-- ─────────────────────────────────────────────────────────
-- 2. 피드백 응답 테이블 (관리자 응답)
-- ─────────────────────────────────────────────────────────
CREATE TABLE feedback_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rating_id UUID REFERENCES content_ratings(id) ON DELETE CASCADE NOT NULL,
  responder_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- 응답한 관리자

  response_text TEXT NOT NULL,
  is_public BOOLEAN DEFAULT TRUE, -- 다른 사용자에게 공개 여부

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_feedback_responses_rating_id ON feedback_responses(rating_id);
CREATE INDEX idx_feedback_responses_responder_id ON feedback_responses(responder_id);

-- ─────────────────────────────────────────────────────────
-- 3. 피드백 신고 테이블 (부적절한 피드백 신고)
-- ─────────────────────────────────────────────────────────
CREATE TABLE feedback_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rating_id UUID REFERENCES content_ratings(id) ON DELETE CASCADE NOT NULL,
  reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  reason VARCHAR(50) NOT NULL CHECK (reason IN (
    'spam', 'inappropriate', 'misleading', 'harassment', 'other'
  )),
  description TEXT,

  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending', 'reviewing', 'resolved', 'dismissed'
  )),

  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  resolution_note TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 중복 신고 방지
CREATE UNIQUE INDEX idx_feedback_reports_unique
  ON feedback_reports(rating_id, reporter_id);

-- 인덱스
CREATE INDEX idx_feedback_reports_status ON feedback_reports(status);
CREATE INDEX idx_feedback_reports_created_at ON feedback_reports(created_at DESC);

-- ─────────────────────────────────────────────────────────
-- 4. RLS 정책
-- ─────────────────────────────────────────────────────────
ALTER TABLE content_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_reports ENABLE ROW LEVEL SECURITY;

-- content_ratings 정책
CREATE POLICY "Users can view all ratings"
  ON content_ratings FOR SELECT
  USING (TRUE); -- 모든 평가는 공개

CREATE POLICY "Users can insert own ratings"
  ON content_ratings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ratings"
  ON content_ratings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own ratings"
  ON content_ratings FOR DELETE
  USING (auth.uid() = user_id);

-- feedback_responses 정책
CREATE POLICY "Users can view public responses"
  ON feedback_responses FOR SELECT
  USING (is_public = TRUE OR auth.uid() = responder_id);

CREATE POLICY "Admins can insert responses"
  ON feedback_responses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update own responses"
  ON feedback_responses FOR UPDATE
  USING (auth.uid() = responder_id);

-- feedback_reports 정책
CREATE POLICY "Users can view own reports"
  ON feedback_reports FOR SELECT
  USING (auth.uid() = reporter_id OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Users can insert reports"
  ON feedback_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Admins can update reports"
  ON feedback_reports FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- ─────────────────────────────────────────────────────────
-- 5. 트리거: updated_at 자동 갱신
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_content_rating_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_content_ratings_updated_at
  BEFORE UPDATE ON content_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_content_rating_updated_at();

CREATE OR REPLACE FUNCTION update_feedback_response_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_feedback_responses_updated_at
  BEFORE UPDATE ON feedback_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_feedback_response_updated_at();

-- ─────────────────────────────────────────────────────────
-- 6. 함수: 평가 추가/수정 (Upsert)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION upsert_content_rating(
  p_user_id UUID,
  p_content_id UUID,
  p_rating INTEGER,
  p_accuracy_score INTEGER DEFAULT NULL,
  p_clarity_score INTEGER DEFAULT NULL,
  p_code_quality_score INTEGER DEFAULT NULL,
  p_difficulty_match_score INTEGER DEFAULT NULL,
  p_feedback_text TEXT DEFAULT NULL,
  p_was_helpful BOOLEAN DEFAULT NULL,
  p_would_recommend BOOLEAN DEFAULT NULL,
  p_improvement_requests TEXT[] DEFAULT '{}'
)
RETURNS TABLE (
  success BOOLEAN,
  rating_id UUID,
  action TEXT,
  error_message TEXT
) AS $$
DECLARE
  v_rating_id UUID;
  v_action TEXT;
BEGIN
  INSERT INTO content_ratings (
    user_id, content_id, rating,
    accuracy_score, clarity_score, code_quality_score, difficulty_match_score,
    feedback_text, was_helpful, would_recommend, improvement_requests
  )
  VALUES (
    p_user_id, p_content_id, p_rating,
    p_accuracy_score, p_clarity_score, p_code_quality_score, p_difficulty_match_score,
    p_feedback_text, p_was_helpful, p_would_recommend, p_improvement_requests
  )
  ON CONFLICT (user_id, content_id) DO UPDATE SET
    rating = EXCLUDED.rating,
    accuracy_score = COALESCE(EXCLUDED.accuracy_score, content_ratings.accuracy_score),
    clarity_score = COALESCE(EXCLUDED.clarity_score, content_ratings.clarity_score),
    code_quality_score = COALESCE(EXCLUDED.code_quality_score, content_ratings.code_quality_score),
    difficulty_match_score = COALESCE(EXCLUDED.difficulty_match_score, content_ratings.difficulty_match_score),
    feedback_text = COALESCE(EXCLUDED.feedback_text, content_ratings.feedback_text),
    was_helpful = COALESCE(EXCLUDED.was_helpful, content_ratings.was_helpful),
    would_recommend = COALESCE(EXCLUDED.would_recommend, content_ratings.would_recommend),
    improvement_requests = CASE
      WHEN EXCLUDED.improvement_requests = '{}' THEN content_ratings.improvement_requests
      ELSE EXCLUDED.improvement_requests
    END,
    updated_at = NOW()
  RETURNING id,
    CASE WHEN xmax = 0 THEN 'created' ELSE 'updated' END
  INTO v_rating_id, v_action;

  RETURN QUERY SELECT TRUE, v_rating_id, v_action, NULL::TEXT;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'error'::TEXT, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────
-- 7. 함수: 콘텐츠별 평가 통계
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_content_rating_stats(
  p_content_id UUID
)
RETURNS TABLE (
  total_ratings BIGINT,
  average_rating NUMERIC(3,2),
  average_accuracy NUMERIC(3,2),
  average_clarity NUMERIC(3,2),
  average_code_quality NUMERIC(3,2),
  average_difficulty_match NUMERIC(3,2),
  helpful_percentage NUMERIC(5,2),
  recommend_percentage NUMERIC(5,2),
  rating_distribution JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT,
    ROUND(AVG(cr.rating)::NUMERIC, 2),
    ROUND(AVG(cr.accuracy_score)::NUMERIC, 2),
    ROUND(AVG(cr.clarity_score)::NUMERIC, 2),
    ROUND(AVG(cr.code_quality_score)::NUMERIC, 2),
    ROUND(AVG(cr.difficulty_match_score)::NUMERIC, 2),
    ROUND(
      (COUNT(*) FILTER (WHERE cr.was_helpful = TRUE)::NUMERIC /
       NULLIF(COUNT(*) FILTER (WHERE cr.was_helpful IS NOT NULL), 0)) * 100, 2
    ),
    ROUND(
      (COUNT(*) FILTER (WHERE cr.would_recommend = TRUE)::NUMERIC /
       NULLIF(COUNT(*) FILTER (WHERE cr.would_recommend IS NOT NULL), 0)) * 100, 2
    ),
    jsonb_build_object(
      '1', COUNT(*) FILTER (WHERE cr.rating = 1),
      '2', COUNT(*) FILTER (WHERE cr.rating = 2),
      '3', COUNT(*) FILTER (WHERE cr.rating = 3),
      '4', COUNT(*) FILTER (WHERE cr.rating = 4),
      '5', COUNT(*) FILTER (WHERE cr.rating = 5)
    )
  FROM content_ratings cr
  WHERE cr.content_id = p_content_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────
-- 8. 함수: 사용자별 평가 목록
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_user_ratings(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  rating_id UUID,
  content_id UUID,
  content_title TEXT,
  content_language TEXT,
  content_topic TEXT,
  rating INTEGER,
  feedback_text TEXT,
  was_helpful BOOLEAN,
  created_at TIMESTAMPTZ,
  has_response BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cr.id,
    cr.content_id,
    gc.title,
    gc.language,
    gc.topic,
    cr.rating,
    cr.feedback_text,
    cr.was_helpful,
    cr.created_at,
    EXISTS (SELECT 1 FROM feedback_responses fr WHERE fr.rating_id = cr.id)
  FROM content_ratings cr
  JOIN generated_contents gc ON cr.content_id = gc.id
  WHERE cr.user_id = p_user_id
  ORDER BY cr.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────
-- 9. 함수: 인기 개선 요청 사항 집계
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_top_improvement_requests(
  p_limit INTEGER DEFAULT 10,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  improvement_request TEXT,
  request_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    unnest(cr.improvement_requests) AS request,
    COUNT(*)::BIGINT AS cnt
  FROM content_ratings cr
  WHERE cr.created_at > NOW() - (p_days || ' days')::INTERVAL
    AND cr.improvement_requests != '{}'
  GROUP BY request
  ORDER BY cnt DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────
-- 10. 함수: 콘텐츠별 평가 목록 조회
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_content_ratings(
  p_content_id UUID,
  p_min_rating INTEGER DEFAULT 1,
  p_with_feedback_only BOOLEAN DEFAULT FALSE,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  rating_id UUID,
  user_id UUID,
  user_name TEXT,
  rating INTEGER,
  accuracy_score INTEGER,
  clarity_score INTEGER,
  code_quality_score INTEGER,
  difficulty_match_score INTEGER,
  feedback_text TEXT,
  was_helpful BOOLEAN,
  improvement_requests TEXT[],
  created_at TIMESTAMPTZ,
  response_text TEXT,
  response_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cr.id,
    cr.user_id,
    p.name,
    cr.rating,
    cr.accuracy_score,
    cr.clarity_score,
    cr.code_quality_score,
    cr.difficulty_match_score,
    cr.feedback_text,
    cr.was_helpful,
    cr.improvement_requests,
    cr.created_at,
    fr.response_text,
    fr.created_at
  FROM content_ratings cr
  JOIN profiles p ON cr.user_id = p.id
  LEFT JOIN feedback_responses fr ON cr.id = fr.rating_id AND fr.is_public = TRUE
  WHERE cr.content_id = p_content_id
    AND cr.rating >= p_min_rating
    AND (p_with_feedback_only = FALSE OR cr.feedback_text IS NOT NULL)
  ORDER BY cr.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────
-- 11. 뷰: 전체 평가 통계 대시보드
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW rating_dashboard_stats AS
SELECT
  COUNT(*)::BIGINT AS total_ratings,
  ROUND(AVG(rating)::NUMERIC, 2) AS overall_average,
  COUNT(*) FILTER (WHERE rating >= 4)::BIGINT AS positive_ratings,
  COUNT(*) FILTER (WHERE rating <= 2)::BIGINT AS negative_ratings,
  COUNT(*) FILTER (WHERE feedback_text IS NOT NULL)::BIGINT AS ratings_with_feedback,
  COUNT(DISTINCT user_id)::BIGINT AS unique_raters,
  COUNT(DISTINCT content_id)::BIGINT AS rated_contents,
  MAX(created_at) AS last_rating_at
FROM content_ratings;

-- ─────────────────────────────────────────────────────────
-- 12. 뷰: 언어별 평가 통계
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW rating_stats_by_language AS
SELECT
  gc.language,
  COUNT(*)::BIGINT AS total_ratings,
  ROUND(AVG(cr.rating)::NUMERIC, 2) AS average_rating,
  ROUND(AVG(cr.accuracy_score)::NUMERIC, 2) AS avg_accuracy,
  ROUND(AVG(cr.clarity_score)::NUMERIC, 2) AS avg_clarity,
  ROUND(AVG(cr.code_quality_score)::NUMERIC, 2) AS avg_code_quality,
  COUNT(*) FILTER (WHERE cr.was_helpful = TRUE)::BIGINT AS helpful_count
FROM content_ratings cr
JOIN generated_contents gc ON cr.content_id = gc.id
GROUP BY gc.language;

-- ─────────────────────────────────────────────────────────
-- 13. 개선 요청 사항 상수
-- ─────────────────────────────────────────────────────────
COMMENT ON TABLE content_ratings IS '콘텐츠 평가 및 피드백';
COMMENT ON TABLE feedback_responses IS '피드백에 대한 관리자 응답';
COMMENT ON TABLE feedback_reports IS '부적절한 피드백 신고';

COMMENT ON COLUMN content_ratings.improvement_requests IS '개선 요청 사항 배열. 가능한 값: more_examples, simpler_explanation, advanced_content, better_code, more_exercises, real_world_examples, video_content, quiz_questions';

COMMENT ON FUNCTION upsert_content_rating IS '평가 추가 또는 수정 (Upsert)';
COMMENT ON FUNCTION get_content_rating_stats IS '콘텐츠별 평가 통계 조회';
COMMENT ON FUNCTION get_user_ratings IS '사용자별 평가 목록 조회';
COMMENT ON FUNCTION get_top_improvement_requests IS '인기 개선 요청 사항 집계';
COMMENT ON FUNCTION get_content_ratings IS '콘텐츠별 평가 목록 조회';
