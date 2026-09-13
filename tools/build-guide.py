#!/usr/bin/env python3
"""学習ガイドの原稿から、ガイドのページ（guide/<code>.html）と一覧（guide/index.html）を作る。

    python3 tools/build-guide.py            # guide/src/*.md をすべて
    python3 tools/build-guide.py kindai

動画は tools/build-video.py が別に作る。ここでは guide/<code>.mp4 があれば埋め込む。
"""
import html, pathlib, re, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import guide_src as G

ROOT = G.ROOT
GUIDE = ROOT / "guide"
SITE = "渡邊梢太の現代文キーワード辞典"
e = html.escape

TOKENS = """
:root{--paper:#F2F2EE;--surface:#FBFBF8;--surface-2:#E9EAE4;--ink:#17202A;--ink-2:#4A5560;--ink-3:#7B848D;
  --rule:#D6D8D0;--rule-2:#C3C6BD;--ai:#27466F;--ai-soft:#E1E8F1;--shu:#B0442C;--shu-soft:#F4E2DD;
  --serif:"Shippori Mincho B1","Hiragino Mincho ProN","Yu Mincho",serif;
  --sans:"Zen Kaku Gothic New","Hiragino Sans","Yu Gothic",system-ui,sans-serif;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--paper:#12161A;--surface:#1A1F25;
  --surface-2:#232A31;--ink:#E7E9E4;--ink-2:#AEB6BD;--ink-3:#7E878F;--rule:#2C343B;--rule-2:#3A434B;
  --ai:#8FB0D8;--ai-soft:#1D293A;--shu:#E08265;--shu-soft:#38231C}}
:root[data-theme="dark"]{--paper:#12161A;--surface:#1A1F25;--surface-2:#232A31;--ink:#E7E9E4;--ink-2:#AEB6BD;
  --ink-3:#7E878F;--rule:#2C343B;--rule-2:#3A434B;--ai:#8FB0D8;--ai-soft:#1D293A;--shu:#E08265;--shu-soft:#38231C}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.9;
  font-feature-settings:"palt" 1;-webkit-font-smoothing:antialiased}
.wrap{max-width:780px;margin:0 auto;padding:0 20px 90px}
a{color:var(--ai)}
.top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;
  padding:22px 0 14px;font-size:13px;color:var(--ink-3)}
.top a{text-decoration:none}
h1{font-family:var(--serif);font-size:clamp(28px,5.4vw,42px);line-height:1.3;letter-spacing:.04em;margin:8px 0 0}
.kicker{font-size:12.5px;letter-spacing:.16em;color:var(--shu);font-weight:700}
.lead{color:var(--ink-2);margin:12px 0 0}
hr.rule{border:0;border-top:2px solid var(--ink);margin:22px 0 26px}
"""
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@500;700'
         '&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap">')
THEME = ('<script>try{var t=localStorage.getItem("gendaibun-kw-theme");'
         'if(t)document.documentElement.setAttribute("data-theme",t);}catch(e){}</script>')

