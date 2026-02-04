-- =====================================================
-- Team API 테이블 생성
-- Team 플랜 사용자를 위한 팀 관리 및 API 기능
-- =====================================================

-- =====================================================
-- 1. profiles 테이블 확장 (팀 관련)
-- =====================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS team_id UUID,
ADD COLUMN IF NOT EXISTS team_role VARCHAR(20) DEFAULT NULL
    CHECK (team_role IS NULL OR team_role IN ('owner', 'admin', 'member'));

-- =====================================================
-- 2. teams 테이블 (팀 정보)
-- =====================================================

CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 팀 정보
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,

    -- 소유자 (Team 플랜 구독자)
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- 제한 설정
    max_members INTEGER DEFAULT 5,

    -- 상태
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_teams_owner_id ON teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_teams_slug ON teams(slug);

-- RLS 활성화
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- RLS 정책
CREATE POLICY "Team members can view their team"
    ON teams FOR SELECT
    USING (
        owner_id = auth.uid() OR
        id IN (SELECT team_id FROM profiles WHERE id = auth.uid())
    );

CREATE POLICY "Team owner can update their team"
    ON teams FOR UPDATE
    USING (owner_id = auth.uid());

CREATE POLICY "Users with Team plan can create teams"
    ON teams FOR INSERT
    WITH CHECK (
        owner_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND plan IN ('team', 'enterprise')
        )
    );

CREATE POLICY "Service role can manage teams"
    ON teams FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- updated_at 트리거
CREATE TRIGGER update_teams_updated_at
    BEFORE UPDATE ON teams
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 3. team_members 테이블 (팀 멤버 관리)
-- =====================================================

CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- 역할
    role VARCHAR(20) NOT NULL DEFAULT 'member'
        CHECK (role IN ('owner', 'admin', 'member')),

    -- 가입 정보
    invited_by UUID REFERENCES profiles(id),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 유니크 제약 (한 사용자는 한 팀에 한 번만)
    UNIQUE (team_id, user_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);

