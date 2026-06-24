// ========== 使用全局变量 ==========
// SUPABASE_URL 和 SUPABASE_KEY 来自 config.js
// supabase 来自 CDN 加载的 @supabase/supabase-js

// 配置检查函数
function checkConfig() {
  console.log('=== 配置检查 ===');
  console.log('SUPABASE_URL:', SUPABASE_URL);
  console.log('SUPABASE_KEY:', SUPABASE_KEY ? '已设置' : '未设置');
  
  const errors = [];
  
  if (typeof SUPABASE_URL === 'undefined') {
    errors.push('SUPABASE_URL 未定义 - 请检查 config.js 是否正确加载');
  } else if (SUPABASE_URL === '{{ SB_URL }}' || SUPABASE_URL === '') {
    errors.push('SUPABASE_URL 是占位符 - 请在 GitHub Secrets 中配置 SB_URL');
  }
  
  if (typeof SUPABASE_KEY === 'undefined') {
    errors.push('SUPABASE_KEY 未定义 - 请检查 config.js 是否正确加载');
  } else if (SUPABASE_KEY === '{{ SB_KEY }}' || SUPABASE_KEY === '') {
    errors.push('SUPABASE_KEY 是占位符 - 请在 GitHub Secrets 中配置 SB_KEY');
  }
  
  if (errors.length > 0) {
    const errorMsg = errors.join('\n');
    console.error('配置错误:\n', errorMsg);
    
    const loginCard = document.querySelector('.login-card');
    if (loginCard) {
      const errorDiv = document.createElement('div');
      errorDiv.style.background = '#ffebee';
      errorDiv.style.color = '#c62828';
      errorDiv.style.padding = '15px';
      errorDiv.style.borderRadius = '15px';
      errorDiv.style.marginBottom = '20px';
      errorDiv.style.fontSize = '0.9rem';
      errorDiv.style.whiteSpace = 'pre-wrap';
      errorDiv.innerHTML = '⚠️ <strong>配置错误</strong>\n' + errorMsg + '\n\n请检查 GitHub Secrets 配置或 config.js 文件';
      loginCard.insertBefore(errorDiv, loginCard.firstChild);
    }
    
    return false;
  }
  
  return true;
}

let supabaseClient = null;

// 注意：不要用 const supabase = ...，因为 supabase 已经由 CDN 定义了
// 我们用 supabaseClient 作为客户端实例
function initSupabase() {
  if (!checkConfig()) {
    return null;
  }
  try {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('Supabase 客户端初始化成功');
    return supabaseClient;
  } catch (e) {
    console.error('Supabase 初始化失败:', e);
    return null;
  }
}

let currentUser = null;
let currentRoom = null;
let currentMatch = null;
let selectedTeam = null;
let selectedScore = null;
let poisonLevel = 0;
let adminClicks = 0;

document.addEventListener('DOMContentLoaded', () => {
  // 页面加载时先初始化 Supabase 并检查配置
  initSupabase();
  setupEventListeners();
});

function setupEventListeners() {
  document.getElementById('join-room').addEventListener('click', joinRoom);
  document.getElementById('create-room').addEventListener('click', createRoom);
  document.getElementById('logout-btn').addEventListener('click', logout);
  document.getElementById('cancel-prediction').addEventListener('click', closePredictionModal);
  document.getElementById('submit-prediction').addEventListener('click', submitPrediction);
  document.getElementById('close-result').addEventListener('click', closeResultModal);
  document.getElementById('release-poison').addEventListener('click', releasePoison);
  document.getElementById('admin-toggle').addEventListener('click', handleAdminToggle);
  document.getElementById('submit-score').addEventListener('click', submitScore);
  
  document.querySelectorAll('.score-btn').forEach(btn => {
    btn.addEventListener('click', selectScore);
  });
  
  document.getElementById('pick-team-a').addEventListener('click', () => selectTeam('A'));
  document.getElementById('pick-team-b').addEventListener('click', () => selectTeam('B'));
}