PAGE_CSS = """
.video{margin:0 0 30px;background:#000;border-radius:6px;overflow:hidden;aspect-ratio:16/9}
.video video{display:block;width:100%;height:100%}
.vnote{font-size:12.5px;color:var(--ink-3);margin:-20px 0 30px}
.toc{background:var(--surface);border:1px solid var(--rule);border-radius:6px;padding:16px 20px;margin-bottom:34px}
.toc b{display:block;font-size:12px;letter-spacing:.14em;color:var(--ink-3);margin-bottom:4px}
.toc ol{margin:0;padding-left:0;list-style:none;columns:2;column-gap:28px}
.toc li{font-size:14.5px;break-inside:avoid}
.toc a{text-decoration:none;color:var(--ink)}
.toc a:hover{color:var(--ai)}
section.ch{margin-top:44px;scroll-margin-top:16px}
section.ch h2{font-family:var(--serif);font-size:25px;letter-spacing:.05em;line-height:1.4;margin:0 0 12px;
  padding-bottom:8px;border-bottom:1px solid var(--rule)}
.chips{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 14px}
.chips a{font-size:13px;text-decoration:none;color:var(--ink-2);background:var(--surface);
  border:1px solid var(--rule);border-radius:999px;padding:2px 12px}
.chips a:hover{border-color:var(--ai);color:var(--ai)}
p{margin:0 0 14px}
a.kw{color:inherit;font-weight:700;text-decoration:none;background:linear-gradient(transparent 64%,var(--ai-soft) 64%)}
a.kw:hover{color:var(--ai)}
.cx{display:grid;grid-template-columns:1fr auto 1fr;gap:10px 14px;align-items:center;background:var(--surface);
  border:1px solid var(--rule);border-radius:6px;padding:14px 18px;margin:18px 0 8px}
.cx .s{font-family:var(--serif);font-size:20px;font-weight:700;text-align:center}
.cx .s a{color:inherit;text-decoration:none}
.cx .v{color:var(--shu);font-weight:700;font-size:20px}
.cx .n{grid-column:1/-1;font-size:13.5px;color:var(--ink-2);text-align:center;line-height:1.7}
.quote{border-left:3px solid var(--shu);padding:6px 0 6px 16px;margin:18px 0 0}
.quote b{display:block;font-size:11.5px;letter-spacing:.16em;color:var(--shu)}
.quote span{font-family:var(--serif);font-size:17px}
.acts{margin-top:46px;padding-top:20px;border-top:1px solid var(--rule);display:flex;gap:10px;flex-wrap:wrap}
.acts a{font-size:14px;text-decoration:none;border:1px solid var(--rule-2);border-radius:4px;padding:8px 16px;
  color:var(--ink);background:var(--surface)}
.acts a.main{background:var(--ai);color:var(--paper);border-color:var(--ai);font-weight:700}
@media(max-width:560px){.toc ol{columns:1}.cx .s{font-size:18px}}
"""


def link(w):
    return f'<a class="kw" href="../?w={e(w)}">{e(w)}</a>'


def rich(text):
    return G.KEY.sub(lambda m: link(m.group(1)), e(text))


def page(doc, words):
    code, title = doc["code"], doc["title"]
    mp4, vtt, poster = GUIDE / f"{code}.mp4", GUIDE / f"{code}.vtt", GUIDE / f"{code}-poster.jpg"
    video, mins = "", ""
    if vtt.exists():   # 長さは字幕の最後の時刻から出す（.vtt はコミットするので、どこで作り直しても同じになる）
        st = re.findall(r"--> (\d+):(\d+):([\d.]+)", vtt.read_text(encoding="utf-8"))
        if st:
            h, m, sec = st[-1]
            mins = f"約{round((int(h) * 3600 + int(m) * 60 + float(sec)) / 60)}分・"
    if mp4.exists():
        video = (f'<div class="video"><video controls playsinline preload="metadata"'
                 f'{f" poster={chr(34)}{poster.name}{chr(34)}" if poster.exists() else ""}>'
                 f'<source src="{mp4.name}" type="video/mp4">'
                 + (f'<track kind="subtitles" srclang="ja" label="日本語" src="{vtt.name}" default>' if vtt.exists() else "")
                 + '</video></div>'
                 f'<p class="vnote">{mins}字幕つき。動画だけは通信が必要です（本文は電波がなくても読めます）。</p>')
    toc = "".join(f'<li><a href="#{e(c["id"])}">{e(c["title"])}</a></li>' for c in doc["chapters"])
    chs = []
    for c in doc["chapters"]:
        chips = "".join(f'<a href="../?w={e(w)}">{e(w)}</a>' for w in c["words"])
        cx = "".join(
            f'<div class="cx"><div class="s">{link(x[0]) if x[0] in words else e(x[0])}</div><div class="v">⇔</div>'
            f'<div class="s">{link(x[1]) if len(x) > 1 and x[1] in words else e(x[1] if len(x) > 1 else "")}</div>'
            + (f'<div class="n">{e(x[2])}</div>' if len(x) > 2 else "") + "</div>"
            for x in c["contrasts"])
        qs = "".join(f'<div class="quote"><b>評論ではこう出る</b><span>{rich(q)}</span></div>' for q in c["quotes"])
        chs.append(f'<section class="ch" id="{e(c["id"])}"><h2>{e(c["title"])}</h2>'
                   + (f'<div class="chips">{chips}</div>' if chips else "")
                   + "".join(f"<p>{rich(p)}</p>" for p in c["guide"]) + cx + qs + "</section>")
    return (f'<!doctype html><html lang="ja"><head><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>{e(title)}｜学習ガイド｜{SITE}</title>'
            f'<meta name="description" content="{e(doc["lead"])}">{THEME}{FONTS}'
            f'<style>{TOKENS}{PAGE_CSS}</style></head><body><div class="wrap">'
            f'<div class="top"><a href="./">← 学習ガイドの一覧</a><a href="../">{SITE}</a></div>'
            f'<div class="kicker">学習ガイド</div><h1>{e(title)}</h1><p class="lead">{e(doc["lead"])}</p>'
            f'<hr class="rule">{video}<nav class="toc"><b>目次</b><ol>{toc}</ol></nav>{"".join(chs)}'
            f'<div class="acts"><a class="main" href="../?c={code}&amp;v=card">この分野を暗記カードで</a>'
            f'<a href="../?c={code}&amp;v=quiz">四択テストで確かめる</a><a href="../?c={code}">辞典で見る</a></div>'
            f'</div></body></html>')


