const $ = id => document.getElementById(id);
const API = (window.SERVER_URL || '').replace(/\/$/, '');
const cv = $('cv'), ctx = cv.getContext('2d');
const FOV = 252 * Math.PI / 360, BEAM = Math.PI / 6;
let me, code, es, S, rt = 0, rosterKey = '', pos = {}, keys = {}, mouse = null, touch = null, act = false, myA = 0;

async function post(p, b) {
  let r; try { r = await fetch(API + p, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(b) }); }
  catch (e) { throw Error('Cannot reach game server'); }
  const j = await r.json().catch(() => ({})); if (!r.ok) throw Error(j.error || 'Error'); return j;
}
const nm = () => { const n = $('name').value.trim() || 'Player' + (Math.random()*99|0); try { localStorage.hsName = n; } catch (e) {} return n; };
try { $('name').value = localStorage.hsName || ''; } catch (e) {}
async function enter(p, b) { try { const j = await post(p, b); me = j.id; code = j.code; connect(); } catch (e) { $('err').textContent = e.message; } }
$('create').onclick = () => enter('/create', { name:nm(), team:$('team').value.trim() || 'Team', pub:$('pub').checked });
$('join').onclick = () => enter('/join', { name:nm(), code:$('code').value.trim().toUpperCase() });
async function refresh() {
  try {
    const l = await (await fetch(API + '/list')).json();
    $('dir').innerHTML = l.length ? '' : '<i>No public teams right now</i>';
    l.forEach(t => { const b = document.createElement('button'); b.textContent = `${t.team} · ${t.code} · ${t.n}/${t.max}`;
      b.onclick = () => enter('/join', { name:nm(), code:t.code }); $('dir').appendChild(b); });
  } catch (e) { $('dir').textContent = 'Server offline'; }
}
$('refresh').onclick = refresh; refresh();

function connect() {
  es = new EventSource(`${API}/events?code=${code}&id=${me}`);
  es.onmessage = e => { S = JSON.parse(e.data); rt = performance.now(); state(); };
  es.onerror = () => { if (es.readyState === 2) { leave(); $('err').textContent = 'Disconnected from server'; } };
}
function leave() {
  if (es) es.close(); S = null; me = null; pos = {}; rosterKey = '';
  $('menu').hidden = false; ['lobby','hud','help','hitbtn'].forEach(i => $(i).hidden = true); $('toast').textContent = ''; refresh();
}
$('leave').onclick = leave;
$('start').onclick = () => post('/start', { code, id:me }).then(() => $('lerr').textContent = '').catch(e => $('lerr').textContent = e.message);

function state() {
  $('menu').hidden = true;
  const lob = S.phase === 'lobby' || S.phase === 'over';
  $('lobby').hidden = !lob; $('hud').hidden = lob; $('help').hidden = lob;
  $('hitbtn').hidden = lob || !('ontouchstart' in window);
  const k = JSON.stringify([S.roster, S.phase, S.host]);
  if (k !== rosterKey) { rosterKey = k; renderLobby(); }
  const seen = new Set(S.vis.map(p => p.id));
  for (const id in pos) if (!seen.has(id)) delete pos[id];
  S.vis.forEach(p => { const q = pos[p.id];
    if (!q) pos[p.id] = { x:p.x, y:p.y, a:p.angle, tx:p.x, ty:p.y, ta:p.angle };
    else { q.tx = p.x; q.ty = p.y; q.ta = p.angle; } });
}
function renderLobby() {
  $('lcode').textContent = code; $('lmsg').textContent = S.phase === 'over' ? S.msg : '';
  $('start').textContent = S.phase === 'over' ? 'Play again' : 'Start game';
  const ul = $('plist'); ul.innerHTML = '';
  S.roster.forEach(p => {
    const li = document.createElement('li'); li.textContent = p.name + (p.id === S.host ? ' ⭐' : '') + (p.id === me ? ' (you)' : '');
    const b = document.createElement(p.id === me ? 'button' : 'span'); b.textContent = p.role === 'seeker' ? '🔦 Seeker' : '🫣 Hider';
    if (p.id === me) b.onclick = () => post('/role', { code, id:me, role:p.role === 'seeker' ? 'hider' : 'seeker' });
    li.appendChild(b); ul.appendChild(li);
  });
  $('start').hidden = S.host !== me;
}

addEventListener('keydown', e => { keys[e.code] = 1; if (e.code === 'Space') { act = true; e.preventDefault(); } });
addEventListener('keyup', e => keys[e.code] = 0);
cv.addEventListener('mousemove', e => mouse = [e.clientX, e.clientY]);
cv.addEventListener('touchstart', e => { const t = e.touches[0]; touch = { sx:t.clientX, sy:t.clientY, x:t.clientX, y:t.clientY }; });
cv.addEventListener('touchmove', e => { const t = e.touches[0]; if (touch) { touch.x = t.clientX; touch.y = t.clientY; } });
cv.addEventListener('touchend', () => touch = null);
$('hitbtn').addEventListener('touchstart', e => { act = true; e.preventDefault(); });