async function joinRoom() {
  if (!supabaseClient) {
    alert('Supabase 配置错误，请检查配置后再试！');
    return;
  }
  
  const username = document.getElementById('username').value.trim();
  const roomCode = document.getElementById('room-code').value.trim().toUpperCase();
  
  if (!username || !roomCode || roomCode.length !== 4) {
    alert('请输入昵称和4位房间码！');
    return;
  }
  
  const { data: rooms, error } = await supabaseClient
    .from('profiles')
    .select('room_code')
    .eq('room_code', roomCode)
    .limit(1);
  
  if (error) {
    console.error('Error checking room:', error);
    return;
  }
  
  if (rooms.length === 0) {
    alert('房间不存在！请创建新房间或检查房间码。');
    return;
  }
  
  currentRoom = roomCode;
  
  const { data: existingUser, error: userError } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('username', username)
    .eq('room_code', roomCode)
    .limit(1);
  
  if (userError) {
    console.error('Error checking user:', userError);
    return;
  }
  
  if (existingUser.length > 0) {
    currentUser = existingUser[0];
  } else {
    const { data: newUser, error: createError } = await supabaseClient
      .from('profiles')
      .insert({
        username,
        room_code: roomCode,
        total_points: 0,
        correct_count: 0,
        wrong_count: 0,
        current_streak: 0,
        title: '🌸 新手预言家'
      })
      .select();
    
    if (createError) {
      console.error('Error creating user:', createError);
      return;
    }
    currentUser = newUser[0];
  }
  
  await initializeGame();
}

async function createRoom() {
  if (!supabaseClient) {
    alert('Supabase 配置错误，请检查配置后再试！');
    return;
  }
  
  const username = document.getElementById('username').value.trim();
  
  if (!username) {
    alert('请输入你的昵称！');
    return;
  }
  
  const roomCode = generateRoomCode();
  currentRoom = roomCode;
  
  const { data: newUser, error } = await supabaseClient
    .from('profiles')
    .insert({
      username,
      room_code: roomCode,
      total_points: 0,
      correct_count: 0,
      wrong_count: 0,
      current_streak: 0,
      title: '🌸 新手预言家'
    })
    .select();
  
  if (error) {
    console.error('Error creating user:', error);
    return;
  }
  
  currentUser = newUser[0];
  
  await addSampleMatches();
  
  await initializeGame();
}

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function addSampleMatches() {
  const matches = [
    { team_a: '成都AG超玩会', team_b: '重庆狼队', team_a_emoji: '🐯', team_b_emoji: '🐺', status: 'upcoming', start_time: new Date().toISOString() },
    { team_a: '武汉eStarPro', team_b: '北京WB', team_a_emoji: '⭐', team_b_emoji: '🔵', status: 'upcoming', start_time: new Date(Date.now() + 86400000).toISOString() },
    { team_a: 'TES', team_b: 'RNG.M', team_a_emoji: '🦊', team_b_emoji: '🦁', status: 'upcoming', start_time: new Date(Date.now() + 172800000).toISOString() }
  ];
  
  for (const match of matches) {
    await supabaseClient.from('matches').insert(match);
  }
}

async function initializeGame() {
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('game-page').classList.remove('hidden');
  
  document.getElementById('current-room').textContent = currentRoom;
  document.getElementById('current-user').textContent = currentUser.username;
  document.getElementById('user-title').textContent = currentUser.title;
  
  updatePoisonBar();
  await loadMatches();
  await loadLeaderboard();
  setupRealtimeListeners();
}

async function loadMatches() {
  const { data: matches, error } = await supabaseClient
    .from('matches')
    .select('*')
    .order('start_time', { ascending: true });
  
  if (error) {
    console.error('Error loading matches:', error);
    return;
  }
  
  const matchesList = document.getElementById('matches-list');
  matchesList.innerHTML = '';
  
  const matchSelect = document.getElementById('match-select');
  matchSelect.innerHTML = '';
  
  matches.forEach(match => {
    const card = document.createElement('div');
    card.className = 'match-card';
    card.dataset.matchId = match.id;
    
    card.innerHTML = `
      <div class="match-teams">
        <div class="team-info">
          <span class="team-emoji">${match.team_a_emoji}</span>
          <span class="team-name">${match.team_a}</span>
        </div>
        <span class="match-vs">VS</span>
        <div class="team-info">
          <span class="team-emoji">${match.team_b_emoji}</span>
          <span class="team-name">${match.team_b}</span>
        </div>
      </div>
      <div class="match-status ${match.status}">
        ${match.status === 'upcoming' ? '⏰ 即将开始' : `✅ 已结束 ${match.score_a}:${match.score_b}`}
      </div>
    `;
    
    if (match.status === 'upcoming') {
      card.addEventListener('click', () => openPredictionModal(match));
    }
    
    matchesList.appendChild(card);
    
    const option = document.createElement('option');
    option.value = match.id;
    option.textContent = `${match.team_a} vs ${match.team_b}`;
    matchSelect.appendChild(option);
  });
}

