// ========== 全局变量 ==========
let supabaseClient = null;
let currentUser = null;
let currentRoom = null;
let currentMatch = null;
let selectedTeam = null;
let selectedScore = null;
let poisonLevel = 0;
let adminClicks = 0;
let myPredictions = {};

// ========== 配置检查 ==========
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

function initSupabase() {
  if (!checkConfig()) return null;
  try {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('Supabase 客户端初始化成功');
    return supabaseClient;
  } catch (e) {
    console.error('Supabase 初始化失败:', e);
    return null;
  }
}

// ========== Toast 提示系统 ==========
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container') || createToastContainer();
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: '💡'
  };
  
  toast.innerHTML = `<span class="toast-icon">${icons[type] || '💬'}</span><span>${message}</span>`;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'toast-out 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'toast-container';
  container.className = 'toast-container';
  document.body.appendChild(container);
  return container;
}

// ========== Loading 状态 ==========
function showLoading(btn, text = '加载中...') {
  if (!btn) return;
  btn.dataset.originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = text;
  btn.style.opacity = '0.7';
  btn.style.cursor = 'not-allowed';
}

function hideLoading(btn) {
  if (!btn) return;
  btn.disabled = false;
  btn.textContent = btn.dataset.originalText || btn.textContent;
  btn.style.opacity = '1';
  btn.style.cursor = 'pointer';
}

// ========== 页面初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
  initSupabase();
  setupEventListeners();
  
  const savedUser = localStorage.getItem('kpl_user');
  const savedRoom = localStorage.getItem('kpl_room');
  if (savedUser && savedRoom) {
    document.getElementById('username').value = savedUser;
    document.getElementById('room-code').value = savedRoom;
  }
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
  
  document.getElementById('username').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('room-code').focus();
  });
  
  document.getElementById('room-code').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinRoom();
  });
  
  document.getElementById('room-code').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
  });
  
  document.getElementById('copy-room-btn').addEventListener('click', copyRoomCode);
}

