// ========== 全局状态 ==========
let sb = null;
let me = null;
let currentRoom = null;
let matches = [];
let myPreds = {};
let currentMatch = null;
let selectedWinner = null;
let selectedScore = null;
let newMatchEmojiA = '🐯';
let newMatchEmojiB = '🐺';
let newMatchBo = 5;
let poisonLevel = 0;

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
  initSupabase();
  bindEvents();
  loadSavedLogin();
});

function initSupabase() {
  console.log('检查 Supabase 全局变量:', typeof supabase);
  if (typeof supabase !== 'undefined') {
    console.log('supabase 对象键:', Object.keys(supabase));
  }
  
  if (typeof supabase === 'undefined') {
    console.error('Supabase 库未加载，请检查网络连接');
    showConfigError('Supabase 库加载失败，请刷新页面或检查网络');
    return;
  }
  
  if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_KEY === 'undefined' ||
      SUPABASE_URL.includes('{{') || SUPABASE_KEY.includes('{{') ||
      SUPABASE_URL === '' || SUPABASE_KEY === '') {
    console.warn('Supabase 配置未设置');
    showConfigError('Supabase 配置未设置，请检查 config.js');
    return;
  }
  
  let createClientFn = null;
  if (typeof supabase.createClient === 'function') {
    createClientFn = supabase.createClient;
  } else if (supabase.default && typeof supabase.default.createClient === 'function') {
    createClientFn = supabase.default.createClient;
  }
  
  if (!createClientFn) {
    console.error('找不到 createClient 方法，supabase 对象结构异常');
    showConfigError('Supabase 库结构异常，请刷新页面');
    return;
  }
  
  try {
    sb = createClientFn(SUPABASE_URL, SUPABASE_KEY, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        }
      }
    });
    
    if (typeof sb.from !== 'function') {
      console.error('Supabase 客户端初始化异常，from 方法不存在');
      showConfigError('Supabase 初始化异常，请刷新页面');
      sb = null;
      return;
    }
    
    console.log('Supabase 初始化成功');
  } catch (e) {
    console.error('Supabase 初始化失败:', e);
    showConfigError('Supabase 初始化失败: ' + e.message);
    sb = null;
  }
}

function bindEvents() {
  document.getElementById('join-btn').addEventListener('click', joinRoom);
  document.getElementById('create-btn').addEventListener('click', createRoom);
  document.getElementById('show-help').addEventListener('click', () => showModal('help-modal'));
  document.getElementById('close-help').addEventListener('click', () => hideModal('help-modal'));
  
  document.getElementById('username').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('room-code').focus();
  });
  document.getElementById('room-code').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinRoom();
  });
  document.getElementById('room-code').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
  });
  
  document.getElementById('copy-room').addEventListener('click', copyRoomCode);
  document.getElementById('logout-btn').addEventListener('click', logout);
  
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  
  document.getElementById('add-match-btn').addEventListener('click', openAddMatch);
  document.getElementById('cancel-add-match').addEventListener('click', () => hideModal('add-match-modal'));
  document.getElementById('confirm-add-match').addEventListener('click', addMatch);
  
  document.querySelectorAll('#emoji-a-picker .emoji-opt').forEach(opt => {
    opt.addEventListener('click', () => selectEmoji('a', opt.dataset.emoji));
  });
  document.querySelectorAll('#emoji-b-picker .emoji-opt').forEach(opt => {
    opt.addEventListener('click', () => selectEmoji('b', opt.dataset.emoji));
  });
  document.querySelectorAll('.bo-btn').forEach(btn => {
    btn.addEventListener('click', () => selectBo(btn.dataset.bo));
  });
  
  document.getElementById('cancel-predict').addEventListener('click', () => hideModal('predict-modal'));
  document.getElementById('confirm-predict').addEventListener('click', submitPrediction);
  document.querySelectorAll('.winner-btn').forEach(btn => {
    btn.addEventListener('click', () => selectWinner(btn.dataset.team));
  });
  
  document.getElementById('cancel-settle').addEventListener('click', () => hideModal('settle-modal'));
  document.getElementById('confirm-settle').addEventListener('click', settleMatch);
  
  document.getElementById('send-chat').addEventListener('click', sendChat);
  document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChat();
  });
  
  document.getElementById('help-modal').querySelector('.modal-bg').addEventListener('click', () => hideModal('help-modal'));
  document.getElementById('predict-modal').querySelector('.modal-bg').addEventListener('click', () => hideModal('predict-modal'));
  document.getElementById('add-match-modal').querySelector('.modal-bg').addEventListener('click', () => hideModal('add-match-modal'));
  document.getElementById('settle-modal').querySelector('.modal-bg').addEventListener('click', () => hideModal('settle-modal'));
}

