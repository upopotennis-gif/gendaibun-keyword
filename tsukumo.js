/* 付喪神（つくもがみ）図鑑 — 現代文・古文・漢文の道場で共通の、育つ相棒とガチャ。
 *
 * 置き方: <script src="tsukumo.js" data-subject="kobun" defer></script>
 *          data-subject は kobun / kanbun / gendai のどれか。国語道場トップは all（問題はなく、図鑑とガチャだけ）
 * 呼び方: 解答のたびに  window.Tsukumo && Tsukumo.answer(正解ならtrue)
 *          1セット終了時  window.Tsukumo && Tsukumo.finish(出題数, 正解数)
 *
 * 記録はこの端末のブラウザ（localStorage "tsukumo.v1"）だけに残る。どこにも送らない。
 * 3つの道場は同じ upopotennis-gif.github.io の上にあるので、同じ図鑑を共有する。
 *
 * 元はこのファイル1つ（01 教科指導/道場共通/tsukumo/）。各道場へは 配る.py で写す。
 */
(function(){
  "use strict";
  if(window.Tsukumo) return;

  var me = document.currentScript;
  var SUBJECT = (me && me.getAttribute("data-subject")) || "kobun";
  var KEY = "tsukumo.v1";

  // ------------------------------------------------------------------ ルール
  var R = {
    coinPerCorrect: 2,
    coinSet: 5,            // 5問以上のセットを解き終えたとき
    coinPerfect: 10,       // 全問正解の上乗せ
    coinFirstOfDay: 10,    // その日最初のセット
    dailyAnswerCap: 200,   // 1日に問題から得られる墨玉の上限（当てずっぽうの連打対策）
    xpPerCorrect: 3,
    xpSameSubject: 1.5,    // 相棒の教科を解いたときの倍率
    xpSet: 5,
    cost: 30,
    rates: { nami: 62, chin: 30, ki: 8 },
    pity: 15,              // 稀が出ないまま15回目は必ず稀
    sameSubjectShare: 0.6, // 開いている教科の付喪神が出る割合
    shard: { nami: 40, chin: 70, ki: 120 },   // ダブったときに入る経験
    stages: { nami: [0, 60, 200], chin: [0, 80, 260], ki: [0, 100, 320], hi: [0, 100, 320] }
  };
  var RARITY = {
    nami: { label: "並", color: "#5e8f63" },
    chin: { label: "珍", color: "#3f6fb5" },
    ki:   { label: "稀", color: "#c08a1e" },
    hi:   { label: "秘", color: "#9a4aa8" }
  };
  var SUBJ = {
    kobun:  { label: "古文",   color: "#2c3e66" },
    kanbun: { label: "漢文",   color: "#9e2b25" },
    gendai: { label: "現代文", color: "#3d6b4f" },
    all:    { label: "三教科", color: "#6b4a8a" }
  };
  var STAGE_LABEL = ["芽生え", "目覚め", "神格"];

  // ------------------------------------------------------------------ 付喪神
  // n: 段階ごとの名前 / f: ひとこと / s: 絵の型
  var CHARS = [
    // 古文
    { id:"fude",     subj:"kobun",  r:"nami", n:["ふでっこ","筆之介","大筆丸"], f:"墨をふくむと元気になる。書き損じは見なかったことにしてくれる。" },
    { id:"suzuri",   subj:"kobun",  r:"nami", n:["すずりん","硯坊","硯海大人"], f:"ずっしり重い物知り。池の墨がなくなると少し機嫌が悪い。" },
    { id:"makimono", subj:"kobun",  r:"nami", n:["まきまき","巻物丸","絵巻の君"], f:"広げると昔の物語が始まる。最後まで読んでもらうのが夢。" },
    { id:"kai",      subj:"kobun",  r:"nami", n:["かいちゃん","貝合わせ","蛤の姫"], f:"対になる片割れを探している。和歌を一首そえると喜ぶ。" },
    { id:"ougi",     subj:"kobun",  r:"chin", n:["おうぎっこ","檜扇","末広の宮"], f:"顔をかくすのが得意。ひらくたびに風と噂を運んでくる。" },
    { id:"kicho",    subj:"kobun",  r:"chin", n:["きちょりん","几帳","御簾越しの君"], f:"恥ずかしがり屋。向こう側から、そっと答えを教えてくれる。" },
    { id:"wa",       subj:"kobun",  r:"chin", n:["わっか","車輪丸","御所車"], f:"牛車から転がり出た。行幸の日はそわそわしている。" },
    { id:"biwa",     subj:"kobun",  r:"ki",   n:["びわっこ","琵琶法師","玄象"], f:"弾けば無常の響き。平家の物語をそらで語れる。" },
    // 漢文
    { id:"chikukan", subj:"kanbun", r:"nami", n:["ちくちく","竹簡","簡牘大師"], f:"紙より古い書物。ひもがほどけると言葉がこぼれる。" },
    { id:"sumi",     subj:"kanbun", r:"nami", n:["すみっこ","墨丸","松煙公"], f:"すればするほど香る。無口だが、書き下しは誰より速い。" },
    { id:"goke",     subj:"kanbun", r:"nami", n:["ごけっこ","碁笥","爛柯の翁"], f:"白と黒の石を抱えている。一局打つと斧の柄が腐るらしい。" },
    { id:"hikka",    subj:"kanbun", r:"nami", n:["ひっか","筆架山","三峰の仙"], f:"筆を休ませる小さな山。仙人に憧れて修行中。" },
    { id:"shuin",    subj:"kanbun", r:"chin", n:["しゅいん","朱印","玉璽王"], f:"押せばその日の証になる。印泥が少し辛い。" },
    { id:"kouro",    subj:"kanbun", r:"chin", n:["こうろ","香炉","博山の主"], f:"けむりで山を描く。香りで故事成語を思い出させてくれる。" },
    { id:"kanae",    subj:"kanbun", r:"chin", n:["かなえ","鼎","九鼎の帝"], f:"三本の足で立つ。「鼎の軽重を問ふ」と言われると怒る。" },
    { id:"kagami",   subj:"kanbun", r:"ki",   n:["かがみん","銅鏡","明鏡止水"], f:"曇りなく心をうつす。覆水は盆に返らないと知っている。" },
    // 現代文
    { id:"fusen",    subj:"gendai", r:"nami", n:["ふせん","付箋紙","栞付箋"], f:"大事なところに貼りついて離れない。はがされると寂しい。" },
    { id:"keshi",    subj:"gendai", r:"nami", n:["けしけし","消しゴム","白紙の賢者"], f:"まちがいを消すたびに少し小さくなる。それが誇り。" },
    { id:"enpitsu",  subj:"gendai", r:"nami", n:["えんぴ","鉛筆丸","HB将軍"], f:"削るほど鋭くなる。芯の強さなら誰にも負けない。" },
    { id:"shiori",   subj:"gendai", r:"nami", n:["しおりん","栞","押し花の栞"], f:"読みかけの場所を覚えている。続きを読んでほしくて待っている。" },
    { id:"genkou",   subj:"gendai", r:"chin", n:["げんこう","原稿用紙","四百字の主"], f:"一マスに一字。句読点を行頭に置くと注意してくる。" },
    { id:"megane",   subj:"gendai", r:"chin", n:["めがねっこ","眼鏡","慧眼の士"], f:"行間まで見える。評論の対比構造を見抜くのが得意。" },
    { id:"jisho",    subj:"gendai", r:"chin", n:["じしょ","辞書","広辞の翁"], f:"知らない言葉はない、と言い張る。引かれるたびに少し厚くなる。" },
    { id:"mannen",   subj:"gendai", r:"ki",   n:["まんねん","万年筆","文豪の筆"], f:"インクの色は気分しだい。名文を書く手に宿るといわれる。" },
    // 秘（やりこみで現れる。ガチャでは出ない）
    { id:"fuguruma", subj:"all", r:"hi", n:["ふぐるま","文車","文車の主"], f:"たくさん解いた人の本を運ぶ。積み荷は正解の数だけ増える。",
      how:"通算300問正解", test:function(s){ return s.total.correct >= 300; }, prog:function(s){ return [s.total.correct, 300]; } },
    { id:"koyomi",   subj:"all", r:"hi", n:["こよみ","暦","日読みの神"], f:"毎日めくられるのを待っている。七日そろうと姿を現す。",
      how:"7日学習する", test:function(s){ return s.days.length >= 7; }, prog:function(s){ return [s.days.length, 7]; } },
    { id:"andon",    subj:"all", r:"hi", n:["あんどん","行灯","三才の灯"], f:"三つの道場を照らす灯り。古文・漢文・現代文すべてを学ぶ人のもとへ。",
      how:"古文・漢文・現代文で1セットずつ", test:function(s){ return ["kobun","kanbun","gendai"].every(function(k){ return (s.subj[k]||{}).sets > 0; }); },
      prog:function(s){ return [["kobun","kanbun","gendai"].filter(function(k){ return (s.subj[k]||{}).sets > 0; }).length, 3]; } },
    { id:"kura",     subj:"all", r:"hi", n:["くらっこ","土蔵","万宝の蔵"], f:"集めた付喪神たちの家。二十の仲間がそろうと扉が開く。",
      how:"図鑑に20種", test:function(s){ return Object.keys(s.owned).length >= 20; }, prog:function(s){ return [Object.keys(s.owned).length, 20]; } }
  ];
  var BY = {}; CHARS.forEach(function(c){ BY[c.id] = c; });
  var STARTERS = ["fude", "sumi", "enpitsu"];

  // ------------------------------------------------------------------ 絵（SVG）
  var O = "#2b2630";
  function el(tag, a){ var s = "<" + tag; for(var k in a) s += " " + k + '="' + a[k] + '"'; return s + "/>"; }
  function rect(x,y,w,h,f,rx,extra){ var a = {x:x,y:y,width:w,height:h,fill:f,stroke:O,"stroke-width":2.5}; if(rx) a.rx = rx; for(var k in extra||{}) a[k] = extra[k]; return el("rect", a); }
  function circ(cx,cy,r,f,extra){ var a = {cx:cx,cy:cy,r:r,fill:f,stroke:O,"stroke-width":2.5}; for(var k in extra||{}) a[k] = extra[k]; return el("circle", a); }
  function path(d,f,extra){ var a = {d:d,fill:f,stroke:O,"stroke-width":2.5,"stroke-linejoin":"round"}; for(var k in extra||{}) a[k] = extra[k]; return el("path", a); }
  function line(x1,y1,x2,y2,c,w){ return el("line", {x1:x1,y1:y1,x2:x2,y2:y2,stroke:c||O,"stroke-width":w||2.5,"stroke-linecap":"round"}); }

  // 各型: body（本体の絵）、face（顔の位置 [x,y,目の間隔,白目か]）、lim（腕の左右x・腕のy・足のy）
  var SHAPES = {
    fude: { body: function(){ return path("M40 66 Q50 98 60 66 Z", "#2a2a30") + rect(40,12,20,56,"#d9b26a",7) + rect(40,20,20,5,"#8b5a2b") + rect(40,58,20,6,"#8b5a2b"); },
      face:[50,42,7], lim:[40,60,46,88] },
    suzuri: { body: function(){ return rect(16,32,68,50,"#555563",10) + rect(24,38,52,16,"#2c2c36",7) + path("M30 46 Q50 42 70 46", "none", {stroke:"#6a6a80","stroke-width":1.5}); },
      face:[50,67,9,true], lim:[16,84,64,84] },
    makimono: { body: function(){ return rect(22,30,56,44,"#f3ead2") + line(30,42,70,42,"#c7b48a",2) + line(30,62,70,62,"#c7b48a",2) + rect(14,24,10,56,"#b0413e",5) + rect(76,24,10,56,"#b0413e",5); },
      face:[50,52,8], lim:[14,86,52,84] },
    kai: { body: function(){ return path("M16 70 Q50 6 84 70 Q50 86 16 70 Z", "#f4c7b5") + [30,40,50,60,70].map(function(x){ return line(50,80,x,28 + Math.abs(x-50)*0.5,"#d89a86",1.8); }).join("") + path("M40 78 Q50 88 60 78", "#e8b19d"); },
      face:[50,58,9], lim:[18,82,62,86] },
    ougi: { body: function(){ var s = path("M50 84 L12 42 A48 48 0 0 1 88 42 Z", "#e25c4a"); [-36,-18,0,18,36].forEach(function(dx){ s += line(50,84,50+dx,24 + Math.abs(dx)*0.45,"#8e2a20",1.6); }); return s + path("M22 46 A40 40 0 0 1 78 46", "none", {stroke:"#f6d36b","stroke-width":4}) + circ(50,82,4,"#f6d36b"); },
      face:[50,54,9], lim:[20,80,58,90] },
    kicho: { body: function(){ return rect(16,14,68,6,"#6b4a2a",3) + line(50,10,50,20,O,4) + rect(20,20,60,58,"#e8d4f0") + line(35,20,35,78,"#b58cc8",4) + line(65,20,65,78,"#b58cc8",4) + rect(30,78,40,6,"#6b4a2a",3); },
      face:[50,48,9], lim:[20,80,50,88] },
    wa: { body: function(){ var s = circ(50,55,34,"#e9d7b0",{"stroke-width":6,stroke:"#5a3a22"}); for(var i=0;i<8;i++){ var a = i*Math.PI/4; s += line(50+Math.cos(a)*16,55+Math.sin(a)*16,50+Math.cos(a)*32,55+Math.sin(a)*32,"#5a3a22",4); } return s + circ(50,55,17,"#c99a52"); },
      face:[50,55,7], lim:[16,84,55,92] },
    biwa: { body: function(){ return path("M46 36 L44 8 Q50 2 58 8 L54 36 Z", "#6e4121") + path("M50 32 C18 34 16 90 50 90 C84 90 82 34 50 32 Z", "#b0703d") + line(47,12,47,86,"#f2e3c0",1) + line(53,12,53,86,"#f2e3c0",1) + path("M32 58 q4 -4 8 0", "none", {stroke:O,"stroke-width":2}) + path("M60 58 q4 -4 8 0", "none", {stroke:O,"stroke-width":2}) + rect(40,78,20,5,"#3a2412",2); },
      face:[50,68,9], lim:[20,80,64,94] },
    chikukan: { body: function(){ var s = ""; for(var i=0;i<5;i++) s += rect(21+i*11.6,16,11.6,66,i%2?"#bcc98a":"#d3dca6",2); return s + line(18,30,82,30,"#7a5a30",3) + line(18,68,82,68,"#7a5a30",3); },
      face:[50,49,9], lim:[21,79,50,86] },
    sumi: { body: function(){ return rect(30,12,40,74,"#26262c",6) + rect(38,22,24,18,"#caa24a",2) + line(42,31,58,31,"#26262c",2); },
      face:[50,60,8,true], lim:[30,70,58,90] },
    goke: { body: function(){ return path("M18 40 Q18 84 50 84 Q82 84 82 40 Z", "#c9995c") + el("ellipse",{cx:50,cy:38,rx:33,ry:11,fill:"#b5834a",stroke:O,"stroke-width":2.5}) + circ(42,33,4,"#fafafa",{"stroke-width":1.5}) + circ(56,34,4,"#222",{"stroke-width":1.5}); },
      face:[50,62,9], lim:[18,82,58,88] },
    hikka: { body: function(){ return path("M12 80 L28 40 L38 58 L50 20 L62 58 L72 40 L88 80 Z", "#7c8ea0") + path("M44 32 L50 20 L56 32 Z", "#f4f4f8", {"stroke-width":1.5}); },
      face:[50,64,8], lim:[20,80,66,88] },
    shuin: { body: function(){ return rect(37,10,26,30,"#dcc9a2",11) + path("M44 20 q6 -6 12 0", "none", {stroke:"#a8926a","stroke-width":2}) + rect(24,40,52,42,"#c0392b",5) + rect(30,74,40,4,"#8e1f15",1); },
      face:[50,58,9,true], lim:[24,76,58,88] },
    kouro: { body: function(){ return path("M50 26 q-6 -8 0 -14 q6 -6 0 -12", "none", {stroke:"#9aa0b8","stroke-width":2.5}) + path("M26 50 Q50 24 74 50 Z", "#b09c6a") + circ(50,30,4,"#d8c07a") + path("M22 50 Q22 84 50 84 Q78 84 78 50 Z", "#8d7c56") + line(30,84,26,92) + line(70,84,74,92); },
      face:[50,64,9], lim:[22,78,60,94] },
    kanae: { body: function(){ return rect(26,20,8,16,"#5f7a5a",2) + rect(66,20,8,16,"#5f7a5a",2) + path("M20 36 L80 36 Q80 78 50 78 Q20 78 20 36 Z", "#6f8a6a") + path("M26 46 L74 46", "none", {stroke:"#4c6448","stroke-width":2}) + line(32,74,28,92,O,4) + line(50,78,50,94,O,4) + line(68,74,72,92,O,4); },
      face:[50,58,9], lim:[20,80,52,96] },
    kagami: { body: function(){ return circ(50,52,36,"#b08d57") + circ(50,52,27,"#e6d49a") + path("M36 40 q8 -8 16 -6", "none", {stroke:"#fff8dc","stroke-width":3}) + rect(44,86,12,8,"#8a6a3a",2); },
      face:[50,56,10], lim:[14,86,54,98] },
    fusen: { body: function(){ return path("M20 18 L80 18 L80 64 L64 80 L20 80 Z", "#ffe36e") + path("M64 80 L64 64 L80 64 Z", "#e8c43e"); },
      face:[48,46,9], lim:[20,80,50,86] },
    keshi: { body: function(){ return rect(16,34,68,40,"#fbfbfb",6) + rect(16,32,44,44,"#3a78c2",4) + line(22,40,54,40,"#fff",2); },
      face:[38,56,8,true], lim:[16,84,56,82] },
    enpitsu: { body: function(){ return path("M38 72 L50 96 L62 72 Z", "#f1d9a8") + path("M46 88 L50 96 L54 88 Z", "#333") + rect(38,24,24,50,"#f2b632") + line(46,24,46,74,"#d49a1c",2) + line(54,24,54,74,"#d49a1c",2) + rect(38,16,24,9,"#b8b8c0") + rect(38,6,24,11,"#f29aa8",4); },
      face:[50,48,8], lim:[38,62,50,94] },
    shiori: { body: function(){ return path("M50 12 Q46 2 40 4", "none", {stroke:"#c0392b","stroke-width":2}) + circ(40,5,3,"#c0392b",{"stroke-width":1.5}) + rect(32,10,36,74,"#f0bcd0",3) + circ(50,18,3,"#fff") + circ(50,70,6,"#f7e36a",{"stroke-width":1.5}) + circ(44,70,3.5,"#f59ab2",{"stroke-width":1}) + circ(56,70,3.5,"#f59ab2",{"stroke-width":1}); },
      face:[50,44,8], lim:[32,68,46,90] },
    genkou: { body: function(){ var s = rect(18,12,64,76,"#fffaf0"); for(var i=1;i<4;i++) s += line(18+i*16,12,18+i*16,88,"#d27a66",1.5); for(var j=1;j<5;j++) s += line(18,12+j*15.2,82,12+j*15.2,"#d27a66",1.2); return s; },
      face:[50,50,9], lim:[18,82,52,92] },
    megane: { body: function(){ return line(12,48,4,40,O,3) + line(88,48,96,40,O,3) + circ(32,54,17,"#dcecff",{"stroke-width":4}) + circ(68,54,17,"#dcecff",{"stroke-width":4}) + path("M48 50 Q50 44 52 50", "none", {"stroke-width":4}); },
      face:[50,54,18], lim:[15,85,58,80], mouthY:78 },
    jisho: { body: function(){ return rect(20,16,58,70,"#2e5d8c",4) + rect(72,20,8,62,"#f5f0e0",2) + rect(28,24,36,10,"#d8b24a",2) + rect(80,30,6,8,"#e25c4a",1) + rect(80,46,6,8,"#6ab04c",1); },
      face:[46,56,9,true], lim:[20,80,58,92] },
    mannen: { body: function(){ return path("M40 66 L50 94 L60 66 Z", "#d9b340") + line(50,72,50,88,O,1.5) + rect(40,10,20,58,"#1f2a44",9) + rect(40,54,20,6,"#d9b340") + rect(57,14,5,26,"#d9b340",2); },
      face:[50,36,7,true], lim:[40,60,40,96] },
    fuguruma: { body: function(){ return rect(20,22,14,20,"#c0392b",2) + rect(34,18,14,24,"#2e5d8c",2) + rect(48,24,14,18,"#3d6b4f",2) + rect(62,20,14,22,"#d9b26a",2) + rect(16,42,68,26,"#8a5a30",4) + circ(30,76,9,"#e9d7b0",{"stroke-width":3}) + circ(70,76,9,"#e9d7b0",{"stroke-width":3}); },
      face:[50,55,10,true], lim:[16,84,52,90] },
    koyomi: { body: function(){ return rect(22,16,56,68,"#ffffff",4) + rect(22,16,56,16,"#c0392b",4) + circ(36,16,3,"#555") + circ(64,16,3,"#555") + el("text",{x:50,y:78,"text-anchor":"middle","font-size":12,"font-weight":700,fill:"#c0392b","font-family":"serif"}).replace("/>", ">吉</text>"); },
      face:[50,52,9], lim:[22,78,54,92] },
    andon: { body: function(){ return circ(50,48,40,"rgba(255,214,120,.35)",{stroke:"none"}) + rect(28,14,44,8,"#3a2a1a",2) + rect(30,22,40,58,"#fff1c4") + line(50,22,50,80,"#3a2a1a",2) + line(30,51,70,51,"#3a2a1a",2) + rect(26,80,48,8,"#3a2a1a",2); },
      face:[50,40,9], lim:[30,70,44,94] },
    kura: { body: function(){ return path("M12 42 L50 14 L88 42 Z", "#2e2e34") + rect(20,42,60,44,"#f4f1ea") + path("M20 74 L80 74", "none", {stroke:"#9a9aa6","stroke-width":2}) + rect(40,60,20,26,"#6b4a2a",2) + circ(50,32,3,"#d9b340",{"stroke-width":1.5}); },
      face:[50,52,10], lim:[20,80,54,92] }
  };

  function faceSVG(sh, stage, dark){
    var f = sh.face, x = f[0], y = f[1], sp = f[2] || 8, w = f[3];
    var eye = w ? "#fff" : O, s = "";
    var er = stage === 0 ? 2.6 : 3.2;
    [x - sp, x + sp].forEach(function(ex){
      if(stage === 2){
        s += path("M" + (ex-3.5) + " " + (y+1) + " Q" + ex + " " + (y-4) + " " + (ex+3.5) + " " + (y+1), "none", {stroke:eye,"stroke-width":2.6,"stroke-linecap":"round"});
      } else {
        s += circ(ex, y, er, eye, {stroke:"none"});
        if(stage === 1 && !w) s += circ(ex+1, y-1, 1, "#fff", {stroke:"none"});
      }
      s += el("ellipse", {cx: ex + (ex < x ? -4 : 4), cy: y + 5, rx: 3.2, ry: 1.8, fill: "#ff8fa3", opacity: .55});
    });
    var my = sh.mouthY || (y + 5);
    s += path("M" + (x-3) + " " + my + " Q" + x + " " + (my+3.5) + " " + (x+3) + " " + my, "none", {stroke:eye,"stroke-width":2,"stroke-linecap":"round"});
    return s;
  }

  function limbsSVG(sh){
    var l = sh.lim, s = "";
    s += path("M" + l[0] + " " + l[2] + " Q" + (l[0]-9) + " " + (l[2]+2) + " " + (l[0]-11) + " " + (l[2]+9), "none", {"stroke-width":3,"stroke-linecap":"round"});
    s += path("M" + l[1] + " " + l[2] + " Q" + (l[1]+9) + " " + (l[2]+2) + " " + (l[1]+11) + " " + (l[2]+9), "none", {"stroke-width":3,"stroke-linecap":"round"});
    s += circ(l[0]-11, l[2]+10, 2.8, "#fff") + circ(l[1]+11, l[2]+10, 2.8, "#fff");
    s += el("ellipse", {cx:42, cy:l[3], rx:5.5, ry:3, fill:O}) + el("ellipse", {cx:58, cy:l[3], rx:5.5, ry:3, fill:O});
    return s;
  }

  function star(x, y, r, c){
    var p = "";
    for(var i=0;i<8;i++){ var a = i*Math.PI/4 - Math.PI/2, rr = i%2 ? r*0.4 : r; p += (i?"L":"M") + (x+Math.cos(a)*rr).toFixed(1) + " " + (y+Math.sin(a)*rr).toFixed(1); }
    return el("path", {d:p + "Z", fill:c});
  }

  function art(id, stage, opts){
    opts = opts || {};
    var c = BY[id], sh = SHAPES[id], col = RARITY[c.r].color;
    var sc = [0.74, 0.86, 0.94][stage];
    var inner = "";
    if(stage === 2){
      inner += el("circle", {cx:50, cy:54, r:47, fill:col, opacity:.16});
      for(var i=0;i<12;i++){ var a = i*Math.PI/6; inner += line(50+Math.cos(a)*36, 54+Math.sin(a)*36, 50+Math.cos(a)*47, 54+Math.sin(a)*47, col, 2); }
    }
    if(stage === 2){   // 光の輪と星は絵の後ろに置く（縦に長い子の頭に重ならないように）
      inner += el("ellipse", {cx:50, cy:6, rx:16, ry:4, fill:"none", stroke:"#e0b43c", "stroke-width":3});
      inner += star(14, 18, 5, "#e0b43c") + star(88, 26, 4, "#e0b43c") + star(84, 88, 3.5, "#e0b43c");
    }
    var fig = sh.body() + (stage >= 1 ? limbsSVG(sh) : "") + faceSVG(sh, stage);
    inner += '<g transform="translate(50 56) scale(' + sc + ') translate(-50 -56)">' + fig + "</g>";
    if(opts.silhouette){
      return '<svg viewBox="0 0 100 100" aria-hidden="true"><g class="tk-sil">' + inner + "</g></svg>";
    }
    return '<svg viewBox="0 0 100 100" role="img" aria-label="' + c.n[stage] + '">' + inner + "</svg>";
  }

  // ------------------------------------------------------------------ 記録
  function today(){
    var d = new Date(); function p(n){ return (n<10?"0":"") + n; }
    return d.getFullYear() + "-" + p(d.getMonth()+1) + "-" + p(d.getDate());
  }
  function fresh(){
    return { v:1, coins:0, owned:{}, partner:null, pendingXp:0, pulls:0, pity:0,
             total:{ answers:0, correct:0, sets:0, perfect:0 }, subj:{}, days:[], today:{ d:"", coins:0, sets:0 } };
  }
  var S = (function(){
    try{
      var o = JSON.parse(localStorage.getItem(KEY) || "null");
      if(!o || o.v !== 1) return fresh();
      var f = fresh(); for(var k in f) if(o[k] === undefined) o[k] = f[k];
      return o;
    }catch(e){ return fresh(); }
  })();
  var canSave = true;
  function save(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){ canSave = false; } }
  // 別のタブ（別の道場）で増えた分を取り込む
  window.addEventListener("storage", function(e){
    if(e.key !== KEY || !e.newValue) return;
    try{ S = JSON.parse(e.newValue); refreshFab(); if(panelOpen) renderPanel(); }catch(err){}
  });

  function rollDay(){
    var t = today();
    if(S.today.d !== t) S.today = { d:t, coins:0, sets:0 };
  }
  function subjRec(k){ return S.subj[k] || (S.subj[k] = { answers:0, correct:0, sets:0 }); }
  function stageOf(id){
    var c = BY[id], xp = (S.owned[id] || {}).xp || 0, th = R.stages[c.r];
    return xp >= th[2] ? 2 : (xp >= th[1] ? 1 : 0);
  }

  var queue = [];   // 進化・新しい仲間の知らせ（順に見せる）

  function giveXp(id, n){
    if(!id || !S.owned[id]) return;
    var before = stageOf(id);
    S.owned[id].xp = Math.round(((S.owned[id].xp || 0) + n) * 10) / 10;   // 端数は持ったまま、表示で丸める
    var after = stageOf(id);
    if(after > before) queue.push({ kind:"evolve", id:id, from:before, to:after });
  }

  function obtain(id, via){
    if(S.owned[id]){
      var add = R.shard[BY[id].r] || 60;
      giveXp(id, add);
      S.owned[id].dup = (S.owned[id].dup || 0) + 1;
      return { id:id, isNew:false, xp:add };
    }
    S.owned[id] = { xp:0, got:today(), dup:0, via:via };
    return { id:id, isNew:true };
  }

  function checkSecrets(){
    CHARS.forEach(function(c){
      if(c.r === "hi" && !S.owned[c.id] && c.test(S)){
        obtain(c.id, "secret");
        queue.push({ kind:"secret", id:c.id });
      }
    });
  }

  var coinFx = 0;

  // ------------------------------------------------------------------ 外から呼ぶところ
  function answer(correct){
    rollDay();
    var sr = subjRec(SUBJECT);
    S.total.answers++; sr.answers++;
    if(correct){
      S.total.correct++; sr.correct++;
      var room = Math.max(0, R.dailyAnswerCap - S.today.coins);
      var got = Math.min(R.coinPerCorrect, room);
      S.coins += got; S.today.coins += got; coinFx += got;
      var xp = R.xpPerCorrect;
      if(S.partner && BY[S.partner].subj === SUBJECT) xp *= R.xpSameSubject;
      if(S.partner) giveXp(S.partner, xp); else S.pendingXp += xp;
      if(S.partner) bounce();
    }
    checkSecrets();
    save();
    refreshFab();
    flushFx();
  }

  function finish(asked, correct){
    rollDay();
    if(!asked || asked < 5){ save(); return; }
    var sr = subjRec(SUBJECT);
    S.total.sets++; sr.sets++;
    var bonus = R.coinSet;
    if(correct === asked){ bonus += R.coinPerfect; S.total.perfect++; }
    if(S.today.sets === 0) bonus += R.coinFirstOfDay;
    S.today.sets++;
    S.coins += bonus; coinFx += bonus;
    if(S.days.indexOf(S.today.d) < 0){ S.days.push(S.today.d); if(S.days.length > 400) S.days = S.days.slice(-400); }
    if(S.partner) giveXp(S.partner, R.xpSet); else S.pendingXp += R.xpSet;
    checkSecrets();
    save();
    refreshFab();
    flushFx();
    showQueue();
  }

  // ------------------------------------------------------------------ ガチャ
  function pickFrom(list){ return list[Math.floor(Math.random() * list.length)]; }
  function pull(){
    if(S.coins < R.cost) return null;
    S.coins -= R.cost; S.pulls++; S.pity++;
    var r;
    if(S.pity >= R.pity) r = "ki";
    else {
      var x = Math.random() * 100;
      r = x < R.rates.ki ? "ki" : (x < R.rates.ki + R.rates.chin ? "chin" : "nami");
    }
    if(r === "ki") S.pity = 0;
    var pool = CHARS.filter(function(c){ return c.r === r; });
    var mine = pool.filter(function(c){ return c.subj === SUBJECT; });
    var c = (mine.length && Math.random() < R.sameSubjectShare) ? pickFrom(mine) : pickFrom(pool);
    var res = obtain(c.id, "gacha");
    checkSecrets();
    save();
    refreshFab();
    return res;
  }

  // ------------------------------------------------------------------ 見た目
  var CSS = [
    ".tk-fab{position:fixed;right:14px;bottom:14px;z-index:9990;width:62px;height:62px;border-radius:50%;border:2px solid #2b2630;",
    " background:#fffaf0;box-shadow:0 4px 14px rgba(0,0,0,.22);padding:4px;cursor:pointer;display:flex;align-items:center;justify-content:center}",
    ".tk-fab svg{width:100%;height:100%;overflow:visible}",
    ".tk-fab .tk-coin{position:absolute;left:-6px;top:-8px;background:#2b2630;color:#f6d36b;font:700 11px/1 system-ui,sans-serif;",
    " padding:4px 7px;border-radius:999px;white-space:nowrap;font-variant-numeric:tabular-nums}",
    ".tk-fab .tk-dot{position:absolute;right:-2px;top:-2px;width:14px;height:14px;border-radius:50%;background:#e25c4a;border:2px solid #fffaf0}",
    ".tk-fab:focus-visible{outline:3px solid #c08a1e;outline-offset:3px}",
    ".tk-bounce{animation:tkb .5s ease}@keyframes tkb{0%,100%{transform:translateY(0)}40%{transform:translateY(-10px) scale(1.06)}}",
    ".tk-pop{position:fixed;right:24px;bottom:84px;z-index:9991;font:800 15px system-ui,sans-serif;color:#b8860b;",
    " text-shadow:0 1px 0 #fff,0 0 6px #fff;pointer-events:none;animation:tkp 1.1s ease forwards}",
    "@keyframes tkp{from{opacity:0;transform:translateY(8px)}20%{opacity:1}to{opacity:0;transform:translateY(-26px)}}",
    "body.tk-pad{padding-bottom:84px}",
    ".tk-veil{position:fixed;inset:0;z-index:9995;background:rgba(20,18,26,.55);display:flex;align-items:flex-end;justify-content:center}",
    "@media (min-width:640px){.tk-veil{align-items:center}}",
    ".tk-panel{--tk-bg:#fffaf0;--tk-ink:#2b2630;--tk-soft:#6d6553;--tk-line:#e0d4b4;--tk-card:#f6efdc;",
    " background:var(--tk-bg);color:var(--tk-ink);width:100%;max-width:560px;max-height:92vh;overflow:auto;border-radius:18px 18px 0 0;",
    " padding:16px 16px 22px;box-shadow:0 -6px 30px rgba(0,0,0,.3);font:15px/1.6 'Zen Maru Gothic','Hiragino Maru Gothic ProN',system-ui,sans-serif}",
    "@media (min-width:640px){.tk-panel{border-radius:18px}}",
    "@media (prefers-color-scheme:dark){.tk-panel{--tk-bg:#1d1b26;--tk-ink:#efe8d6;--tk-soft:#aaa18c;--tk-line:#3b3750;--tk-card:#27243a}",
    " .tk-fab{background:#27243a;border-color:#efe8d6}",
    " .tk-sil{filter:brightness(0) invert(1)!important;opacity:.16!important}",
    " .tk-fab svg,.tk-cell svg,.tk-big svg,.tk-goal .tk-ic svg,.tk-reveal svg{filter:drop-shadow(0 0 1.2px rgba(255,250,235,.85))}}",
    ".tk-sil{filter:brightness(0);opacity:.18}",
    ".tk-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}",
    ".tk-head h2{margin:0;font-size:1.1rem;font-family:'Shippori Mincho',serif}",
    ".tk-x{border:0;background:none;color:inherit;font-size:1.5rem;cursor:pointer;line-height:1;padding:4px 8px}",
    ".tk-tabs{display:flex;gap:6px;margin-bottom:14px}",
    ".tk-tabs button{flex:1;border:1.5px solid var(--tk-line);background:transparent;color:inherit;border-radius:10px;padding:9px 4px;font:inherit;font-weight:700;cursor:pointer}",
    ".tk-tabs button[aria-selected=true]{background:var(--tk-ink);color:var(--tk-bg);border-color:var(--tk-ink)}",
    ".tk-hero{display:flex;flex-direction:column;align-items:center;text-align:center;gap:4px}",
    ".tk-hero .tk-big{width:190px;height:190px}.tk-hero .tk-big svg{width:100%;height:100%;overflow:visible}",
    ".tk-name{font-family:'Shippori Mincho',serif;font-size:1.35rem;font-weight:800}",
    ".tk-tag{display:inline-block;font-size:.72rem;font-weight:700;color:#fff;border-radius:999px;padding:2px 9px;margin:0 2px}",
    ".tk-soft{color:var(--tk-soft);font-size:.86rem}",
    ".tk-bar{width:100%;max-width:320px;height:10px;border-radius:5px;background:var(--tk-line);overflow:hidden;margin:6px auto 2px}",
    ".tk-bar i{display:block;height:100%;background:linear-gradient(90deg,#e0b43c,#e25c4a)}",
    ".tk-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:16px 0 4px}",
    ".tk-stats div{background:var(--tk-card);border-radius:10px;padding:8px;text-align:center}",
    ".tk-stats b{display:block;font-size:1.2rem;font-variant-numeric:tabular-nums}",
    ".tk-stats span{font-size:.72rem;color:var(--tk-soft)}",
    ".tk-h3{font-weight:700;margin:18px 0 8px;font-size:.95rem}",
    ".tk-goal{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px dashed var(--tk-line);font-size:.88rem}",
    ".tk-goal .tk-ic{width:40px;height:40px;flex:none}.tk-goal .tk-ic svg{width:100%;height:100%}",
    ".tk-goal .tk-g{flex:1}",
    ".tk-btn{display:block;width:100%;border:0;border-radius:12px;padding:14px;font:inherit;font-weight:800;font-size:1.05rem;cursor:pointer;",
    " background:#e0b43c;color:#2a1c04;box-shadow:0 3px 0 #a07a1a}",
    ".tk-btn:disabled{opacity:.45;cursor:not-allowed}",
    ".tk-btn.tk-sub{background:transparent;color:inherit;border:1.5px solid var(--tk-line);box-shadow:none;font-weight:700;font-size:.95rem;padding:10px}",
    ".tk-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}",
    "@media (max-width:380px){.tk-grid{grid-template-columns:repeat(3,1fr)}}",
    ".tk-cell{border:1.5px solid var(--tk-line);background:var(--tk-card);border-radius:12px;padding:4px 2px 6px;text-align:center;cursor:pointer;color:inherit;font:inherit}",
    ".tk-cell svg{width:100%;aspect-ratio:1;overflow:visible}",
    ".tk-cell small{display:block;font-size:.66rem;line-height:1.3;min-height:1.7em}",
    ".tk-cell.tk-on{outline:3px solid #e0b43c}",
    ".tk-cell[disabled]{cursor:default}",
    ".tk-shrine{text-align:center}",
    ".tk-box{width:170px;height:170px;margin:4px auto 10px}.tk-box svg{width:100%;height:100%;overflow:visible}",
    ".tk-shake{animation:tks .7s ease}@keyframes tks{0%,100%{transform:rotate(0)}20%{transform:rotate(-8deg)}40%{transform:rotate(8deg)}60%{transform:rotate(-5deg)}80%{transform:rotate(5deg)}}",
    ".tk-reveal{animation:tkr .6s ease}@keyframes tkr{from{opacity:0;transform:scale(.5) rotate(-10deg)}to{opacity:1;transform:none}}",
    ".tk-new{color:#e25c4a;font-weight:800;letter-spacing:.1em}",
    ".tk-rates{font-size:.76rem;color:var(--tk-soft);margin-top:12px;line-height:1.7}",
    ".tk-note{font-size:.74rem;color:var(--tk-soft);margin-top:16px;line-height:1.7}",
    "@media (prefers-reduced-motion:reduce){.tk-bounce,.tk-pop,.tk-shake,.tk-reveal{animation:none}}"
  ].join("\n");

  function esc(s){ return String(s).replace(/[&<>"]/g, function(m){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]; }); }
  function tag(t, color){ return '<span class="tk-tag" style="background:' + color + '">' + esc(t) + "</span>"; }

  var fab, panelOpen = false, veil, tab = "partner";

  function eggSVG(){
    return '<svg viewBox="0 0 100 100" aria-hidden="true">' + path("M50 10 C24 10 18 50 18 62 C18 82 32 92 50 92 C68 92 82 82 82 62 C82 50 76 10 50 10 Z", "#f6efdc") +
      path("M26 58 L36 50 L44 60 L54 48 L62 58 L74 50", "none", {stroke:"#c08a1e","stroke-width":3}) + el("text", {x:50,y:44,"text-anchor":"middle","font-size":22,"font-weight":800,fill:"#c08a1e"}).replace("/>", ">？</text>") + "</svg>";
  }
  function shrineSVG(){
    return '<svg viewBox="0 0 100 100" aria-hidden="true">' +
      path("M10 30 L50 12 L90 30 Z", "#b0413e") + rect(16,30,68,8,"#8e2a20",2) + rect(22,38,56,48,"#6b4a2a",3) + rect(32,48,36,30,"#2b2630",3) +
      circ(50,63,9,"#e0b43c") + el("text",{x:50,y:67,"text-anchor":"middle","font-size":10,"font-weight":800,fill:"#2b2630"}).replace("/>", ">福</text>") +
      rect(12,86,76,6,"#8e2a20",2) + "</svg>";
  }

  var listeners = [];
  function refreshFab(){
    listeners.forEach(function(fn){ try{ fn(S); }catch(e){} });
    if(!fab) return;
    var face = S.partner ? art(S.partner, stageOf(S.partner)) : eggSVG();
    var ready = S.coins >= R.cost || !S.partner;
    fab.innerHTML = face + '<span class="tk-coin">墨玉 ' + S.coins + "</span>" + (ready ? '<span class="tk-dot"></span>' : "");
    fab.setAttribute("aria-label", (S.partner ? "相棒の" + BY[S.partner].n[stageOf(S.partner)] : "付喪神をえらぶ") + "。墨玉" + S.coins + "枚");
  }
  function bounce(){
    if(!fab) return;
    fab.classList.remove("tk-bounce"); void fab.offsetWidth; fab.classList.add("tk-bounce");
  }
  function flushFx(){
    if(!coinFx) return;
    var d = document.createElement("div");
    d.className = "tk-pop"; d.textContent = "+" + coinFx + " 墨玉";
    coinFx = 0;
    document.body.appendChild(d);
    setTimeout(function(){ d.remove(); }, 1200);
  }

  // ---- パネル
  function openPanel(which){
    tab = which || (S.partner ? "partner" : "starter");
    if(!veil){
      veil = document.createElement("div");
      veil.className = "tk-veil";
      veil.addEventListener("click", function(e){ if(e.target === veil) closePanel(); });
    }
    document.body.appendChild(veil);
    panelOpen = true;
    renderPanel();
  }
  function closePanel(){
    panelOpen = false;
    if(veil && veil.parentNode) veil.parentNode.removeChild(veil);
    if(fab) fab.focus();
  }
  document.addEventListener("keydown", function(e){ if(panelOpen && e.key === "Escape") closePanel(); });

  function shell(title, body, tabs){
    var h = '<div class="tk-panel" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
      '<div class="tk-head"><h2>' + esc(title) + '</h2><button class="tk-x" type="button" data-act="close" aria-label="閉じる">×</button></div>';
    if(tabs){
      h += '<div class="tk-tabs" role="tablist">' + [["partner","相棒"],["gacha","ガチャ"],["zukan","図鑑"]].map(function(t){
        return '<button type="button" role="tab" data-tab="' + t[0] + '" aria-selected="' + (tab === t[0]) + '">' + t[1] + "</button>";
      }).join("") + "</div>";
    }
    return h + body + "</div>";
  }

  function renderPanel(){
    if(!veil) return;
    var html;
    if(tab === "starter") html = shell("最初の相棒をえらぶ", starterHTML(), false);
    else if(tab === "gacha") html = shell("付喪神ガチャ", gachaHTML(), true);
    else if(tab === "zukan") html = shell("付喪神図鑑", zukanHTML(), true);
    else html = shell("相棒", partnerHTML(), true);
    veil.innerHTML = html;
    wire();
    var first = veil.querySelector("[data-tab][aria-selected=true]") || veil.querySelector("button");
    if(first) first.focus();
  }

  function starterHTML(){
    return '<p class="tk-soft" style="margin-top:0">道具に宿る小さな神さま「付喪神」。問題に正解するたびに相棒が育ち、墨玉がたまります。' +
      "墨玉でガチャを回すと仲間が増えます。まずは相棒を1体えらんでください。</p>" +
      '<div class="tk-grid" style="grid-template-columns:repeat(3,1fr)">' + STARTERS.map(function(id){
        var c = BY[id];
        return '<button type="button" class="tk-cell" data-starter="' + id + '">' + art(id, 0) + "<small><b>" + esc(c.n[0]) + "</b><br>" + SUBJ[c.subj].label + "</small></button>";
      }).join("") + "</div>" +
      (S.pendingXp ? '<p class="tk-soft">これまでに解いた分の経験（' + Math.round(S.pendingXp) + "）も、えらんだ相棒に入ります。</p>" : "") +
      note();
  }

  function partnerHTML(){
    if(!S.partner) return starterHTML();
    var id = S.partner, c = BY[id], st = stageOf(id), xp = Math.floor(S.owned[id].xp), th = R.stages[c.r];
    var nextTxt, pct;
    if(st < 2){ pct = Math.round((xp - th[st]) / (th[st+1] - th[st]) * 100); nextTxt = "次の姿まで あと " + Math.ceil(th[st+1] - S.owned[id].xp) + " 経験"; }
    else { pct = 100; nextTxt = "最終の姿（神格）に到達"; }
    var h = '<div class="tk-hero"><div class="tk-big">' + art(id, st) + "</div>" +
      '<div class="tk-name">' + esc(c.n[st]) + "</div>" +
      "<div>" + tag(RARITY[c.r].label, RARITY[c.r].color) + tag(SUBJ[c.subj].label, SUBJ[c.subj].color) + tag(STAGE_LABEL[st], "#7a7060") + "</div>" +
      '<div class="tk-bar" aria-hidden="true"><i style="width:' + pct + '%"></i></div><div class="tk-soft">' + nextTxt + "（経験 " + xp + "）</div>" +
      '<p style="margin:10px 0 0;font-size:.9rem">' + esc(c.f) + "</p>" +
      (c.subj !== "all" ? '<p class="tk-soft" style="margin:4px 0 0">' + SUBJ[c.subj].label + "の問題を解くと、経験が1.5倍になります。</p>" : "") +
      "</div>";
    h += '<div class="tk-stats"><div><b>' + S.total.correct + "</b><span>通算の正解</span></div><div><b>" + S.days.length + "</b><span>学習した日</span></div><div><b>" +
      Object.keys(S.owned).length + "<small>/" + CHARS.length + "</small></b><span>図鑑</span></div></div>";
    h += '<div class="tk-h3">秘の付喪神（やりこむと現れる）</div>';
    CHARS.filter(function(x){ return x.r === "hi"; }).forEach(function(x){
      var got = !!S.owned[x.id], p = x.prog(S);
      h += '<div class="tk-goal"><div class="tk-ic">' + art(x.id, 0, {silhouette: !got}) + '</div><div class="tk-g">' +
        (got ? "<b>" + esc(x.n[stageOf(x.id)]) + "</b> が仲間になった" : "<b>？？？</b> ― " + esc(x.how)) +
        '</div><div class="tk-soft">' + (got ? "達成" : Math.min(p[0], p[1]) + " / " + p[1]) + "</div></div>";
    });
    return h + note();
  }

  function gachaHTML(){
    var can = S.coins >= R.cost;
    var h = '<div class="tk-shrine"><div class="tk-box" id="tk-box">' + shrineSVG() + "</div>" +
      '<div style="font-size:1.1rem;font-weight:800">墨玉 ' + S.coins + " 枚</div>" +
      '<p class="tk-soft" style="margin:2px 0 12px">1回 ' + R.cost + " 枚。" + (SUBJECT === "all" ? "古文・漢文・現代文の付喪神が同じ割合で出ます。" : "いま開いている" + SUBJ[SUBJECT].label + "の付喪神が出やすくなっています。") + "</p>" +
      '<button type="button" class="tk-btn" data-act="pull"' + (can ? "" : " disabled") + ">" + (can ? "ガチャを回す（" + R.cost + "枚）" : "あと " + (R.cost - S.coins) + " 枚で回せます") + "</button>" +
      '<div id="tk-result" aria-live="polite"></div>' +
      '<div class="tk-rates">出る確率　並 ' + R.rates.nami + "%・珍 " + R.rates.chin + "%・稀 " + R.rates.ki + "%<br>" +
      "稀が出ないまま " + R.pity + " 回目は必ず稀（いま " + S.pity + " 回）<br>" +
      "持っている付喪神が出たときは「かけら」になり、その子の経験が増えます。<br>" +
      "墨玉は 正解1問で" + R.coinPerCorrect + "枚・1セット解き終えて" + R.coinSet + "枚・全問正解で+" + R.coinPerfect + "枚・その日最初のセットで+" + R.coinFirstOfDay + "枚。" +
      "問題から得られるのは1日" + R.dailyAnswerCap + "枚まで（今日 " + (S.today.d === today() ? S.today.coins : 0) + " 枚）。</div></div>";
    return h + note();
  }

  function zukanHTML(){
    var h = '<p class="tk-soft" style="margin-top:0">' + Object.keys(S.owned).length + " / " + CHARS.length + " 種。えらんだ子が相棒になり、正解のたびに育ちます。</p>";
    ["kobun","kanbun","gendai","all"].forEach(function(k){
      h += '<div class="tk-h3">' + (k === "all" ? "秘" : SUBJ[k].label) + "</div><div class=\"tk-grid\">";
      CHARS.filter(function(c){ return c.subj === k; }).forEach(function(c){
        var o = S.owned[c.id];
        if(o){
          var st = stageOf(c.id);
          h += '<button type="button" class="tk-cell' + (S.partner === c.id ? " tk-on" : "") + '" data-pick="' + c.id + '" aria-label="' + esc(c.n[st]) + 'を相棒にする">' +
            art(c.id, st) + "<small><b>" + esc(c.n[st]) + "</b><br>" + RARITY[c.r].label + "・" + STAGE_LABEL[st] + "</small></button>";
        } else {
          h += '<button type="button" class="tk-cell" disabled aria-label="まだ出会っていない">' + art(c.id, 0, {silhouette:true}) + "<small>？？？<br>" + RARITY[c.r].label + "</small></button>";
        }
      });
      h += "</div>";
    });
    return h + note();
  }

  function note(){
    return '<p class="tk-note">付喪神の記録は、この端末のブラウザの中だけに残ります（現代文・古文・漢文の道場で共通）。' +
      "先生や他の人に送られることはありません。ブラウザのサイトデータを消すと、図鑑も消えます。" +
      (canSave ? "" : "<br><b>このブラウザでは記録を保存できない設定になっています。</b>") + "</p>";
  }

  function wire(){
    veil.querySelectorAll("[data-act=close]").forEach(function(b){ b.onclick = closePanel; });
    veil.querySelectorAll("[data-tab]").forEach(function(b){ b.onclick = function(){ tab = b.getAttribute("data-tab"); renderPanel(); }; });
    veil.querySelectorAll("[data-starter]").forEach(function(b){
      b.onclick = function(){
        var id = b.getAttribute("data-starter");
        obtain(id, "starter");
        S.partner = id;
        if(S.pendingXp){ giveXp(id, S.pendingXp); S.pendingXp = 0; }
        checkSecrets(); save(); refreshFab();
        tab = "partner"; renderPanel(); showQueue();
      };
    });
    veil.querySelectorAll("[data-pick]").forEach(function(b){
      b.onclick = function(){ S.partner = b.getAttribute("data-pick"); save(); refreshFab(); tab = "partner"; renderPanel(); };
    });
    var pb = veil.querySelector("[data-act=pull]");
    if(pb) pb.onclick = function(){
      pb.disabled = true;
      var box = document.getElementById("tk-box"), out = document.getElementById("tk-result");
      box.classList.remove("tk-shake"); void box.offsetWidth; box.classList.add("tk-shake");
      var res = pull();
      setTimeout(function(){
        if(!res){ renderPanel(); return; }
        var c = BY[res.id], st = stageOf(res.id);
        renderPanel();
        var o2 = document.getElementById("tk-result");
        o2.innerHTML = '<div class="tk-reveal" style="margin-top:14px"><div style="width:150px;height:150px;margin:0 auto">' + art(res.id, st) + "</div>" +
          (res.isNew ? '<div class="tk-new">NEW！</div>' : '<div class="tk-soft">かけら → 経験 +' + res.xp + "</div>") +
          '<div class="tk-name">' + esc(c.n[st]) + "</div><div>" + tag(RARITY[c.r].label, RARITY[c.r].color) + tag(SUBJ[c.subj].label, SUBJ[c.subj].color) + "</div>" +
          '<p style="font-size:.88rem;margin:6px 0">' + esc(c.f) + "</p>" +
          (res.isNew ? '<button type="button" class="tk-btn tk-sub" data-pick="' + res.id + '">この子を相棒にする</button>' : "") + "</div>";
        wire();
        showQueue();
      }, 750);
    };
  }

  // ---- 進化・秘の知らせ
  function showQueue(){
    if(!queue.length || panelOpen) { if(queue.length && panelOpen) setTimeout(showQueue, 600); return; }
    var ev = queue.shift(), c = BY[ev.id];
    openPanel("partner");
    var body;
    if(ev.kind === "evolve"){
      body = '<div class="tk-hero"><p class="tk-soft" style="margin:0">' + esc(c.n[ev.from]) + " の様子が…？</p>" +
        '<div class="tk-big tk-reveal">' + art(ev.id, ev.to) + '</div><div class="tk-new">進化！</div>' +
        '<div class="tk-name">' + esc(c.n[ev.to]) + "</div><div>" + tag(STAGE_LABEL[ev.to], "#7a7060") + "</div></div>";
    } else {
      body = '<div class="tk-hero"><p class="tk-soft" style="margin:0">やりこみの証に、秘の付喪神が現れた！</p>' +
        '<div class="tk-big tk-reveal">' + art(ev.id, 0) + '</div><div class="tk-name">' + esc(c.n[0]) + "</div><div>" + tag("秘", RARITY.hi.color) + "</div>" +
        '<p style="font-size:.9rem">' + esc(c.f) + "</p>" +
        '<button type="button" class="tk-btn tk-sub" data-pick="' + ev.id + '">この子を相棒にする</button></div>';
    }
    veil.innerHTML = shell(ev.kind === "evolve" ? "進化" : "秘の付喪神", body + '<button type="button" class="tk-btn" style="margin-top:14px" data-act="close">とじる</button>', false);
    wire();
    var b = veil.querySelector("[data-act=close].tk-btn"); if(b){ b.focus(); b.onclick = function(){ closePanel(); showQueue(); }; }
  }

  function mount(){
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    fab = document.createElement("button");
    fab.type = "button"; fab.className = "tk-fab";
    fab.addEventListener("click", function(){ openPanel(); });
    document.body.appendChild(fab);
    document.body.classList.add("tk-pad");
    rollDay();
    refreshFab();
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();

  // 国語道場トップが説明と相棒の欄を描くのに使う（ルールの数字を二重に書かないため）
  window.Tsukumo = { answer: answer, finish: finish, open: openPanel, stageOf: stageOf, onChange: function(fn){ listeners.push(fn); fn(S); },
                     rules: R, rarity: RARITY, stageLabel: STAGE_LABEL, _art: art, _chars: CHARS, _state: function(){ return S; } };
})();