function openPredictionModal(match) {
  currentMatch = match;
  
  document.getElementById('modal-match-info').innerHTML = `
    <div class="team-info">
      <span class="team-emoji">${match.team_a_emoji}</span>
      <span class="team-name">${match.team_a}</span>
    </div>
    <span class="match-vs">VS</span>
    <div class="team-info">
      <span class="team-emoji">${match.team_b_emoji}</span>
      <span class="team-name">${match.team_b}</span>
    </div>
  `;
  
  document.getElementById('pick-team-a').innerHTML = `${match.team_a_emoji} ${match.team_a}`;
  document.getElementById('pick-team-b').innerHTML = `${match.team_b_emoji} ${match.team_b}`;
  
  selectedTeam = null;
  selectedScore = null;
  
  document.querySelectorAll('.team-btn').forEach(btn => btn.classList.remove('selected'));
  document.querySelectorAll('.score-btn').forEach(btn => btn.classList.remove('selected'));
  
  document.getElementById('prediction-modal').classList.remove('hidden');
}

function closePredictionModal() {
  document.getElementById('prediction-modal').classList.add('hidden');
  currentMatch = null;
}

function selectTeam(team) {
  selectedTeam = team === 'A' ? currentMatch.team_a : currentMatch.team_b;
  
  document.querySelectorAll('.team-btn').forEach(btn => btn.classList.remove('selected'));
  document.getElementById(`pick-team-${team.toLowerCase()}`).classList.add('selected');
}

function selectScore(event) {
  selectedScore = event.target.dataset.score;
  
  document.querySelectorAll('.score-btn').forEach(btn => btn.classList.remove('selected'));
  event.target.classList.add('selected');
}

async function submitPrediction() {
  if (!selectedTeam || !selectedScore) {
    alert('请选择预测的队伍和比分！');
    return;
  }
  
  const [predictedScoreA, predictedScoreB] = selectedScore.split(':').map(Number);
  
  const { error } = await supabaseClient
    .from('predictions')
    .insert({
      profile_id: currentUser.id,
      match_id: currentMatch.id,
      predicted_winner: selectedTeam,
      predicted_score_a: predictedScoreA,
      predicted_score_b: predictedScoreB,
      points_earned: 0
    });
  
  if (error) {
    console.error('Error submitting prediction:', error);
    alert('提交失败，请重试');
    return;
  }
  
  closePredictionModal();
  showResult('success', '预测成功！等待比赛结果揭晓~ 🎉');
  createFallingEmojis(['🎉', '✨', '🌟'], 10);
}

function showResult(type, message) {
  const modal = document.getElementById('result-modal');
  document.getElementById('result-emoji').textContent = type === 'success' ? '🎉' : '💔';
  document.getElementById('result-title').textContent = type === 'success' ? '预测成功！' : '预测失败';
  document.getElementById('result-message').textContent = message;
  modal.classList.remove('hidden');
}

function closeResultModal() {
  document.getElementById('result-modal').classList.add('hidden');
}

function createFallingEmojis(emojis, count) {
  const container = document.getElementById('falling-container');
  container.classList.remove('hidden');
  
  for (let i = 0; i < count; i++) {
    const emoji = document.createElement('div');
    emoji.className = 'falling-emoji';
    emoji.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    emoji.style.left = `${Math.random() * 100}%`;
    emoji.style.animationDelay = `${Math.random() * 2}s`;
    emoji.style.animationDuration = `${2 + Math.random() * 2}s`;
    emoji.style.fontSize = `${20 + Math.random() * 20}px`;
    container.appendChild(emoji);
  }
  
  setTimeout(() => {
    container.innerHTML = '';
    container.classList.add('hidden');
  }, 4000);
}

