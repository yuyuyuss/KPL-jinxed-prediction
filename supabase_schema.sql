-- =============================================================
-- KPL 毒奶预测板 - 数据库建表脚本
-- 说明：直接在 Supabase SQL Editor 中执行即可
-- =============================================================

-- ========== 清理旧表（按依赖顺序删除） ==========
-- 注意：这会删除所有数据，请确认后再执行！
DROP TABLE IF EXISTS predictions CASCADE;
DROP TABLE IF EXISTS danmaku CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS matches CASCADE;

-- 启用 UUID 扩展（如果还没启用的话）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================
-- 1. profiles 表 - 用户资料
-- =============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT NOT NULL,
  room_code TEXT NOT NULL,
  total_points INT DEFAULT 0,
  correct_count INT DEFAULT 0,
  wrong_count INT DEFAULT 0,
  current_streak INT DEFAULT 0,
  title TEXT DEFAULT '🌸 新手预言家',
  created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================
-- 2. matches 表 - 比赛信息
-- =============================================================
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code TEXT NOT NULL,
  team_a TEXT NOT NULL,
  team_b TEXT NOT NULL,
  team_a_emoji TEXT NOT NULL,
  team_b_emoji TEXT NOT NULL,
  status TEXT DEFAULT 'upcoming',
  actual_winner TEXT,
  score_a INT,
  score_b INT,
  start_time TIMESTAMP
);

-- =============================================================
-- 3. predictions 表 - 预测记录
-- =============================================================
CREATE TABLE IF NOT EXISTS predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  predicted_winner TEXT NOT NULL,
  predicted_score_a INT NOT NULL,
  predicted_score_b INT NOT NULL,
  points_earned INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================
-- 4. danmaku 表 - 弹幕消息
-- =============================================================
CREATE TABLE IF NOT EXISTS danmaku (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code TEXT NOT NULL,
  username TEXT NOT NULL,
  message TEXT NOT NULL,
  color TEXT DEFAULT '#ff6b9d',
  created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================
-- 5. 创建索引（提高查询性能）
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_room_code ON profiles(room_code);
CREATE INDEX IF NOT EXISTS idx_predictions_profile_id ON predictions(profile_id);
CREATE INDEX IF NOT EXISTS idx_predictions_match_id ON predictions(match_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_danmaku_room_code ON danmaku(room_code);

-- =============================================================
-- 6. 启用 RLS（行级安全）
-- =============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE danmaku ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- 7. RLS 策略
-- 说明：由于是派对游戏，不需要用户登录认证，
--       所以允许 anon 角色对所有数据进行读写操作。
--       如果后续需要增加认证，可以在这里细化权限。
-- =============================================================

-- profiles 表策略
DROP POLICY IF EXISTS "profiles allow all" ON profiles;
CREATE POLICY "profiles allow all" ON profiles
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- matches 表策略
DROP POLICY IF EXISTS "matches allow all" ON matches;
CREATE POLICY "matches allow all" ON matches
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- predictions 表策略
DROP POLICY IF EXISTS "predictions allow all" ON predictions;
CREATE POLICY "predictions allow all" ON predictions
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- danmaku 表策略
DROP POLICY IF EXISTS "danmaku allow all" ON danmaku;
CREATE POLICY "danmaku allow all" ON danmaku
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- =============================================================
-- 8. Realtime 启用
-- =============================================================
-- 注意：需要在 Supabase 控制台中手动为以下表开启 Realtime：
--   - profiles
--   - matches
--   - danmaku
-- 
-- 操作步骤：
-- 1. 进入 Supabase 控制台 → Database → Replication
-- 2. 点击 "0 tables" 旁边的按钮
-- 3. 勾选上面三个表，点击 Save
-- =============================================================

-- 执行完成！🎉