function loadSavedLogin() {
  const savedUser = localStorage.getItem('kpl_user');
  const savedRoom = localStorage.getItem('kpl_room');
  if (savedUser) document.getElementById('username').value = savedUser;
  if (savedRoom) document.getElementById('room-code').value = savedRoom;
}

// ========== Toast ==========
function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 2000);
}

// ========== Modal ==========
function showModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

function hideModal(id) {
  document.getElementById(id).classList.add('hidden');
}

// ========== Tab 切换 ==========
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));
}

// ========== 加入房间 ==========
async function joinRoom() {
  if (!sb) { toast('配置错误', 'error'); return; }
  
  const username = document.getElementById('username').value.trim();
  const roomCode = document.getElementById('room-code').value.trim().toUpperCase();
  
  if (!username) { toast('请输入昵称', 'warning'); return; }
  if (!roomCode || roomCode.length !== 4) { toast('请输入4位房间码', 'warning'); return; }
  
  const btn = document.getElementById('join-btn');
  btn.disabled = true;
  btn.textContent = '加入中...';
  
  try {
    const { data: roomData } = await sb.from('rooms').select('*').eq('room_code', roomCode);
    if (!roomData || roomData.length === 0) {
      toast('房间不存在~', 'warning');
      return;
    }
    
    currentRoom = roomCode;
    
    const { data: users } = await sb.from('profiles')
      .select('*').eq('username', username).eq('room_code', roomCode);
    
    if (users && users.length > 0) {
      me = users[0];
    } else {
      const { data: newUser } = await sb.from('profiles')
        .insert({ username, room_code: roomCode })
        .select();
      me = newUser[0];
    }
    
    localStorage.setItem('kpl_user', username);
    localStorage.setItem('kpl_room', roomCode);
    
    enterGame();
  } catch (e) {
    console.error(e);
    toast(e.message || '加入失败', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '加入房间';
  }
}

// ========== 创建房间 ==========
async function createRoom() {
  if (!sb) { toast('配置错误', 'error'); return; }
  
  const username = document.getElementById('username').value.trim();
  if (!username) { toast('请输入昵称', 'warning'); return; }
  
  const btn = document.getElementById('create-btn');
  btn.disabled = true;
  btn.textContent = '创建中...';
  
  try {
    const roomCode = genRoomCode();
    
    const { data: newUser } = await sb.from('profiles')
      .insert({ username, room_code: roomCode, is_owner: true, title: '👑 房主大人' })
      .select();
    me = newUser[0];
    
    await sb.from('rooms').insert({ room_code: roomCode, owner_id: me.id, name: `${username}的房间` });
    
    currentRoom = roomCode;
    localStorage.setItem('kpl_user', username);
    localStorage.setItem('kpl_room', roomCode);
    
    toast('房间创建成功！', 'success');
    enterGame();
  } catch (e) {
    console.error(e);
    toast(e.message || '创建失败', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '创建新房间';
  }
}

function genRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ========== 进入游戏 ==========
function enterGame() {
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('game-page').classList.remove('hidden');
  
  document.getElementById('current-room').textContent = currentRoom;
  document.getElementById('current-user').textContent = me.username;
  updateMyInfo();
  
  if (me.is_owner) {
    document.getElementById('add-match-btn').classList.remove('hidden');
  }
  
  loadMatches();
  loadLeaderboard();
  loadChat();
  subscribeRealtime();
  
  sendSystemMsg(`${me.username} 加入了房间 🎉`);
}

function updateMyInfo() {
  document.getElementById('user-title').textContent = me.title || '🌸 新手预言家';
  document.getElementById('user-points').textContent = me.total_points || 0;
}

// ========== 复制房间码 ==========
function copyRoomCode() {
  navigator.clipboard.writeText(currentRoom).then(() => {
    toast('房间码已复制', 'success');
  }).catch(() => {
    toast('复制失败', 'error');
  });
}

// ========== 退出 ==========
function logout() {
  me = null;
  currentRoom = null;
  matches = [];
  myPreds = {};
  localStorage.removeItem('kpl_user');
  localStorage.removeItem('kpl_room');
  
  document.getElementById('game-page').classList.add('hidden');
  document.getElementById('login-page').classList.remove('hidden');
}

// ========== 加载比赛 ==========
async function loadMatches() {
  if (!sb) return;
  
  try {
    const { data, error } = await sb.from('matches')
      .select('*')
      .eq('room_code', currentRoom)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    matches = data || [];
    
    await loadMyPredictions();
    renderMatches();
  } catch (e) {
    console.error(e);
  }
}

async function loadMyPredictions() {
  if (!me) return;
  
  const { data } = await sb.from('predictions')
    .select('match_id, predicted_winner, predicted_score_a, predicted_score_b, points_earned')
    .eq('profile_id', me.id)
    .eq('room_code', currentRoom);
  
  myPreds = {};
  (data || []).forEach(p => { myPreds[p.match_id] = p; });
}

function renderMatches() {
  const list = document.getElementById('matches-list');
  
  if (matches.length === 0) {
    list.innerHTML = `
      <div class="empty-tip">
        <div class="empty-emoji">🎮</div>
        <p>${me.is_owner ? '点击右上角 ➕ 添加比赛' : '等待房主添加比赛~'}</p>
      </div>
    `;
    return;
  }
  
  list.innerHTML = matches.map(m => {
    const myPred = myPreds[m.id];
    const isCompleted = m.status === 'completed';
    
    let predTag = '';
    if (myPred && isCompleted) {
      const won = myPred.points_earned > 0;
      predTag = `<div class="my-pred-tag ${won ? 'correct' : 'wrong'}">
        ${won ? '✅ 猜对了' : '❌ 猜错了'} ${myPred.predicted_score_a}:${myPred.predicted_score_b} (+${myPred.points_earned}分)
      </div>`;
    } else if (myPred && !isCompleted) {
      predTag = `<div class="my-pred-tag">💭 已预测 ${myPred.predicted_score_a}:${myPred.predicted_score_b}</div>`;
    }
    
    let ownerBtns = '';
    if (me.is_owner && !isCompleted) {
      ownerBtns = `
        <div class="owner-actions">
          <button class="owner-btn settle" onclick="openSettle('${m.id}')">结算</button>
          <button class="owner-btn delete" onclick="deleteMatch('${m.id}')">删除</button>
        </div>
      `;
    }
    
    let statusHtml = '';
    if (isCompleted) {
      statusHtml = `<span class="final-score">最终 ${m.score_a}:${m.score_b}</span>`;
    } else {
      statusHtml = `<span class="status-tag upcoming">未开始</span>`;
    }
    
    return `
      <div class="match-card ${isCompleted ? 'completed' : ''}" ${!isCompleted && !myPred ? `onclick="openPredict('${m.id}')"` : ''}>
        <div class="match-teams">
          <div class="team-block">
            <span class="emoji">${m.team_a_emoji}</span>
            <span class="name">${m.team_a_name}</span>
          </div>
          <span class="match-vs">VS</span>
          <div class="team-block">
            <span class="name">${m.team_b_name}</span>
            <span class="emoji">${m.team_b_emoji}</span>
          </div>
        </div>
        <div class="match-meta">
          <span class="bo-tag">BO${m.best_of}</span>
          ${statusHtml}
        </div>
        ${predTag}
        ${ownerBtns}
      </div>
    `;
  }).join('');
}

// ========== 添加比赛 ==========
function openAddMatch() {
  document.getElementById('new-team-a').value = '';
  document.getElementById('new-team-b').value = '';
  newMatchEmojiA = '🐯';
  newMatchEmojiB = '🐺';
  newMatchBo = 5;
  
  document.querySelectorAll('#emoji-a-picker .emoji-opt').forEach(o => 
    o.classList.toggle('selected', o.dataset.emoji === newMatchEmojiA));
  document.querySelectorAll('#emoji-b-picker .emoji-opt').forEach(o => 
    o.classList.toggle('selected', o.dataset.emoji === newMatchEmojiB));
  document.querySelectorAll('.bo-btn').forEach(b => 
    b.classList.toggle('selected', b.dataset.bo == newMatchBo));
  
  showModal('add-match-modal');
}

function selectEmoji(team, emoji) {
  if (team === 'a') {
    newMatchEmojiA = emoji;
    document.querySelectorAll('#emoji-a-picker .emoji-opt').forEach(o => 
      o.classList.toggle('selected', o.dataset.emoji === emoji));
  } else {
    newMatchEmojiB = emoji;
    document.querySelectorAll('#emoji-b-picker .emoji-opt').forEach(o => 
      o.classList.toggle('selected', o.dataset.emoji === emoji));
  }
}

function selectBo(bo) {
  newMatchBo = parseInt(bo);
  document.querySelectorAll('.bo-btn').forEach(b => 
    b.classList.toggle('selected', b.dataset.bo == bo));
}

async function addMatch() {
  const teamA = document.getElementById('new-team-a').value.trim();
  const teamB = document.getElementById('new-team-b').value.trim();
  
  if (!teamA || !teamB) { toast('请填写完整队名', 'warning'); return; }
  
  const btn = document.getElementById('confirm-add-match');
  btn.disabled = true;
  btn.textContent = '添加中...';
  
  try {
    const { error } = await sb.from('matches').insert({
      room_code: currentRoom,
      team_a_name: teamA,
      team_a_emoji: newMatchEmojiA,
      team_b_name: teamB,
      team_b_emoji: newMatchEmojiB,
      best_of: newMatchBo
    });
    
    if (error) throw error;
    
    hideModal('add-match-modal');
    toast('比赛添加成功！', 'success');
    sendSystemMsg(`新增比赛：${teamA} VS ${teamB}`);
  } catch (e) {
    console.error(e);
    toast(e.message || '添加失败', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '添加 ✨';
  }
}

// ========== 删除比赛 ==========
async function deleteMatch(matchId) {
  if (!confirm('确定删除这场比赛吗？')) return;
  
  try {
    await sb.from('matches').delete().eq('id', matchId);
    toast('已删除', 'success');
  } catch (e) {
    toast(e.message || '删除失败', 'error');
  }
}

// ========== 预测 ==========
function openPredict(matchId) {
  const m = matches.find(x => x.id === matchId);
  if (!m) return;
  currentMatch = m;
  
  document.getElementById('preview-emoji-a').textContent = m.team_a_emoji;
  document.getElementById('preview-name-a').textContent = m.team_a_name;
  document.getElementById('preview-emoji-b').textContent = m.team_b_emoji;
  document.getElementById('preview-name-b').textContent = m.team_b_name;
  
  document.getElementById('btn-team-a-emoji').textContent = m.team_a_emoji;
  document.getElementById('btn-team-a-name').textContent = m.team_a_name;
  document.getElementById('btn-team-b-emoji').textContent = m.team_b_emoji;
  document.getElementById('btn-team-b-name').textContent = m.team_b_name;
  
  selectedWinner = null;
  selectedScore = null;
  document.querySelectorAll('.winner-btn').forEach(b => b.classList.remove('selected'));
  renderScoreOptions();
  updatePredictBtn();
  
  showModal('predict-modal');
}

function selectWinner(team) {
  selectedWinner = team;
  document.querySelectorAll('.winner-btn').forEach(b => 
    b.classList.toggle('selected', b.dataset.team === team));
  
  selectedScore = null;
  renderScoreOptions();
  updatePredictBtn();
}

function renderScoreOptions() {
  const container = document.getElementById('score-options');
  if (!selectedWinner) {
    container.innerHTML = '<p style="text-align:center;color:#bbb;font-size:13px;">先选择胜者~</p>';
    return;
  }
  
  const m = currentMatch;
  const winScore = Math.ceil(m.best_of / 2);
  const options = [];
  
  for (let lose = 0; lose < winScore; lose++) {
    if (selectedWinner === 'A') {
      options.push(`${winScore}:${lose}`);
    } else {
      options.push(`${lose}:${winScore}`);
    }
  }
  
  container.innerHTML = options.map(s => 
    `<button class="score-btn" data-score="${s}" onclick="pickScore(this)">${s}</button>`
  ).join('');
}

function pickScore(btn) {
  selectedScore = btn.dataset.score;
  document.querySelectorAll('.score-btn').forEach(b => 
    b.classList.toggle('selected', b.dataset.score === selectedScore));
  updatePredictBtn();
}

function updatePredictBtn() {
  const btn = document.getElementById('confirm-predict');
  const canSubmit = selectedWinner && selectedScore;
  btn.disabled = !canSubmit;
  btn.style.opacity = canSubmit ? '1' : '0.5';
}

async function submitPrediction() {
  if (!selectedWinner || !selectedScore || !currentMatch) return;
  
  const btn = document.getElementById('confirm-predict');
  btn.disabled = true;
  btn.textContent = '提交中...';
  
  try {
    const [sa, scB] = selectedScore.split(':').map(Number);
    const winner = selectedWinner === 'A' ? currentMatch.team_a_name : currentMatch.team_b_name;
    
    const { error } = await sb.from('predictions').insert({
      profile_id: me.id,
      match_id: currentMatch.id,
      room_code: currentRoom,
      predicted_winner: winner,
      predicted_score_a: sa,
      predicted_score_b: scB
    });
    
    if (error) throw error;
    
    hideModal('predict-modal');
    toast('预测成功！静候结果~', 'success');
    fallEmojis(['🎉', '✨', '🌸'], 12);
    
    await loadMyPredictions();
    renderMatches();
  } catch (e) {
    console.error(e);
    toast(e.message || '提交失败', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '确认预测 ✨';
  }
}

// ========== 结算 ==========
function openSettle(matchId) {
  const m = matches.find(x => x.id === matchId);
  if (!m) return;
  currentMatch = m;
  
  document.getElementById('settle-emoji-a').textContent = m.team_a_emoji;
  document.getElementById('settle-name-a').textContent = m.team_a_name;
  document.getElementById('settle-emoji-b').textContent = m.team_b_emoji;
  document.getElementById('settle-name-b').textContent = m.team_b_name;
  
  document.getElementById('settle-score-a').value = 0;
  document.getElementById('settle-score-b').value = 0;
  
  showModal('settle-modal');
}

async function settleMatch() {
  const sa = parseInt(document.getElementById('settle-score-a').value);
  const scB = parseInt(document.getElementById('settle-score-b').value);
  
  if (isNaN(sa) || isNaN(scB)) { toast('请输入比分', 'warning'); return; }
  if (sa === scB) { toast('比分不能相同', 'warning'); return; }
  
  const btn = document.getElementById('confirm-settle');
  btn.disabled = true;
  btn.textContent = '结算中...';
  
  try {
    const winner = sa > scB ? currentMatch.team_a_name : currentMatch.team_b_name;
    
    await sb.from('matches').update({
      status: 'completed',
      actual_winner: winner,
      score_a: sa,
      score_b: scB
    }).eq('id', currentMatch.id);
    
    const { data: preds } = await sb.from('predictions')
      .select('*')
      .eq('match_id', currentMatch.id);
    
    for (const pred of preds || []) {
      let points = 0;
      let correct = false;
      
      if (pred.predicted_winner === winner) {
        points += 1;
        correct = true;
        if (pred.predicted_score_a === sa && pred.predicted_score_b === scB) {
          points += 2;
        }
      }
      
      await sb.from('predictions').update({ points_earned: points }).eq('id', pred.id);
      
      const { data: prof } = await sb.from('profiles')
        .select('*').eq('id', pred.profile_id).limit(1);
      
      if (prof && prof[0]) {
        const p = prof[0];
        const newCorrect = correct ? p.correct_count + 1 : p.correct_count;
        const newWrong = correct ? p.wrong_count : p.wrong_count + 1;
        const newStreak = correct 
          ? (p.current_streak > 0 ? p.current_streak + 1 : 1)
          : (p.current_streak < 0 ? p.current_streak - 1 : -1);
        const newPoints = p.total_points + points;
        const newTitle = calcTitle(newCorrect, newWrong, newStreak, p.is_owner);
        
        await sb.from('profiles').update({
          total_points: newPoints,
          correct_count: newCorrect,
          wrong_count: newWrong,
          current_streak: newStreak,
          title: newTitle
        }).eq('id', pred.profile_id);
        
        if (pred.profile_id === me.id) {
          me = { ...me, total_points: newPoints, correct_count: newCorrect, 
                 wrong_count: newWrong, current_streak: newStreak, title: newTitle };
          updateMyInfo();
          
          if (!correct) {
            poisonLevel = Math.min(100, poisonLevel + 25);
            if (poisonLevel >= 100) {
              setTimeout(() => {
                if (confirm('💜 毒奶能量已满！释放毒奶弹幕吗？')) {
                  releasePoison();
                }
              }, 800);
            }
          }
        }
      }
    }
    
    hideModal('settle-modal');
    toast('结算完成！', 'success');
    fallEmojis(['🎉', '🏆', '✨', '⭐'], 20);
    sendSystemMsg(`比赛 ${currentMatch.team_a_name} VS ${currentMatch.team_b_name} 已结算！`);
  } catch (e) {
    console.error(e);
    toast(e.message || '结算失败', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '确认结算 🏆';
  }
}

function calcTitle(correct, wrong, streak, isOwner) {
  if (isOwner && correct + wrong === 0) return '👑 房主大人';
  if (streak <= -6) return '🧙 茅山道士';
  if (streak <= -4) return '🍼 电竞贝利';
  if (streak >= 5) return '👑 人中吕布';
  
  const total = correct + wrong;
  const rate = total > 0 ? correct / total : 0;
  
  if (rate > 0.8 && total >= 3) return '🔮 赛博先知';
  if (rate > 0.7 && total >= 5) return '🌟 神算子';
  if (rate > 0.6 && total >= 5) return '✨ 预言师';
  if (rate > 0.5 && total >= 3) return '🌸 占卜师';
  
  if (isOwner) return '👑 房主大人';
  return '🌸 新手预言家';
}

// ========== 排行榜 ==========
async function loadLeaderboard() {
  if (!sb) return;
  
  try {
    const { data, error } = await sb.from('profiles')
      .select('*')
      .eq('room_code', currentRoom)
      .order('total_points', { ascending: false });
    
    if (error) throw error;
    renderLeaderboard(data || []);
  } catch (e) {
    console.error(e);
  }
}

function renderLeaderboard(users) {
  const list = document.getElementById('leaderboard');
  
  if (users.length === 0) {
    list.innerHTML = `
      <div class="empty-tip">
        <div class="empty-emoji">🏆</div>
        <p>还没有人加入</p>
      </div>
    `;
    return;
  }
  
  list.innerHTML = users.map((u, i) => {
    const isMe = u.id === me.id;
    const rankClass = i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : 'other';
    const total = u.correct_count + u.wrong_count;
    const rate = total > 0 ? Math.round(u.correct_count / total * 100) : 0;
    
    let streakText = '';
    if (u.current_streak > 0) streakText = `🔥 ${u.current_streak}连胜`;
    else if (u.current_streak < 0) streakText = `💧 ${Math.abs(u.current_streak)}连败`;
    
    return `
      <div class="rank-item ${isMe ? 'me' : ''}">
        <div class="rank-num ${rankClass}">${i + 1}</div>
        <div class="rank-avatar">${u.username.charAt(0)}</div>
        <div class="rank-info">
          <div class="rank-name-row">
            <span class="rank-name">${u.username}</span>
            ${isMe ? '<span class="me-badge">我</span>' : ''}
            ${u.is_owner ? '<span class="me-badge" style="background:#ffd700;color:#333;">房主</span>' : ''}
          </div>
          <div class="rank-title">${u.title || ''}</div>
          <div class="rank-stats">
            <span>胜率 ${rate}%</span>
            <span>${total} 场</span>
            ${streakText ? `<span>${streakText}</span>` : ''}
          </div>
        </div>
        <div class="rank-points">
          <div class="num">${u.total_points || 0}</div>
          <div class="label">积分</div>
        </div>
      </div>
    `;
  }).join('');
}

// ========== 聊天 ==========
async function loadChat() {
  if (!sb) return;
  
  try {
    const { data, error } = await sb.from('danmaku')
      .select('*')
      .eq('room_code', currentRoom)
      .order('created_at', { ascending: true })
      .limit(50);
    
    if (error) throw error;
    renderChat(data || []);
  } catch (e) {
    console.error(e);
  }
}

function renderChat(messages) {
  const list = document.getElementById('chat-list');
  list.innerHTML = messages.map(m => {
    if (m.type === 'system') {
      return `<div class="chat-msg system">${m.message}</div>`;
    }
    const isMe = m.username === me.username;
    return `
      <div class="chat-msg ${isMe ? 'me' : 'other'}">
        <div class="chat-name">${m.username}</div>
        ${m.message}
      </div>
    `;
  }).join('');
  list.scrollTop = list.scrollHeight;
}

function appendChat(msg) {
  const list = document.getElementById('chat-list');
  let html = '';
  
  if (msg.type === 'system') {
    html = `<div class="chat-msg system">${msg.message}</div>`;
  } else {
    const isMe = msg.username === me.username;
    html = `
      <div class="chat-msg ${isMe ? 'me' : 'other'}">
        <div class="chat-name">${msg.username}</div>
        ${msg.message}
      </div>
    `;
  }
  
  list.insertAdjacentHTML('beforeend', html);
  list.scrollTop = list.scrollHeight;
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg) return;
  
  input.value = '';
  
  try {
    await sb.from('danmaku').insert({
      room_code: currentRoom,
      username: me.username,
      message: msg,
      color: '#ff6b9d',
      type: 'chat'
    });
  } catch (e) {
    console.error(e);
    toast('发送失败', 'error');
  }
}

async function sendSystemMsg(text) {
  try {
    await sb.from('danmaku').insert({
      room_code: currentRoom,
      username: '系统',
      message: text,
      type: 'system'
    });
  } catch (e) {
    console.error(e);
  }
}

// ========== 毒奶 ==========
async function releasePoison() {
  if (poisonLevel < 100) return;
  
  try {
    const targetTeam = Math.random() > 0.5 
      ? (matches[0]?.team_a_name || '某队')
      : (matches[0]?.team_b_name || '某队');
    
    const text = `【${me.username}】发动致命毒奶，${targetTeam} 队危！💀`;
    
    await sb.from('danmaku').insert({
      room_code: currentRoom,
      username: me.username,
      message: text,
      color: '#9b59b6',
      type: 'poison'
    });
    
    poisonLevel = 0;
    fallEmojis(['💜', '🔮', '💀', '🦇'], 20);
    showDanmaku(text);
  } catch (e) {
    console.error(e);
  }
}

function showDanmaku(text) {
  const container = document.getElementById('danmaku-container');
  const el = document.createElement('div');
  el.className = 'danmaku-item';
  el.textContent = text;
  el.style.top = `${10 + Math.random() * 60}%`;
  el.style.color = '#ff6b9d';
  container.appendChild(el);
  setTimeout(() => el.remove(), 8000);
}

// ========== 飘落表情 ==========
function fallEmojis(emojis, count) {
  const container = document.getElementById('falling-container');
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'falling-emoji';
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.left = `${Math.random() * 100}%`;
    el.style.animationDelay = `${Math.random() * 1.5}s`;
    el.style.animationDuration = `${2 + Math.random() * 2}s`;
    el.style.fontSize = `${22 + Math.random() * 18}px`;
    container.appendChild(el);
  }
  setTimeout(() => { container.innerHTML = ''; }, 4000);
}

// ========== 实时监听 ==========
function subscribeRealtime() {
  if (!sb) return;
  
  sb.channel(`matches_${currentRoom}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'matches',
      filter: `room_code=eq.${currentRoom}`
    }, () => {
      loadMatches();
    })
    .subscribe();
  
  sb.channel(`profiles_${currentRoom}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'profiles',
      filter: `room_code=eq.${currentRoom}`
    }, () => {
      loadLeaderboard();
    })
    .subscribe();
  
  sb.channel(`danmaku_${currentRoom}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'danmaku',
      filter: `room_code=eq.${currentRoom}`
    }, (payload) => {
      const m = payload.new;
      appendChat(m);
      if (m.type === 'poison') {
        showDanmaku(m.message);
      }
    })
    .subscribe();
}