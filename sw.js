// เพิ่มไฟล์ใหม่ในเกมเมื่อไหร่ ให้ใส่ใน SHELL และเปลี่ยนเลขเวอร์ชัน
const CACHE = 'cat-assemble-v13';
const SHELL = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'src/main.js',
  'src/game.js',
  'src/config.js',
  'src/state.js',
  'src/format.js',
  'assets/cats/dark.png',
  'assets/cats/saboteur.png',
  'assets/skills/saboteur.png',
  'assets/cats/empress.png',
  'assets/skills/empress.png',
  'assets/cats/bombardier.png',
  'assets/skills/bombardier.png',
  'assets/cats/earth.png',
  'assets/cats/fire.png',
  'assets/cats/hero.png',
  'assets/cats/ice.png',
  'assets/cats/light.png',
  'assets/cats/poison.png',
  'assets/cats/thunder.png',
  'assets/cats/wind.png',
  'assets/hero/slash1.png',
  'assets/hero/slash2.png',
  'assets/hero/slash3.png',
  'assets/hero/slash4.png',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
  'assets/skills/dark.png',
  'assets/skills/earth.png',
  'assets/skills/fire.png',
  'assets/skills/ice.png',
  'assets/skills/light.png',
  'assets/skills/poison.png',
  'assets/skills/thunder.png',
  'assets/skills/wind.png',
  'assets/ui/avatar.png',
  'assets/scenes/ruins.png',
  'assets/enemies/golem.png',
  'assets/ui/ico-setting.png',
  'assets/ui/bag.png',
  'assets/ui/btn-fight.png',
  'assets/ui/coin.png',
  'assets/ui/gem.png',
  'assets/ui/heroes.png',
  'assets/ui/quest.png',
  'assets/ui/reward.png',
  'assets/ui/setting.png',
  'assets/ui/shop.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ไฟล์เกม: โหลดจากเน็ตก่อนเพื่อได้เวอร์ชันล่าสุด ถ้าออฟไลน์ใช้ของในแคช
// ฟอนต์จาก Google: ใช้แคชแล้วอัปเดตเบื้องหลัง
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // no-cache: ถามเซิร์ฟเวอร์ทุกครั้งว่าไฟล์เปลี่ยนไหม (ไม่ใช้ของที่เบราว์เซอร์จำไว้ 10 นาที)
    e.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }))
    );
  } else if (url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    e.respondWith(
      caches.open(CACHE).then(async c => {
        const hit = await c.match(req);
        const net = fetch(req).then(res => { c.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      })
    );
  }
});