setInterval(() => {
  if (!S || (S.phase !== 'hiding' && S.phase !== 'seeking')) return;
  let ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  let iy = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
  if (touch) { ix = Math.max(-1, Math.min(1, (touch.x - touch.sx) / 60)); iy = Math.max(-1, Math.min(1, (touch.y - touch.sy) / 60));
    if (Math.hypot(ix, iy) > .2) myA = Math.atan2(iy, ix); }
  else if (mouse) myA = Math.atan2(mouse[1] - innerHeight / 2, mouse[0] - innerWidth / 2);
  else if (ix || iy) myA = Math.atan2(iy, ix);
  post('/input', { code, id:me, ix, iy, angle:myA, act }).catch(() => {}); act = false;
}, 50);

const fmt = ms => { const s = Math.ceil(Math.max(0, ms) / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function cast(m, a, R) {
  const t = MAP.ray(m.x, m.y, m.x + Math.cos(a) * R, m.y + Math.sin(a) * R);
  return [m.x + Math.cos(a) * R * t, m.y + Math.sin(a) * R * t];
}
function fog(m, info) {
  const pts = [];
  if (info.role === 'hider' || S.stun > 0) { const R = S.stun > 0 ? 40 : 260; for (let a = 0; a < 6.2832; a += .05) pts.push(cast(m, a, R)); }
  else { pts.push([m.x, m.y]); for (let o = -FOV; o <= FOV; o += .025) pts.push(cast(m, m.a + o, Math.abs(o) <= BEAM ? 330 : 120)); }
  const path = () => { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); };
  ctx.beginPath(); ctx.rect(-3000, -3000, 8000, 8000);
  pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
  ctx.fillStyle = 'rgba(0,0,0,.94)'; ctx.fill('evenodd');
  if (info.role === 'seeker') { path(); ctx.fillStyle = 'rgba(255,220,120,.10)'; ctx.fill(); }
}

function draw() {
  requestAnimationFrame(draw);
  if (cv.width !== innerWidth || cv.height !== innerHeight) { cv.width = innerWidth; cv.height = innerHeight; }
  const W = cv.width, H = cv.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0b0b10'; ctx.fillRect(0, 0, W, H);
  if (!S || S.phase === 'lobby' || !pos[me]) return;
  for (const id in pos) { const q = pos[id];
    q.x += (q.tx - q.x) * .35; q.y += (q.ty - q.y) * .35;
    let d = q.ta - q.a; d = Math.atan2(Math.sin(d), Math.cos(d)); q.a += d * .4;
    if (Math.hypot(q.tx - q.x, q.ty - q.y) > 150) { q.x = q.tx; q.y = q.ty; } }
  const m = pos[me], info = S.roster.find(p => p.id === me) || {};
  m.a = myA;
  const z = Math.max(.6, Math.min(1.3, W / 1100));
  ctx.setTransform(z, 0, 0, z, W / 2 - m.x * z, H / 2 - m.y * z);
  ctx.fillStyle = '#2e2a24'; ctx.fillRect(0, 0, MAP.WIDTH, MAP.HEIGHT);
  for (const b of MAP.W) { ctx.fillStyle = b.f ? '#7a5236' : '#5b6270'; ctx.fillRect(b.x, b.y, b.w, b.h); }
  for (const p of S.vis) {
    const q = pos[p.id]; if (!q) continue;
    if (p.role === 'seeker') { ctx.fillStyle = 'rgba(255,230,140,.10)'; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.arc(q.x, q.y, 330, q.a - BEAM, q.a + BEAM); ctx.fill(); }
    ctx.fillStyle = p.role === 'seeker' ? '#e5484d' : '#46c46a';
    ctx.beginPath(); ctx.arc(q.x, q.y, 14, 0, 6.3); ctx.fill();
    ctx.strokeStyle = p.id === me ? '#fff' : '#000'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x + Math.cos(q.a) * 20, q.y + Math.sin(q.a) * 20); ctx.strokeStyle = '#fff'; ctx.stroke(); // face direction
    ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(p.name, q.x, q.y - 20);
  }
  if (S.phase !== 'over' && !info.out) {
    if (info.role === 'seeker' && S.phase === 'hiding') { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
    else fog(m, info);
  }
  $('h1').textContent = (S.phase === 'hiding' ? 'Hiding ' : 'Seeking ') + fmt(S.left - (performance.now() - rt));
  $('h2').textContent = (info.role === 'seeker' ? '🔦 Seeker' : '🫣 Hider') + (info.out ? ' · OUT (spectating)' : S.stun > 0 ? ' · stunned!' : '');
  $('h3').textContent = 'Hiders left: ' + S.roster.filter(p => p.role === 'hider' && !p.out).length;
  $('toast').textContent = S.phase === 'hiding' && info.role === 'seeker' ? 'Eyes closed… hiders are hiding!' : (S.msg || '');
}
draw();
