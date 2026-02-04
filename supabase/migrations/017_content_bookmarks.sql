-- ─────────────────────────────────────────────────────────
-- 017_content_bookmarks.sql
-- 콘텐츠 북마크/즐겨찾기 시스템
-- ─────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────
-- 1. 북마크 폴더 테이블
-- ─────────────────────────────────────────────────────────
CREATE TABLE bookmark_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#6366f1', -- HEX 색상 코드
  icon VARCHAR(50) DEFAULT 'folder', -- 아이콘 이름
  parent_id UUID REFERENCES bookmark_folders(id) ON DELETE CASCADE, -- 중첩 폴더 지원
  order_index INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT FALSE, -- 기본 폴더 여부 (삭제 불가)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 사용자별 폴더명 중복 방지 (같은 부모 폴더 내)
CREATE UNIQUE INDEX idx_bookmark_folders_unique_name
  ON bookmark_folders(user_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::UUID), name);

-- 사용자별 기본 폴더는 하나만 존재
CREATE UNIQUE INDEX idx_bookmark_folders_default
  ON bookmark_folders(user_id) WHERE is_default = TRUE;

-- 인덱스
CREATE INDEX idx_bookmark_folders_user_id ON bookmark_folders(user_id);
CREATE INDEX idx_bookmark_folders_parent_id ON bookmark_folders(parent_id);
CREATE INDEX idx_bookmark_folders_order ON bookmark_folders(user_id, order_index);

-- ─────────────────────────────────────────────────────────
-- 2. 콘텐츠 북마크 테이블
-- ─────────────────────────────────────────────────────────
CREATE TABLE content_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content_id UUID REFERENCES generated_contents(id) ON DELETE CASCADE NOT NULL,
  folder_id UUID REFERENCES bookmark_folders(id) ON DELETE SET NULL, -- 폴더 삭제 시 미분류로
  note TEXT, -- 사용자 메모
  tags TEXT[] DEFAULT '{}', -- 태그
  is_favorite BOOLEAN DEFAULT FALSE, -- 즐겨찾기 (빠른 접근)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 동일 콘텐츠 중복 북마크 방지
CREATE UNIQUE INDEX idx_content_bookmarks_unique
  ON content_bookmarks(user_id, content_id);