-- RLS 활성화
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- RLS 정책
CREATE POLICY "Team members can view their team members"
    ON team_members FOR SELECT
    USING (
        team_id IN (
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Team admins can manage members"
    ON team_members FOR ALL
    USING (
        team_id IN (
            SELECT team_id FROM team_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Service role can manage team members"
    ON team_members FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- updated_at 트리거
CREATE TRIGGER update_team_members_updated_at
    BEFORE UPDATE ON team_members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 4. team_invitations 테이블 (팀 초대)
-- =====================================================

CREATE TABLE IF NOT EXISTS team_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,

    -- 초대 정보
    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'member'
        CHECK (role IN ('admin', 'member')),

    -- 토큰 (초대 링크용)
    token UUID UNIQUE DEFAULT gen_random_uuid(),

    -- 상태
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),

    -- 초대자
    invited_by UUID NOT NULL REFERENCES profiles(id),

    -- 만료 시간 (7일)
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),

    -- 수락 시간
    accepted_at TIMESTAMP WITH TIME ZONE,
    accepted_by UUID REFERENCES profiles(id),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 동일 팀에 동일 이메일 중복 초대 방지
    UNIQUE (team_id, email, status)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_team_invitations_team_id ON team_invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_status ON team_invitations(status);

-- RLS 활성화
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- RLS 정책
CREATE POLICY "Team admins can view invitations"
    ON team_invitations FOR SELECT
    USING (
        team_id IN (
            SELECT team_id FROM team_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        ) OR
        email = (SELECT email FROM profiles WHERE id = auth.uid())
    );

CREATE POLICY "Team admins can create invitations"
    ON team_invitations FOR INSERT
    WITH CHECK (
        team_id IN (
            SELECT team_id FROM team_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Team admins can update invitations"
    ON team_invitations FOR UPDATE
    USING (
        team_id IN (
            SELECT team_id FROM team_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        ) OR
        email = (SELECT email FROM profiles WHERE id = auth.uid())
    );

CREATE POLICY "Service role can manage invitations"
    ON team_invitations FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- updated_at 트리거
CREATE TRIGGER update_team_invitations_updated_at
    BEFORE UPDATE ON team_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 5. team_api_keys 테이블 (API 키 관리)
-- =====================================================

CREATE TABLE IF NOT EXISTS team_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,

    -- API 키 정보
    name VARCHAR(100) NOT NULL,
    key_prefix VARCHAR(8) NOT NULL, -- 앞 8자만 저장 (UI 표시용)
    key_hash VARCHAR(64) NOT NULL, -- SHA-256 해시

    -- 권한 설정
    permissions JSONB DEFAULT '["content:generate"]'::jsonb,

    -- 사용 제한
    rate_limit_per_minute INTEGER DEFAULT 60,
    daily_limit INTEGER DEFAULT 500, -- Team 플랜 기본값

    -- 통계
    total_requests INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,

    -- 상태
    is_active BOOLEAN DEFAULT TRUE,

    -- 생성자
    created_by UUID NOT NULL REFERENCES profiles(id),

    -- 만료 (없으면 무기한)
    expires_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_team_api_keys_team_id ON team_api_keys(team_id);
CREATE INDEX IF NOT EXISTS idx_team_api_keys_key_hash ON team_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_team_api_keys_is_active ON team_api_keys(is_active);

-- RLS 활성화
ALTER TABLE team_api_keys ENABLE ROW LEVEL SECURITY;

-- RLS 정책
CREATE POLICY "Team admins can view API keys"
    ON team_api_keys FOR SELECT
    USING (
        team_id IN (
            SELECT team_id FROM team_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Team admins can manage API keys"
    ON team_api_keys FOR ALL
    USING (
        team_id IN (
            SELECT team_id FROM team_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Service role can manage API keys"
    ON team_api_keys FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- updated_at 트리거
CREATE TRIGGER update_team_api_keys_updated_at
    BEFORE UPDATE ON team_api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 6. team_api_usage 테이블 (API 사용량 로그)
-- =====================================================

CREATE TABLE IF NOT EXISTS team_api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    api_key_id UUID NOT NULL REFERENCES team_api_keys(id) ON DELETE CASCADE,

    -- 요청 정보
    endpoint VARCHAR(100) NOT NULL,
    method VARCHAR(10) NOT NULL,

    -- 응답 정보
    status_code INTEGER,
    response_time_ms INTEGER,

    -- 메타데이터
    metadata JSONB DEFAULT '{}',

    -- IP 정보 (보안 감사용)
    ip_address INET,
    user_agent TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 (시계열 데이터용)
CREATE INDEX IF NOT EXISTS idx_team_api_usage_team_id ON team_api_usage(team_id);
CREATE INDEX IF NOT EXISTS idx_team_api_usage_api_key_id ON team_api_usage(api_key_id);
CREATE INDEX IF NOT EXISTS idx_team_api_usage_created_at ON team_api_usage(created_at DESC);

-- 파티셔닝 (월별) - 대량 데이터 처리용
-- 실제 환경에서는 파티셔닝 적용 권장

-- RLS 활성화
ALTER TABLE team_api_usage ENABLE ROW LEVEL SECURITY;

-- RLS 정책
CREATE POLICY "Team admins can view API usage"
    ON team_api_usage FOR SELECT
    USING (
        team_id IN (
            SELECT team_id FROM team_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Service role can manage API usage"
    ON team_api_usage FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- 7. 헬퍼 함수들
-- =====================================================

-- 팀 멤버 수 확인 함수
CREATE OR REPLACE FUNCTION get_team_member_count(p_team_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM team_members
        WHERE team_id = p_team_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 팀 멤버 추가 시 제한 확인 트리거
CREATE OR REPLACE FUNCTION check_team_member_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_max_members INTEGER;
    v_current_count INTEGER;
BEGIN
    SELECT max_members INTO v_max_members
    FROM teams WHERE id = NEW.team_id;

    v_current_count := get_team_member_count(NEW.team_id);

    IF v_current_count >= v_max_members THEN
        RAISE EXCEPTION 'Team member limit reached (max: %)', v_max_members;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_team_member_insert
    BEFORE INSERT ON team_members
    FOR EACH ROW
    EXECUTE FUNCTION check_team_member_limit();

-- 팀 멤버 추가 시 profile 업데이트
CREATE OR REPLACE FUNCTION sync_profile_team()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE profiles
        SET team_id = NEW.team_id, team_role = NEW.role
        WHERE id = NEW.user_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE profiles
        SET team_id = NULL, team_role = NULL
        WHERE id = OLD.user_id;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE profiles
        SET team_role = NEW.role
        WHERE id = NEW.user_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER after_team_member_change
    AFTER INSERT OR UPDATE OR DELETE ON team_members
    FOR EACH ROW
    EXECUTE FUNCTION sync_profile_team();

-- API 키 요청 수 업데이트 함수
CREATE OR REPLACE FUNCTION increment_api_key_usage(p_key_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE team_api_keys
    SET
        total_requests = total_requests + 1,
        last_used_at = NOW()
    WHERE id = p_key_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 만료된 초대 자동 처리 함수
CREATE OR REPLACE FUNCTION expire_team_invitations()
RETURNS void AS $$
BEGIN
    UPDATE team_invitations
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'pending' AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 팀 slug 생성 함수
CREATE OR REPLACE FUNCTION generate_team_slug(p_name VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
    v_slug VARCHAR;
    v_count INTEGER := 0;
    v_base_slug VARCHAR;
BEGIN
    -- 기본 slug 생성 (소문자, 공백을 하이픈으로)
    v_base_slug := LOWER(REGEXP_REPLACE(p_name, '[^a-zA-Z0-9가-힣]', '-', 'g'));
    v_base_slug := REGEXP_REPLACE(v_base_slug, '-+', '-', 'g');
    v_base_slug := TRIM(BOTH '-' FROM v_base_slug);

    v_slug := v_base_slug;

    -- 중복 체크 및 숫자 추가
    WHILE EXISTS (SELECT 1 FROM teams WHERE slug = v_slug) LOOP
        v_count := v_count + 1;
        v_slug := v_base_slug || '-' || v_count;
    END LOOP;

    RETURN v_slug;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. Foreign Key 추가 (profiles.team_id)
-- =====================================================

ALTER TABLE profiles
ADD CONSTRAINT fk_profiles_team_id
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;
