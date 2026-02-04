-- =====================================================
-- 관리자 역할 컬럼 추가
-- 시스템 레벨 관리자 권한 관리
-- =====================================================

-- profiles 테이블에 role 컬럼 추가
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin'));

-- 인덱스 생성 (관리자 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role) WHERE role != 'user';

-- 코멘트 추가
COMMENT ON COLUMN profiles.role IS '시스템 역할: user(일반), admin(관리자), super_admin(슈퍼관리자)';

-- 관리자 권한 확인 함수
CREATE OR REPLACE FUNCTION is_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = p_user_id
        AND role IN ('admin', 'super_admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_admin IS '사용자가 관리자 권한을 가지고 있는지 확인';
