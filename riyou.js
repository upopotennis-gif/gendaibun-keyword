/* 利用記録（riyou）— 道場の使われ方を、先生のスプレッドシートに残す。
 *
 * 外部の解析サービスは使わない。送り先は先生の Google Apps Script だけで、
 * 集まったデータは先生の Google ドライブに残る。
 *
 * 送るもの（これだけ。名前・IP・解答内容は送らない）
 *   site      どの道場か（kobun / kanbun / gendai / eigo / sugaku / joho / kokugo）
 *   page      ページ名（index / tango など。URLのファイル名だけ）
 *   kind      view（ページを開いた）/ finish（1セット解き終えた）
 *   n, ok     finish のときの 出題数 と 正解数
 *   device    mobile / tablet / desktop（画面の幅から決める）
 *   w         画面の幅（px）
 *   from      inside（道場どうしの行き来）/ outside（よそから）/ direct（直接）
 *   id        端末ごとの符号（無作為な8文字。誰かは分からない。続けて使われているかを見るため）
 *
 * 止め方: ブラウザの localStorage に riyou.off = "1" を入れると、以後いっさい送らない。
 */
(function () {
  'use strict';

  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbyzmPBq5hNVZF6fdTTpStvsPuU0kWvUy8NYUv3PiW5P6fXi6Jcw-lmohDBuHdQtKI8DrA/exec';

  var tag = document.currentScript;
  var SITE = (tag && tag.getAttribute('data-site')) || 'unknown';
  var KEY_ID = 'riyou.id', KEY_OFF = 'riyou.off', KEY_DAY = 'riyou.day';

  function ls(fn, d) { try { return fn(); } catch (e) { return d; } }
  if (!ENDPOINT || ls(function () { return localStorage.getItem(KEY_OFF); }) === '1') return;

  var id = ls(function () { return localStorage.getItem(KEY_ID); });
  if (!id) {
    id = Math.random().toString(36).slice(2, 10);
    ls(function () { localStorage.setItem(KEY_ID, id); });
  }

  function page() {
    var p = location.pathname.replace(/\/+$/, '');
    p = p.slice(p.lastIndexOf('/') + 1);
    return p.replace(/\.html$/, '') || 'index';
  }

  function device(w) { return w < 768 ? 'mobile' : (w < 1100 ? 'tablet' : 'desktop'); }

  function from() {
    var r = document.referrer;
    if (!r) return 'direct';
    try { return new URL(r).host === location.host ? 'inside' : 'outside'; } catch (e) { return 'outside'; }
  }

  function send(kind, n, ok) {
    var w = window.innerWidth || screen.width || 0;
    var body = JSON.stringify({
      site: SITE, page: page(), kind: kind, n: n || 0, ok: ok || 0,
      device: device(w), w: w, from: from(), id: id
    });
    // sendBeacon はページを閉じても届く。使えない環境だけ fetch に落とす。
    // Content-Type を text/plain にしておくと、Apps Script への事前問い合わせ（CORS preflight）が起きない。
    var blob = ls(function () { return new Blob([body], { type: 'text/plain;charset=UTF-8' }); });
    if (navigator.sendBeacon && blob && navigator.sendBeacon(ENDPOINT, blob)) return;
    ls(function () {
      fetch(ENDPOINT, { method: 'POST', body: body, mode: 'no-cors', keepalive: true,
                        headers: { 'Content-Type': 'text/plain;charset=UTF-8' } });
    });
  }

  // ページを開いたことは1日1回だけ送る（同じ生徒が何度も開いても、日ごとの利用として数える）
  var today = new Date().toISOString().slice(0, 10);
  var mark = SITE + ':' + page() + ':' + today;
  if (ls(function () { return localStorage.getItem(KEY_DAY); }) !== mark) {
    ls(function () { localStorage.setItem(KEY_DAY, mark); });
    send('view');
  }

  // 1セット解き終えたとき。付喪神をつないである道場では、その呼び出しに相乗りする
  // （各ページに手を入れなくて済む）。付喪神の無い道場は Riyou.finish を直接呼ぶ。
  function hook() {
    if (!window.Tsukumo || window.Tsukumo.__riyou) return false;
    var orig = window.Tsukumo.finish;
    if (typeof orig !== 'function') return false;
    window.Tsukumo.finish = function (n, ok) { send('finish', n, ok); return orig.apply(this, arguments); };
    window.Tsukumo.__riyou = true;
    return true;
  }
  if (!hook()) { var t = setInterval(function () { if (hook()) clearInterval(t); }, 500); setTimeout(function () { clearInterval(t); }, 10000); }

  window.Riyou = { finish: function (n, ok) { send('finish', n, ok); }, site: SITE };
})();
