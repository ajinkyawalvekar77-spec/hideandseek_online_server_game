// Shared by browser and server: house layout, collision and line-of-sight.
(function (g) {
  const R = 14;
  const walls = [
    [0,0,1600,20],[0,980,1600,20],[0,0,20,1000],[1580,0,20,1000],
    [530,20,20,230],[530,350,20,330],[530,780,20,200],
    [1050,20,20,200],[1050,320,20,360],[1050,780,20,200],
    [20,490,200,20],[320,490,210,20],[550,490,200,20],[850,490,200,20],[1070,490,200,20],[1370,490,210,20]
  ];
  const furniture = [
    [60,60,140,60],[400,60,80,120],[60,600,60,200],[360,640,120,100],[640,60,200,70],
    [900,200,80,80],[640,600,100,200],[900,820,120,100],[1150,60,160,80],[1450,200,80,200],
    [1150,600,200,60],[1450,780,100,150],[200,380,80,60],[1300,380,100,60]
  ];
  const W = walls.map(a => ({ x:a[0], y:a[1], w:a[2], h:a[3], f:0 }))
    .concat(furniture.map(a => ({ x:a[0], y:a[1], w:a[2], h:a[3], f:1 })));
  const E = [];
  W.forEach(b => {
    E.push([b.x,b.y,b.x+b.w,b.y],[b.x+b.w,b.y,b.x+b.w,b.y+b.h],[b.x+b.w,b.y+b.h,b.x,b.y+b.h],[b.x,b.y+b.h,b.x,b.y]);
  });
  function hit(x, y, r) {
    r = r || R;
    for (const b of W) {
      const cx = Math.max(b.x, Math.min(x, b.x + b.w)), cy = Math.max(b.y, Math.min(y, b.y + b.h));
      if ((x-cx)*(x-cx) + (y-cy)*(y-cy) < r*r) return true;
    }
    return false;
  }
  // fraction (0..1) along a->b where the first wall is hit (1 = clear)
  function ray(ax, ay, bx, by) {
    let best = 1; const rx = bx-ax, ry = by-ay;
    for (const e of E) {
      const sx = e[2]-e[0], sy = e[3]-e[1], den = rx*sy - ry*sx;
      if (!den) continue;
      const t = ((e[0]-ax)*sy - (e[1]-ay)*sx) / den, u = ((e[0]-ax)*ry - (e[1]-ay)*rx) / den;
      if (t >= 0 && t < best && u >= 0 && u <= 1) best = t;
    }
    return best;
  }
  const los = (ax, ay, bx, by) => ray(ax, ay, bx, by) >= 1;
  const SPAWNS = [[300,250],[300,700],[800,200],[800,800],[1300,250],[1300,750],[150,850],[1000,600],[650,400],[450,900]];
  const api = { W, hit, ray, los, SPAWNS, WIDTH:1600, HEIGHT:1000, R };
  g.MAP = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
