// Hide & Seek game server. Only Node built-ins. Run: node server.js
const http = require('http'), fs = require('fs'), path = require('path'), M = require('./map.js');
const PORT = process.env.PORT || 3000, DT = 1 / 30;
const C = { SPEED:210, HIDE:20000, SEEK:180000, SEEN:0.5, STUN:8000,
  FOV:252*Math.PI/360,            // seeker sees 70% (252deg) in front, back 30% (108deg) is blind
  BEAM:Math.PI/6, BEAM_R:330, NEAR_R:120, HID_R:260, BACK:48, MAX:12 };
const rooms = new Map();
const dif = (a, b) => { const d = Math.abs(a - b) % (2*Math.PI); return d > Math.PI ? 2*Math.PI - d : d; };
const newCode = () => { let c; do { c = Array.from({length:5}, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.random()*32|0]).join(''); } while (rooms.has(c)); return c; };
const mkPlayer = n => ({ id:Math.random().toString(36).slice(2,12), name:String(n||'Player').slice(0,14), role:'hider',
  x:0, y:0, angle:0, ix:0, iy:0, out:false, seen:0, stun:0, act:false, res:null });

// Can viewer v see target t?
function sees(v, t, r, now) {
  if (v.role === 'seeker' && (r.phase === 'hiding' || now < v.stun)) return false;
  const dx = t.x - v.x, dy = t.y - v.y, d = Math.hypot(dx, dy);
  if (v.role === 'hider') return d <= C.HID_R && M.los(v.x, v.y, t.x, t.y);
  const df = dif(Math.atan2(dy, dx), v.angle);
  if (df > C.FOV) return false;                                   // behind = blind
  if (!(d <= C.NEAR_R || (df <= C.BEAM && d <= C.BEAM_R))) return false; // torch beam or close range
  return M.los(v.x, v.y, t.x, t.y);
}

function tick() {
  const now = Date.now();
  for (const r of rooms.values()) {
    if (r.phase === 'hiding' && now >= r.end) { r.phase = 'seeking'; r.end = now + C.SEEK; r.msg = 'Seekers released!'; }
    if (r.phase === 'hiding' || r.phase === 'seeking') {
      const ps = [...r.players.values()];
      for (const p of ps) {
        if (p.out || (p.role === 'seeker' && (r.phase === 'hiding' || now < p.stun))) continue;
        let ix = p.ix, iy = p.iy; const l = Math.hypot(ix, iy); if (l > 1) { ix /= l; iy /= l; }
        const nx = p.x + ix*C.SPEED*DT, ny = p.y + iy*C.SPEED*DT;
        if (!M.hit(nx, p.y)) p.x = nx;
        if (!M.hit(p.x, ny)) p.y = ny;
      }
      if (r.phase === 'seeking') {
        const seekers = ps.filter(p => p.role === 'seeker'), hiders = ps.filter(p => p.role === 'hider' && !p.out);
        for (const h of hiders) {
          const seen = seekers.some(s => sees(s, h, r, now));
          h.seen = seen ? h.seen + DT : Math.max(0, h.seen - DT*2);
          if (h.seen >= C.SEEN) { h.out = true; r.msg = h.name + ' was found!'; continue; }
          if (h.act) { // hit a seeker from behind (inside his blind 30%)
            h.act = false;
            for (const s of seekers) if (now >= s.stun && Math.hypot(h.x-s.x, h.y-s.y) <= C.BACK &&
              dif(Math.atan2(h.y-s.y, h.x-s.x), s.angle) > C.FOV) { s.stun = now + C.STUN; r.msg = h.name + ' hit ' + s.name + ' from behind!'; }
          }
        }
        if (!ps.some(p => p.role === 'hider' && !p.out)) { r.phase = 'over'; r.msg = '🔦 Seekers win!'; }
        else if (now >= r.end) { r.phase = 'over'; r.msg = '🫣 Hiders win!'; }
      }
    }
    r.n = (r.n || 0) + 1;
    if (r.n % 2) continue; // broadcast at 15 Hz
    const roster = [...r.players.values()].map(p => ({ id:p.id, name:p.name, role:p.role, out:p.out }));
    for (const v of r.players.values()) {
      if (!v.res) continue;
      const all = r.phase === 'hiding' || r.phase === 'seeking' ? [...r.players.values()] : [];
      const vis = all.filter(p => p === v || (!p.out && (v.out || sees(v, p, r, now))))
        .map(p => ({ id:p.id, name:p.name, role:p.role, x:p.x|0, y:p.y|0, angle:+p.angle.toFixed(2) }));
      v.res.write('data: ' + JSON.stringify({ phase:r.phase, msg:r.msg, left:Math.max(0, r.end - now), host:r.host,
        me:v.id, stun:Math.max(0, v.stun - now), roster, vis }) + '\n\n');
    }
  }
}
setInterval(tick, 1000 * DT);

