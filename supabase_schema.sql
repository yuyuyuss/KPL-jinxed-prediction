-- 创建 profiles 表 - 用户资料
CREATE TABLE profiles (
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

-- 创建 matches 表 - 比赛信息
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- 创建 predictions 表 - 预测记录
CREATE TABLE predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id),
  match_id UUID REFERENCES matches(id),
  predicted_winner TEXT NOT NULL,
  predicted_score_a INT NOT NULL,
  predicted_score_b INT NOT NULL,
  points_earned INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 创建 danmaku 表 - 弹幕消息
CREATE TABLE danmaku (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code TEXT NOT NULL,
  username TEXT NOT NULL,
  message TEXT NOT NULL,
  color TEXT DEFAULT '#ff6b9d',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX idx_profiles_room_code ON profiles(room_code);
CREATE INDEX idx_predictions_profile_id ON predictions(profile_id);
CREATE INDEX idx_predictions_match_id ON predictions(match_id);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_danmaku_room_code ON danmaku(room_code);

-- 启用 Realtime 功能
-- 注意：在 Supabase 控制台中需要手动为这些表启用 Realtime