async function loadLeaderboard() {
  const { data: profiles, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('room_code', currentRoom)
    .order('total_points', { ascending: false });
  
  if (error) {
    console.error('Error loading leaderboard:', error);
    return;
  }
  
  const leaderboard = document.getElementById('leaderboard');
  leaderboard.innerHTML = '';
  
  profiles.forEach((profile, index) => {
    const item = document.createElement('div');
    item.className = 'leaderboard-item';
    
    const rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : 'other';
    
    item.innerHTML = `
      <div class="rank-badge ${rankClass}">${index + 1}</div>
      <div class="avatar">${profile.username.charAt(0)}</div>
      <div class="user-details">
        <div class="username">${profile.username}</div>
        <div class="title">${profile.title}</div>
      </div>
      <div class="points">${profile.total_points} 分</div>
    `;
    
    leaderboard.appendChild(item);
  });
}

function calculateTitle(correctCount, wrongCount, currentStreak) {
  const total = correctCount + wrongCount;
  const winRate = total > 0 ? correctCount / total : 0;
  
  if (currentStreak >= 6) return '🧙 茅山道士';
  if (currentStreak <= -4) return '🍼 电竞贝利';
  if (currentStreak >= 5) return '👑 人中吕布';
  if (winRate > 0.8 && total >= 3) return '🔮 赛博先知';
  
  if (winRate > 0.7 && total >= 5) return '🌟 神算子';
  if (winRate > 0.6 && total >= 5) return '✨ 预言师';
  if (winRate > 0.5 && total >= 3) return '🌸 占卜师';
  
  return '🌸 新手预言家';
}

function updatePoisonBar() {
  const percent = poisonLevel;
  document.getElementById('poison-percent').textContent = `${percent}%`;
  document.getElementById('poison-fill').style.width = `${percent}%`;
  
  if (percent >= 100) {
    document.getElementById('release-poison').classList.remove('hidden');
  } else {
    document.getElementById('release-poison').classList.add('hidden');
  }
}

async function releasePoison() {
  if (poisonLevel < 100) return;
  
  const targetTeam = Math.random() > 0.5 ? 'A' : 'B';
  
  const danmakuText = `【${currentUser.username}】发动致命毒奶，${targetTeam === 'A' ? 'Team A' : 'Team B'} 队危！💀`;
  
  const { error } = await supabaseClient
    .from('danmaku')
    .insert({
      room_code: currentRoom,
      username: currentUser.username,
      message: danmakuText,
      color: getRandomColor()
    });
  
  if (!error) {
    showDanmaku(danmakuText);
    poisonLevel = 0;
    updatePoisonBar();
  }
}

function getRandomColor() {
  const colors = ['#ff6b9d', '#ff8c42', '#a8d8ea', '#ffd3b6', '#9b59b6', '#4caf50'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function showDanmaku(message) {
  const container = document.getElementById('danmaku-container');
  const item = document.createElement('div');
  item.className = 'danmaku-item';
  item.textContent = message;
  item.style.top = `${10 + Math.random() * 70}%`;
  item.style.color = getRandomColor();
  item.style.animationDuration = `${8 + Math.random() * 4}s`;
  
  container.appendChild(item);
  
  setTimeout(() => {
    item.remove();
  }, 12000);
}

function handleAdminToggle() {
  adminClicks++;
  
  if (adminClicks >= 5) {
    document.getElementById('admin-panel').classList.toggle('hidden');
    adminClicks = 0;
  }
}

async function submitScore() {
  const matchId = document.getElementById('match-select').value;
  const scoreA = parseInt(document.getElementById('score-a').value);
  const scoreB = parseInt(document.getElementById('score-b').value);
  
  if (!matchId || isNaN(scoreA) || isNaN(scoreB)) {
    alert('请填写完整比分！');
    return;
  }
  
  const { data: match, error: matchError } = await supabaseClient
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .limit(1);
  
  if (matchError || match.length === 0) {
    console.error('Error getting match:', matchError);
    return;
  }
  
  const actualMatch = match[0];
  const actualWinner = scoreA > scoreB ? actualMatch.team_a : actualMatch.team_b;
  
  await supabaseClient
    .from('matches')
    .update({
      status: 'completed',
      actual_winner: actualWinner,
      score_a: scoreA,
      score_b: scoreB
    })
    .eq('id', matchId);
  
  const { data: predictions, error: predError } = await supabaseClient
    .from('predictions')
    .select('*')
    .eq('match_id', matchId);
  
  if (predError) {
    console.error('Error getting predictions:', predError);
    return;
  }
  
  for (const pred of predictions) {
    let pointsEarned = 0;
    let isCorrect = false;
    
    if (pred.predicted_winner === actualWinner) {
      pointsEarned += 1;
      isCorrect = true;
      
      if (pred.predicted_score_a === scoreA && pred.predicted_score_b === scoreB) {
        pointsEarned += 2;
      }
    }
    
    await supabaseClient
      .from('predictions')
      .update({ points_earned: pointsEarned })
      .eq('id', pred.id);
    
    const { data: profile, error: profError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', pred.profile_id)
      .limit(1);
    
    if (!profError && profile.length > 0) {
      const p = profile[0];
      const newCorrect = isCorrect ? p.correct_count + 1 : p.correct_count;
      const newWrong = isCorrect ? p.wrong_count : p.wrong_count + 1;
      const newStreak = isCorrect ? p.current_streak + 1 : -1;
      const newPoints = p.total_points + pointsEarned;
      const newTitle = calculateTitle(newCorrect, newWrong, newStreak);
      
      if (!isCorrect) {
        const { data: user, err } = await supabaseClient
          .from('profiles')
          .select('*')
          .eq('id', pred.profile_id)
          .limit(1);
        
        if (!err && user.length > 0 && user[0].id === currentUser.id) {
          poisonLevel = Math.min(100, poisonLevel + 25);
          updatePoisonBar();
        }
      }
      
      if (newStreak >= 6 && p.current_streak < 6) {
        setTimeout(() => {
          document.body.style.background = 'linear-gradient(135deg, #9b59b6 0%, #e91e63 100%)';
          showDanmaku(`【${p.username}】成就达成：茅山道士！🧙‍♂️`);
          createFallingEmojis(['💜', '🔮', '🦇'], 15);
          setTimeout(() => {
            document.body.style.background = 'linear-gradient(135deg, #ffe6f2 0%, #f0e6ff 50%, #e6f2ff 100%)';
          }, 3000);
        }, 500);
      }
      
      await supabaseClient
        .from('profiles')
        .update({
          total_points: newPoints,
          correct_count: newCorrect,
          wrong_count: newWrong,
          current_streak: newStreak,
          title: newTitle
        })
        .eq('id', pred.profile_id);
    }
  }
  
  await loadMatches();
  await loadLeaderboard();
  
  if (currentUser) {
    const { data: user, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .limit(1);
    
    if (!error && user.length > 0) {
      currentUser = user[0];
      document.getElementById('user-title').textContent = currentUser.title;
    }
  }
  
  createFallingEmojis(['🎉', '🏆', '✨'], 15);
}

async function logout() {
  currentUser = null;
  currentRoom = null;
  poisonLevel = 0;
  adminClicks = 0;
  
  document.getElementById('game-page').classList.add('hidden');
  document.getElementById('login-page').classList.remove('hidden');
  
  document.getElementById('username').value = '';
  document.getElementById('room-code').value = '';
  
  document.getElementById('admin-panel').classList.add('hidden');
}

function setupRealtimeListeners() {
  supabaseClient.channel(`room:${currentRoom}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'profiles'
    }, () => {
      loadLeaderboard();
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'profiles'
    }, () => {
      loadLeaderboard();
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'matches'
    }, () => {
      loadMatches();
    })
    .subscribe();
  
  supabaseClient.channel(`danmaku:${currentRoom}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'danmaku'
    }, (payload) => {
      showDanmaku(payload.new.message);
    })
    .subscribe();
}