// ========== 加入房间 ==========
async function joinRoom() {
  if (!supabaseClient) {
    showToast('Supabase 配置错误', 'error');
    return;
  }
  
  const username = document.getElementById('username').value.trim();
  const roomCode = document.getElementById('room-code').value.trim().toUpperCase();
  const btn = document.getElementById('join-room');
  
  if (!username) {
    showToast('请输入你的昵称~', 'warning');
    return;
  }
  if (!roomCode || roomCode.length !== 4) {
    showToast('请输入4位房间码', 'warning');
    return;
  }
  
  showLoading(btn, '加入中...');
  
  try {
    const { data: rooms, error } = await supabaseClient
      .from('profiles')
      .select('room_code')
      .eq('room_code', roomCode)
      .limit(1);
    
    if (error) throw error;
    
    if (rooms.length === 0) {
      showToast('房间不存在，换个房间码试试？', 'warning');
      hideLoading(btn);
      return;
    }
    
    currentRoom = roomCode;
    
    const { data: existingUser, error: userError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('username', username)
      .eq('room_code', roomCode)
      .limit(1);
    
    if (userError) throw userError;
    
    if (existingUser.length > 0) {
      currentUser = existingUser[0];
      showToast(`欢迎回来，${username}！`, 'success');
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
      
      if (createError) throw createError;
      currentUser = newUser[0];
      showToast(`欢迎加入，${username}！`, 'success');
    }
    
    localStorage.setItem('kpl_user', username);
    localStorage.setItem('kpl_room', roomCode);
    
    await initializeGame();
  } catch (e) {
    console.error(e);
    showToast('操作失败，请重试', 'error');
  } finally {
    hideLoading(btn);
  }
}

// ========== 创建房间 ==========
async function createRoom() {
  if (!supabaseClient) {
    showToast('Supabase 配置错误', 'error');
    return;
  }
  
  const username = document.getElementById('username').value.trim();
  const btn = document.getElementById('create-room');
  
  if (!username) {
    showToast('请输入你的昵称~', 'warning');
    return;
  }
  
  showLoading(btn, '创建中...');
  
  try {
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
    
    if (error) throw error;
    currentUser = newUser[0];
    
    await addSampleMatches(roomCode);
    
    localStorage.setItem('kpl_user', username);
    localStorage.setItem('kpl_room', roomCode);
    
    showToast(`房间创建成功！房间码：${roomCode}`, 'success');
    await initializeGame();
  } catch (e) {
    console.error(e);
    showToast('创建失败，请重试', 'error');
  } finally {
    hideLoading(btn);
  }
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function addSampleMatches(roomCode) {
  const matches = [
    { room_code: roomCode, team_a: '成都AG超玩会', team_b: '重庆狼队', team_a_emoji: '🐯', team_b_emoji: '🐺', status: 'upcoming', start_time: new Date().toISOString() },
    { room_code: roomCode, team_a: '武汉eStarPro', team_b: '北京WB', team_a_emoji: '⭐', team_b_emoji: '🔵', status: 'upcoming', start_time: new Date(Date.now() + 86400000).toISOString() },
    { room_code: roomCode, team_a: 'TES', team_b: 'RNG.M', team_a_emoji: '🦊', team_b_emoji: '🦁', status: 'upcoming', start_time: new Date(Date.now() + 172800000).toISOString() }
  ];
  
  for (const match of matches) {
    await supabaseClient.from('matches').insert(match);
  }
}

// ========== 复制房间码 ==========
function copyRoomCode() {
  navigator.clipboard.writeText(currentRoom).then(() => {
    showToast('房间码已复制！', 'success');
  }).catch(() => {
    showToast('复制失败，手动复制吧~', 'warning');
  });
}

// ========== 初始化游戏 ==========
async function initializeGame() {
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('game-page').classList.remove('hidden');
  
  document.getElementById('current-room').textContent = currentRoom;
  document.getElementById('current-user').textContent = currentUser.username;
  document.getElementById('user-title').textContent = currentUser.title;
  
  updatePoisonBar();
  await loadMyPredictions();
  await loadMatches();
  await loadLeaderboard();
  setupRealtimeListeners();
}

// ========== 加载我的预测 ==========
async function loadMyPredictions() {
  if (!currentUser) return;
  
  const { data, error } = await supabaseClient
    .from('predictions')
    .select('match_id, predicted_winner, predicted_score_a, predicted_score_b, points_earned')
    .eq('profile_id', currentUser.id);
  
  if (error) {
    console.error('加载预测失败:', error);
    return;
  }
  
  myPredictions = {};
  data.forEach(p => {
    myPredictions[p.match_id] = p;
  });
}

// ========== 加载比赛列表 ==========
async function loadMatches() {
  if (!supabaseClient) return;
  
  const matchesList = document.getElementById('matches-list');
  matchesList.innerHTML = '<div class="loading">🍩 加载中...</div>';
  
  try {
    const { data: matches, error } = await supabaseClient
      .from('matches')
      .select('*')
      .eq('room_code', currentRoom)
      .order('start_time', { ascending: true });
    
    if (error) throw error;
    
    matchesList.innerHTML = '';
    
    if (matches.length === 0) {
      matchesList.innerHTML = '<div class="empty-state">🎈 暂无比赛，稍后再来看看~</div>';
      return;
    }
    
    const matchSelect = document.getElementById('match-select');
    matchSelect.innerHTML = '';
    
    matches.forEach(match => {
      const card = document.createElement('div');
      card.className = 'match-card';
      card.dataset.matchId = match.id;
      
      const myPred = myPredictions[match.id];
      let predInfo = '';
      if (myPred && match.status === 'upcoming') {
        predInfo = `<div class="my-pred">💭 已预测：${myPred.predicted_winner} ${myPred.predicted_score_a}:${myPred.predicted_score_b}</div>`;
      } else if (myPred && match.status === 'completed') {
        const won = myPred.points_earned > 0;
        predInfo = `<div class="my-pred ${won ? 'pred-correct' : 'pred-wrong'}">
          ${won ? '✅' : '❌'} ${myPred.predicted_winner} ${myPred.predicted_score_a}:${myPred.predicted_score_b} (+${myPred.points_earned}分)
        </div>`;
      }
      
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
        <div class="match-footer">
          <span class="match-status ${match.status}">
            ${match.status === 'upcoming' ? '⏰ 即将开始' : `✅ 已结束 ${match.score_a}:${match.score_b}`}
          </span>
          ${match.status === 'upcoming' && !myPred ? '<span class="predict-hint">点我预测 →</span>' : ''}
        </div>
        ${predInfo}
      `;
      
      if (match.status === 'upcoming' && !myPred) {
        card.addEventListener('click', () => openPredictionModal(match));
      }
      
      matchesList.appendChild(card);
      
      const option = document.createElement('option');
      option.value = match.id;
      option.textContent = `${match.team_a} vs ${match.team_b}`;
      matchSelect.appendChild(option);
    });
  } catch (e) {
    console.error(e);
    matchesList.innerHTML = '<div class="empty-state">😢 加载失败，刷新试试？</div>';
  }
}

// ========== 预测弹窗 ==========
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
  document.querySelectorAll('.score-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.style.display = '';
  });
  
  document.getElementById('submit-prediction').disabled = true;
  document.getElementById('submit-prediction').style.opacity = '0.5';
  
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
  
  document.querySelectorAll('.score-btn').forEach(btn => {
    const score = btn.dataset.score;
    const [a, b] = score.split(':').map(Number);
    const winnerIsA = a > b;
    
    if ((team === 'A' && winnerIsA) || (team === 'B' && !winnerIsA)) {
      btn.style.display = '';
    } else {
      btn.style.display = 'none';
      btn.classList.remove('selected');
    }
  });
  
  selectedScore = null;
  checkCanSubmit();
}

function selectScore(event) {
  selectedScore = event.target.dataset.score;
  
  document.querySelectorAll('.score-btn').forEach(btn => btn.classList.remove('selected'));
  event.target.classList.add('selected');
  checkCanSubmit();
}

function checkCanSubmit() {
  const btn = document.getElementById('submit-prediction');
  if (selectedTeam && selectedScore) {
    btn.disabled = false;
    btn.style.opacity = '1';
  } else {
    btn.disabled = true;
    btn.style.opacity = '0.5';
  }
}

async function submitPrediction() {
  if (!selectedTeam || !selectedScore || !currentUser) return;
  
  const btn = document.getElementById('submit-prediction');
  showLoading(btn, '提交中...');
  
  try {
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
    
    if (error) throw error;
    
    closePredictionModal();
    showToast('预测成功！静候结果~ 🎉', 'success');
    createFallingEmojis(['🎉', '✨', '🌟'], 10);
    
    await loadMyPredictions();
    await loadMatches();
  } catch (e) {
    console.error(e);
    showToast('提交失败，请重试', 'error');
  } finally {
    hideLoading(btn);
  }
}

// ========== 结果弹窗 ==========
function showResult(type, message) {
  const modal = document.getElementById('result-modal');
  document.getElementById('result-emoji').textContent = type === 'success' ? '🎉' : '💔';
  document.getElementById('result-title').textContent = type === 'success' ? '太棒了！' : '哎呀~';
  document.getElementById('result-message').textContent = message;
  modal.classList.remove('hidden');
}

function closeResultModal() {
  document.getElementById('result-modal').classList.add('hidden');
}

// ========== 飘落表情 ==========
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

// ========== 排行榜 ==========
async function loadLeaderboard() {
  if (!supabaseClient) return;
  
  try {
    const { data: profiles, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('room_code', currentRoom)
      .order('total_points', { ascending: false });
    
    if (error) throw error;
    
    const leaderboard = document.getElementById('leaderboard');
    leaderboard.innerHTML = '';
    
    if (profiles.length === 0) {
      leaderboard.innerHTML = '<div class="empty-state">还没有人加入呢~</div>';
      return;
    }
    
    profiles.forEach((profile, index) => {
      const item = document.createElement('div');
      item.className = 'leaderboard-item';
      if (profile.id === currentUser?.id) item.classList.add('me');
      
      const rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : 'other';
      const total = profile.correct_count + profile.wrong_count;
      const winRate = total > 0 ? Math.round(profile.correct_count / total * 100) : 0;
      
      const streakText = profile.current_streak > 0 
        ? `🔥 ${profile.current_streak}连胜` 
        : profile.current_streak < 0 
          ? `💧 ${Math.abs(profile.current_streak)}连败` 
          : '';
      
      item.innerHTML = `
        <div class="rank-badge ${rankClass}">${index + 1}</div>
        <div class="avatar">${profile.username.charAt(0)}</div>
        <div class="user-details">
          <div class="username-row">
            <span class="username">${profile.username}</span>
            ${profile.id === currentUser?.id ? '<span class="me-tag">我</span>' : ''}
          </div>
          <div class="stats-row">
            <span class="title">${profile.title}</span>
            <span class="win-rate">胜率 ${winRate}%</span>
          </div>
          ${streakText ? `<div class="streak-row">${streakText}</div>` : ''}
        </div>
        <div class="points">${profile.total_points} <small>分</small></div>
      `;
      
      leaderboard.appendChild(item);
    });
  } catch (e) {
    console.error(e);
  }
}

// ========== 头衔计算 ==========
function calculateTitle(correctCount, wrongCount, currentStreak) {
  const total = correctCount + wrongCount;
  const winRate = total > 0 ? correctCount / total : 0;
  
  if (currentStreak <= -6) return '🧙 茅山道士';
  if (currentStreak <= -4) return '🍼 电竞贝利';
  if (currentStreak >= 5) return '👑 人中吕布';
  if (winRate > 0.8 && total >= 3) return '🔮 赛博先知';
  
  if (winRate > 0.7 && total >= 5) return '🌟 神算子';
  if (winRate > 0.6 && total >= 5) return '✨ 预言师';
  if (winRate > 0.5 && total >= 3) return '🌸 占卜师';
  
  return '🌸 新手预言家';
}

// ========== 毒奶能量条 ==========
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
  if (poisonLevel < 100 || !currentUser) return;
  
  const teams = [currentMatch?.team_a || '某队', currentMatch?.team_b || '某队'];
  const targetTeam = teams[Math.floor(Math.random() * 2)];
  
  const danmakuText = `【${currentUser.username}】发动致命毒奶，${targetTeam} 队危！💀`;
  
  try {
    const { error } = await supabaseClient
      .from('danmaku')
      .insert({
        room_code: currentRoom,
        username: currentUser.username,
        message: danmakuText,
        color: getRandomColor()
      });
    
    if (error) throw error;
    
    showDanmaku(danmakuText);
    poisonLevel = 0;
    updatePoisonBar();
    showToast('毒奶已释放！💀', 'success');
    createFallingEmojis(['💜', '💀', '🔮', '🦇'], 15);
  } catch (e) {
    console.error(e);
    showToast('释放失败', 'error');
  }
}

function getRandomColor() {
  const colors = ['#ff6b9d', '#ff8c42', '#a8d8ea', '#ffd3b6', '#9b59b6', '#4caf50'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// ========== 弹幕 ==========
function showDanmaku(message) {
  const container = document.getElementById('danmaku-container');
  const item = document.createElement('div');
  item.className = 'danmaku-item';
  item.textContent = message;
  item.style.top = `${10 + Math.random() * 70}%`;
  item.style.color = getRandomColor();
  item.style.animationDuration = `${8 + Math.random() * 4}s`;
  
  container.appendChild(item);
  
  setTimeout(() => item.remove(), 12000);
}

// ========== 管理员模式 ==========
function handleAdminToggle() {
  adminClicks++;
  
  if (adminClicks >= 5) {
    document.getElementById('admin-panel').classList.toggle('hidden');
    adminClicks = 0;
    if (!document.getElementById('admin-panel').classList.contains('hidden')) {
      showToast('管理员模式已开启 🔧', 'info');
    }
  }
}

async function submitScore() {
  const matchId = document.getElementById('match-select').value;
  const scoreA = parseInt(document.getElementById('score-a').value);
  const scoreB = parseInt(document.getElementById('score-b').value);
  const btn = document.getElementById('submit-score');
  
  if (!matchId) {
    showToast('请选择比赛', 'warning');
    return;
  }
  if (isNaN(scoreA) || isNaN(scoreB)) {
    showToast('请填写完整比分', 'warning');
    return;
  }
  if (scoreA === scoreB) {
    showToast('比分不能相同哦', 'warning');
    return;
  }
  
  showLoading(btn, '结算中...');
  
  try {
    const { data: match, error: matchError } = await supabaseClient
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .limit(1);
    
    if (matchError || match.length === 0) throw matchError;
    
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
    
    if (predError) throw predError;
    
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
        const newStreak = isCorrect 
          ? (p.current_streak > 0 ? p.current_streak + 1 : 1)
          : (p.current_streak < 0 ? p.current_streak - 1 : -1);
        const newPoints = p.total_points + pointsEarned;
        const newTitle = calculateTitle(newCorrect, newWrong, newStreak);
        
        if (!isCorrect && p.id === currentUser?.id) {
          poisonLevel = Math.min(100, poisonLevel + 25);
          updatePoisonBar();
        }
        
        if (newStreak <= -6 && p.current_streak > -6) {
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
    
    await loadMyPredictions();
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
    
    showToast('比分结算完成！', 'success');
    createFallingEmojis(['🎉', '🏆', '✨'], 15);
    
    document.getElementById('score-a').value = '';
    document.getElementById('score-b').value = '';
  } catch (e) {
    console.error(e);
    showToast('结算失败，请重试', 'error');
  } finally {
    hideLoading(btn);
  }
}

// ========== 退出登录 ==========
async function logout() {
  currentUser = null;
  currentRoom = null;
  poisonLevel = 0;
  adminClicks = 0;
  myPredictions = {};
  
  localStorage.removeItem('kpl_user');
  localStorage.removeItem('kpl_room');
  
  document.getElementById('game-page').classList.add('hidden');
  document.getElementById('login-page').classList.remove('hidden');
  
  document.getElementById('username').value = '';
  document.getElementById('room-code').value = '';
  
  document.getElementById('admin-panel').classList.add('hidden');
}

// ========== 实时监听 ==========
function setupRealtimeListeners() {
  if (!supabaseClient) return;
  
  supabaseClient.channel(`room:${currentRoom}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'profiles',
      filter: `room_code=eq.${currentRoom}`
    }, () => loadLeaderboard())
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'profiles',
      filter: `room_code=eq.${currentRoom}`
    }, () => loadLeaderboard())
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'matches',
      filter: `room_code=eq.${currentRoom}`
    }, () => {
      loadMyPredictions();
      loadMatches();
    })
    .subscribe();
  
  supabaseClient.channel(`danmaku:${currentRoom}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'danmaku',
      filter: `room_code=eq.${currentRoom}`
    }, (payload) => showDanmaku(payload.new.message))
    .subscribe();
}