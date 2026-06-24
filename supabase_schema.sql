-- =============================================================
-- KPL 毒奶预测板 - 数据库建表脚本
-- 说明：直接在 Supabase SQL Editor 中执行即可
-- =============================================================

-- ========== 清理旧表（按依赖顺序删除） ==========
DROP TABLE IF EXISTS predictions CASCADE;
DROP TABLE IF EXISTS danmaku CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================
-- 1. rooms 表 - 房间信息
-- =============================================================
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code TEXT UNIQUE NOT NULL,
  owner_id UUID,
  name TEXT DEFAULT '毒奶预测局',
  created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================
-- 2. profiles 表 - 用户资料
-- =============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT NOT NULL,
  room_code TEXT NOT NULL,
  total_points INT DEFAULT 0,
  correct_count INT DEFAULT 0,
  wrong_count INT DEFAULT 0,
  current_streak INT DEFAULT 0,
  title TEXT DEFAULT '🌸 新手预言家',
  is_owner BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_profiles_room_code ON profiles(room_code);

-- =============================================================
-- 3. matches 表 - 比赛信息
-- =============================================================
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code TEXT NOT NULL,
  team_a_name TEXT NOT NULL,
  team_a_emoji TEXT DEFAULT '🎮',
  team_b_name TEXT NOT NULL,
  team_b_emoji TEXT DEFAULT '🎮',
  best_of INT DEFAULT 7,
  status TEXT DEFAULT 'upcoming',
  actual_winner TEXT,
  score_a INT DEFAULT 0,
  score_b INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_matches_room_code ON matches(room_code);

-- =============================================================
-- 4. predictions 表 - 预测记录
-- =============================================================
CREATE TABLE predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  room_code TEXT NOT NULL,
  predicted_winner TEXT NOT NULL,
  predicted_score_a INT NOT NULL,
  predicted_score_b INT NOT NULL,
  points_earned INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_predictions_match_id ON predictions(match_id);
CREATE INDEX idx_predictions_profile_id ON predictions(profile_id);
CREATE INDEX idx_predictions_room_code ON predictions(room_code);

-- =============================================================
-- 5. danmaku 表 - 弹幕/聊天消息
-- =============================================================
CREATE TABLE danmaku (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code TEXT NOT NULL,
  username TEXT NOT NULL,
  message TEXT NOT NULL,
  color TEXT DEFAULT '#ff6b9d',
  type TEXT DEFAULT 'chat',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_danmaku_room_code ON danmaku(room_code);

-- =============================================================
-- 6. 启用 RLS（行级安全）
-- =============================================================
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE danmaku ENABLE ROW LEVEL SECURITY;

-- ========== RLS 策略（匿名可读写，因为是派对游戏） ==========

DROP POLICY IF EXISTS "rooms allow all" ON rooms;
CREATE POLICY "rooms allow all" ON rooms
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "profiles allow all" ON profiles;
CREATE POLICY "profiles allow all" ON profiles
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "matches allow all" ON matches;
CREATE POLICY "matches allow all" ON matches
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "predictions allow all" ON predictions;
CREATE POLICY "predictions allow all" ON predictions
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "danmaku allow all" ON danmaku;
CREATE POLICY "danmaku allow all" ON danmaku
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- =============================================================
-- 7. Realtime 启用
-- =============================================================
-- 需要在 Supabase 控制台手动开启以下表的 Realtime：
--   - profiles  (排行榜更新)
--   - matches   (比赛状态更新)
--   - danmaku   (弹幕实时推送)
--
-- 操作：Database → Replication → 勾选表 → Save
-- =============================================================

-- 执行完成！🎉