function drop(r, p) {
  r.players.delete(p.id);
  if (!r.players.size) return rooms.delete(r.code);
  if (r.host === p.id) r.host = r.players.keys().next().value;
}

const FILES = { '/':'index.html', '/index.html':'index.html', '/style.css':'style.css', '/config.js':'config.js', '/map.js':'map.js', '/game.js':'game.js' };
const TYPES = { html:'text/html', css:'text/css', js:'text/javascript' };

http.createServer(async (q, s) => {
  const u = new URL(q.url, 'http://x');
  s.setHeader('Access-Control-Allow-Origin', '*'); s.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (q.method === 'OPTIONS') { s.writeHead(204); return s.end(); }
  const send = (o, c = 200) => { s.writeHead(c, { 'Content-Type':'application/json' }); s.end(JSON.stringify(o)); };
  if (q.method === 'GET') {
    if (u.pathname === '/list') return send([...rooms.values()].filter(r => r.pub && r.phase === 'lobby')
      .map(r => ({ code:r.code, team:r.team, n:r.players.size, max:C.MAX })));
    if (u.pathname === '/events') {
      const r = rooms.get(u.searchParams.get('code')), p = r && r.players.get(u.searchParams.get('id'));
      if (!p) { s.writeHead(404); return s.end(); }
      s.writeHead(200, { 'Content-Type':'text/event-stream', 'Cache-Control':'no-cache', Connection:'keep-alive' });
      s.write('retry: 1000\n\n'); p.res = s;
      q.on('close', () => { if (p.res === s) { p.res = null; setTimeout(() => { if (!p.res) drop(r, p); }, 8000); } });
      return;
    }
    const f = FILES[u.pathname];
    if (!f) { s.writeHead(404); return s.end('Not found'); }
    return fs.readFile(path.join(__dirname, f), (e, d) => {
      if (e) { s.writeHead(404); return s.end(); }
      s.writeHead(200, { 'Content-Type':TYPES[f.split('.').pop()] + '; charset=utf-8' }); s.end(d);
    });
  }
  let raw = ''; for await (const c of q) { raw += c; if (raw.length > 4000) break; }
  let b = {}; try { b = JSON.parse(raw || '{}'); } catch (e) {}
  const r = rooms.get(String(b.code || '').toUpperCase()), p = r && r.players.get(b.id);
  switch (u.pathname) {
    case '/create': {
      const nr = { code:newCode(), team:String(b.team || 'Team').slice(0,20), pub:!!b.pub, players:new Map(), phase:'lobby', end:0, msg:'', host:null };
      const np = mkPlayer(b.name); nr.players.set(np.id, np); nr.host = np.id; rooms.set(nr.code, nr);
      return send({ code:nr.code, id:np.id });
    }
    case '/join': {
      if (!r) return send({ error:'Team code not found' }, 404);
      if (r.phase === 'hiding' || r.phase === 'seeking') return send({ error:'Game already running' }, 409);
      if (r.players.size >= C.MAX) return send({ error:'Team is full' }, 409);
      const np = mkPlayer(b.name); r.players.set(np.id, np); return send({ code:r.code, id:np.id });
    }
    case '/role': if (p && (r.phase === 'lobby' || r.phase === 'over')) p.role = b.role === 'seeker' ? 'seeker' : 'hider'; return send({ ok:1 });
    case '/input': if (p) { p.ix = +b.ix || 0; p.iy = +b.iy || 0; if (isFinite(b.angle)) p.angle = +b.angle; if (b.act) p.act = true; } return send({ ok:1 });
    case '/start': {
      if (!p || r.host !== p.id) return send({ error:'Only the host can start' }, 403);
      const ps = [...r.players.values()];
      if (!ps.some(x => x.role === 'seeker') || !ps.some(x => x.role === 'hider')) return send({ error:'Need at least 1 seeker and 1 hider' }, 400);
      const sp = [...M.SPAWNS].sort(() => Math.random() - .5); let i = 0;
      ps.forEach(x => { x.out = false; x.seen = 0; x.stun = 0; x.act = false; x.ix = x.iy = 0;
        if (x.role === 'seeker') { x.x = 800 + Math.random()*40 - 20; x.y = 500; x.angle = Math.PI/2; }
        else { const c = sp[i++ % sp.length]; x.x = c[0]; x.y = c[1]; } });
      r.phase = 'hiding'; r.end = Date.now() + C.HIDE; r.msg = 'Hiders: hide now!';
      return send({ ok:1 });
    }
  }
  send({ error:'Unknown' }, 404);
}).listen(PORT, () => console.log('Hide & Seek on http://localhost:' + PORT));