-- 인덱스
CREATE INDEX idx_content_bookmarks_user_id ON content_bookmarks(user_id);
CREATE INDEX idx_content_bookmarks_folder_id ON content_bookmarks(folder_id);
CREATE INDEX idx_content_bookmarks_content_id ON content_bookmarks(content_id);
CREATE INDEX idx_content_bookmarks_favorite ON content_bookmarks(user_id, is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX idx_content_bookmarks_created_at ON content_bookmarks(user_id, created_at DESC);
CREATE INDEX idx_content_bookmarks_tags ON content_bookmarks USING GIN(tags);

-- ─────────────────────────────────────────────────────────
-- 3. RLS 정책
-- ─────────────────────────────────────────────────────────
ALTER TABLE bookmark_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_bookmarks ENABLE ROW LEVEL SECURITY;

-- bookmark_folders 정책
CREATE POLICY "Users can view own bookmark folders"
  ON bookmark_folders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bookmark folders"
  ON bookmark_folders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bookmark folders"
  ON bookmark_folders FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookmark folders"
  ON bookmark_folders FOR DELETE
  USING (auth.uid() = user_id AND is_default = FALSE);

-- content_bookmarks 정책
CREATE POLICY "Users can view own bookmarks"
  ON content_bookmarks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bookmarks"
  ON content_bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bookmarks"
  ON content_bookmarks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookmarks"
  ON content_bookmarks FOR DELETE
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────
-- 4. 트리거: updated_at 자동 갱신
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_bookmark_folder_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bookmark_folders_updated_at
  BEFORE UPDATE ON bookmark_folders
  FOR EACH ROW
  EXECUTE FUNCTION update_bookmark_folder_updated_at();

CREATE OR REPLACE FUNCTION update_content_bookmark_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_content_bookmarks_updated_at
  BEFORE UPDATE ON content_bookmarks
  FOR EACH ROW
  EXECUTE FUNCTION update_content_bookmark_updated_at();

-- ─────────────────────────────────────────────────────────
-- 5. 함수: 기본 폴더 자동 생성
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_default_bookmark_folder()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO bookmark_folders (user_id, name, description, is_default, icon)
  VALUES (NEW.id, '전체 북마크', '기본 북마크 폴더입니다.', TRUE, 'bookmark')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 새 사용자 가입 시 기본 폴더 생성
CREATE TRIGGER trigger_create_default_bookmark_folder
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_default_bookmark_folder();

-- ─────────────────────────────────────────────────────────
-- 6. 함수: 북마크 토글
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION toggle_bookmark(
  p_user_id UUID,
  p_content_id UUID,
  p_folder_id UUID DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  action TEXT,
  bookmark_id UUID,
  error_message TEXT
) AS $$
DECLARE
  v_existing_id UUID;
  v_new_id UUID;
  v_default_folder_id UUID;
BEGIN
  -- 기존 북마크 확인
  SELECT id INTO v_existing_id
  FROM content_bookmarks
  WHERE user_id = p_user_id AND content_id = p_content_id;

  IF v_existing_id IS NOT NULL THEN
    -- 북마크 삭제
    DELETE FROM content_bookmarks WHERE id = v_existing_id;
    RETURN QUERY SELECT TRUE, 'removed'::TEXT, v_existing_id, NULL::TEXT;
  ELSE
    -- 폴더 ID가 없으면 기본 폴더 사용
    IF p_folder_id IS NULL THEN
      SELECT id INTO v_default_folder_id
      FROM bookmark_folders
      WHERE user_id = p_user_id AND is_default = TRUE;

      p_folder_id := v_default_folder_id;
    END IF;

    -- 북마크 추가
    INSERT INTO content_bookmarks (user_id, content_id, folder_id)
    VALUES (p_user_id, p_content_id, p_folder_id)
    RETURNING id INTO v_new_id;

    RETURN QUERY SELECT TRUE, 'added'::TEXT, v_new_id, NULL::TEXT;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, 'error'::TEXT, NULL::UUID, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────
-- 7. 함수: 북마크 폴더 이동
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION move_bookmark_to_folder(
  p_bookmark_id UUID,
  p_user_id UUID,
  p_new_folder_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  error_message TEXT
) AS $$
BEGIN
  -- 북마크 소유권 확인 및 이동
  UPDATE content_bookmarks
  SET folder_id = p_new_folder_id, updated_at = NOW()
  WHERE id = p_bookmark_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, '북마크를 찾을 수 없거나 권한이 없습니다.'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, NULL::TEXT;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────
-- 8. 함수: 폴더별 북마크 수 조회
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_bookmark_folder_stats(
  p_user_id UUID
)
RETURNS TABLE (
  folder_id UUID,
  folder_name VARCHAR(100),
  bookmark_count BIGINT,
  favorite_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    bf.id,
    bf.name,
    COUNT(cb.id)::BIGINT,
    COUNT(cb.id) FILTER (WHERE cb.is_favorite = TRUE)::BIGINT
  FROM bookmark_folders bf
  LEFT JOIN content_bookmarks cb ON bf.id = cb.folder_id
  WHERE bf.user_id = p_user_id
  GROUP BY bf.id, bf.name
  ORDER BY bf.order_index, bf.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────
-- 9. 함수: 북마크 검색 (태그, 메모 포함)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION search_bookmarks(
  p_user_id UUID,
  p_query TEXT DEFAULT NULL,
  p_folder_id UUID DEFAULT NULL,
  p_tags TEXT[] DEFAULT NULL,
  p_favorites_only BOOLEAN DEFAULT FALSE,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  bookmark_id UUID,
  content_id UUID,
  content_title TEXT,
  content_language TEXT,
  content_topic TEXT,
  folder_id UUID,
  folder_name VARCHAR(100),
  note TEXT,
  tags TEXT[],
  is_favorite BOOLEAN,
  bookmarked_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cb.id,
    cb.content_id,
    gc.title,
    gc.language,
    gc.topic,
    cb.folder_id,
    bf.name,
    cb.note,
    cb.tags,
    cb.is_favorite,
    cb.created_at
  FROM content_bookmarks cb
  JOIN generated_contents gc ON cb.content_id = gc.id
  LEFT JOIN bookmark_folders bf ON cb.folder_id = bf.id
  WHERE cb.user_id = p_user_id
    AND (p_folder_id IS NULL OR cb.folder_id = p_folder_id)
    AND (p_favorites_only = FALSE OR cb.is_favorite = TRUE)
    AND (p_tags IS NULL OR cb.tags && p_tags) -- 배열 겹침 연산자
    AND (
      p_query IS NULL
      OR gc.title ILIKE '%' || p_query || '%'
      OR gc.topic ILIKE '%' || p_query || '%'
      OR cb.note ILIKE '%' || p_query || '%'
    )
  ORDER BY cb.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────
-- 10. 뷰: 북마크 통계
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW bookmark_stats AS
SELECT
  cb.user_id,
  COUNT(cb.id) AS total_bookmarks,
  COUNT(cb.id) FILTER (WHERE cb.is_favorite = TRUE) AS favorite_count,
  COUNT(DISTINCT cb.folder_id) AS folders_used,
  COUNT(DISTINCT unnest(cb.tags)) AS unique_tags,
  MAX(cb.created_at) AS last_bookmarked_at
FROM content_bookmarks cb
GROUP BY cb.user_id;

-- ─────────────────────────────────────────────────────────
-- 11. 코멘트
-- ─────────────────────────────────────────────────────────
COMMENT ON TABLE bookmark_folders IS '북마크 폴더 (중첩 폴더 지원)';
COMMENT ON TABLE content_bookmarks IS '콘텐츠 북마크/즐겨찾기';
COMMENT ON FUNCTION toggle_bookmark IS '북마크 추가/제거 토글';
COMMENT ON FUNCTION move_bookmark_to_folder IS '북마크를 다른 폴더로 이동';
COMMENT ON FUNCTION get_bookmark_folder_stats IS '폴더별 북마크 수 통계';
COMMENT ON FUNCTION search_bookmarks IS '북마크 검색 (태그, 메모, 제목 포함)';