def index(built):
    src = (ROOT / "index.html").read_text(encoding="utf-8")
    cats = re.findall(r'\{id:"(\w+)",\s*name:"([^"]+)"', src)
    counts = {}
    for d in G.load_dict().values():
        counts[d["c"]] = counts.get(d["c"], 0) + 1
    items = []
    for cid, name in cats:
        if cid in built:
            items.append(f'<li><a href="{cid}.html"><b>{e(name)}</b><span>{counts.get(cid, 0)}語・動画つき</span></a></li>')
        else:
            items.append(f'<li class="off"><b>{e(name)}</b><span>{counts.get(cid, 0)}語・準備中</span></li>')
    css = """.list{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.list li a,.list li.off{display:flex;justify-content:space-between;align-items:baseline;gap:12px;
  padding:16px 18px;border:1px solid var(--rule);border-radius:6px;background:var(--surface);text-decoration:none;color:var(--ink)}
.list li a:hover{border-color:var(--ai)}
.list b{font-family:var(--serif);font-size:19px;letter-spacing:.04em}
.list span{font-size:13px;color:var(--ink-3)}
.list li.off{opacity:.55}"""
    return (f'<!doctype html><html lang="ja"><head><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>学習ガイド｜{SITE}</title>{THEME}{FONTS}<style>{TOKENS}{css}</style></head><body><div class="wrap">'
            f'<div class="top"><a href="../">← {SITE}</a></div>'
            f'<div class="kicker">学習ガイド</div><h1>分野ごとの考え方の流れ</h1>'
            f'<p class="lead">キーワードを覚える前に、語と語がどうつながっているかを読む。解説動画もついています。</p>'
            f'<hr class="rule"><ul class="list">{"".join(items)}</ul></div></body></html>')


def main():
    words = G.load_dict()
    srcs = sorted((GUIDE / "src").glob("*.md"))
    if len(sys.argv) > 1:
        srcs = [GUIDE / "src" / f"{a}.md" for a in sys.argv[1:]]
    built = []
    for s in srcs:
        doc = G.parse(s)
        ng, _ = G.check(doc, words)
        if ng:
            raise SystemExit(f"{s.name} に問題があります:\n  " + "\n  ".join(ng))
        out = GUIDE / f"{doc['code']}.html"
        out.write_text(page(doc, words), encoding="utf-8")
        built.append(doc["code"]); print(f"{out.relative_to(ROOT)}")
    all_built = sorted({p.stem for p in (GUIDE / "src").glob("*.md")})
    (GUIDE / "index.html").write_text(index(all_built), encoding="utf-8")
    print("guide/index.html")


if __name__ == "__main__":
    main()
