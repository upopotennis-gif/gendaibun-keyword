/* 現代文キーワード辞典 — オフライン用の控え。
   校内や通学中に回線が届かなくても開けるようにするためのもの。

   同一オリジンはネットワーク優先（取れたら控えを更新し、駄目なら控えを返す）。
   こうしておくと、公開側を差し替えたときに古い版が居座らない。
   フォントだけは控え優先（版が変わらないため、毎回取りにいく必要がない）。 */
const CACHE = "gendaibun-kw-v3";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (ks) {
        return Promise.all(ks.filter(function (k) { return k !== CACHE; })
                             .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

function keep(req, res) {
  /* 控えられない応答（部分応答など）で落とさない */
  if (res && res.ok) {
    var copy = res.clone();
    caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
  }
  return res;
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);

  /* 動画は控えない。部分応答（206）で届くため Cache に入らず、容量も大きい */
  if (/\.mp4$/i.test(url.pathname)) return;

  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req)
        .then(function (res) { return keep(req, res); })
        .catch(function () {
          return caches.match(req).then(function (r) { return r || caches.match("./index.html"); });
        })
    );
    return;
  }

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.match(req).then(function (r) {
        return r || fetch(req).then(function (res) { return keep(req, res); });
      })
    );
  }
});
