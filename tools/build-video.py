#!/usr/bin/env python3
"""学習ガイドの原稿から、合成音声ナレーション付きの解説動画（MP4・字幕付き）を作る。

    python3 tools/build-video.py guide/src/kindai.md            # 動画まで
    python3 tools/build-video.py guide/src/kindai.md --slides   # スライド画像だけ（見た目の確認用）
    python3 tools/build-video.py guide/src/kindai.md --voice Kyoko --rate 165
    python3 tools/build-video.py guide/src/kindai.md --voice system   # 「システムの声」（Siriの声など）

出力: guide/<code>.mp4（字幕トラック入り）と guide/<code>.vtt（ページの <track> 用）
中間: guide/.work/<code>/ に置き、中身が変わっていないスライドや音声は作り直さない。

使う道具はすべてこの Mac に既にあるもの（新しく入れない）:
  - スライド: ヘッドレス Chrome で HTML を 1920x1080 に撮る
  - 音声:     macOS の say
  - 動画:     ffmpeg（議事録自動化の環境から借用）
"""
import argparse, hashlib, html, json, pathlib, re, shutil, subprocess, sys, time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import guide_src as G

ROOT = G.ROOT
FFMPEG = pathlib.Path("/Users/syota/Documents/00 Claude Code/09 ICT関係/議事録自動化/.bin/ffmpeg")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SITE = "渡邊梢太の現代文キーワード辞典"
LEAD_IN, TAIL = 0.35, 0.75       # 各スライドの、話し始めまでの間と話し終えてからの間（秒）

CSS = """
html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#F2F2EE;color:#17202A;
  font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN",sans-serif;font-feature-settings:"palt" 1}
.serif{font-family:"Hiragino Mincho ProN",serif}
.hd{position:absolute;left:120px;right:120px;top:64px;display:flex;justify-content:space-between;
  align-items:baseline;border-bottom:3px solid #17202A;padding-bottom:18px}
.hd .f{font-size:30px;color:#7B848D;letter-spacing:.12em}
.hd .c{font-size:38px;font-weight:700;letter-spacing:.06em;margin-left:28px;color:#17202A}
.hd .s{font-size:24px;color:#7B848D;letter-spacing:.08em}
.main{position:absolute;left:120px;right:120px;top:190px;height:690px;display:flex;
  align-items:center;justify-content:center}
.bar{position:absolute;left:0;bottom:0;height:10px;background:#27466F}
.track{position:absolute;left:0;right:0;bottom:0;height:10px;background:#E1E2DC}
/* title */
.t{display:flex;flex-direction:column;align-items:flex-start;width:100%;padding-left:40px}
.t .n{font-size:150px;font-weight:700;color:#B0442C;line-height:1}
.t .h{font-size:118px;font-weight:700;letter-spacing:.05em;line-height:1.3;margin-top:36px}
/* words */
.ws{display:grid;gap:48px;width:100%}
.card{background:#FBFBF8;border:2px solid #D6D8D0;border-left:12px solid #5B4780;border-radius:8px;
  padding:44px 50px;box-shadow:0 10px 30px -18px rgba(23,32,42,.35)}
.card .r{font-size:30px;color:#7B848D;letter-spacing:.18em}
.card .w{font-weight:700;line-height:1.25;letter-spacing:.04em;margin:6px 0 22px;white-space:nowrap}
.card .m{line-height:1.6;color:#2B343D}
/* flow */
.fl{display:flex;align-items:center;justify-content:center;gap:34px;flex-wrap:nowrap;width:100%}
.fl .b{border:4px solid #17202A;border-radius:14px;padding:40px 44px;font-weight:700;
  background:#FBFBF8;text-align:center;line-height:1.35}
.fl .a{font-size:84px;color:#B0442C;font-weight:700}
/* contrast */
.cx{display:grid;grid-template-columns:1fr 150px 1fr;align-items:center;width:100%}
.cxw{width:100%;display:flex;flex-direction:column;gap:40px}
.cxw .nt{text-align:center;font-size:44px;color:#27466F;font-weight:700;letter-spacing:.04em}
.cx .p{background:#FBFBF8;border:2px solid #D6D8D0;border-radius:10px;padding:48px 50px;min-height:360px;
  display:flex;flex-direction:column;justify-content:center}
.cx .p .r{font-size:30px;color:#7B848D;letter-spacing:.16em}
.cx .p .w{font-weight:700;line-height:1.2;margin:8px 0 22px;white-space:nowrap}
.cx .p .m{font-size:36px;line-height:1.6;color:#2B343D}
.cx .v{font-size:100px;color:#B0442C;text-align:center;font-weight:700}
/* quote */
.q{width:100%;padding-left:40px}
.q .l{font-size:40px;color:#B0442C;font-weight:700;letter-spacing:.2em;margin-bottom:40px}
.q .s{font-size:76px;font-weight:700;line-height:1.6;border-left:14px solid #B0442C;padding-left:56px;
  letter-spacing:.02em}
"""
# ウェブフォントは使わない。ヘッドレス Chrome の --screenshot は読み込み完了を待たずに撮ることがあり、
# 6枚同時に撮ると一部が文字の無い空白になった（実測）。システムフォントなら待ちが発生しない。
FONTS = ""
e = html.escape


def fit(base, width, text, em=1.06):
    """1行に収まる最大の文字サイズ（全角1字をおよそ em 倍の幅とみなす）。"""
    return max(28, min(base, int(width / (len(text) * em))))


def word_card(d, size, cols):
    ws, ms = {1: (150, 50), 2: (104, 38), 3: (84, 32)}.get(size, (76, 30))
    inner = (1400 if size == 1 else (1680 - 48 * (cols - 1)) / cols) - 118
    ws = fit(ws, inner, d["w"])
    return (f'<div class="card"><div class="r">{e(d["r"])}</div>'
            f'<div class="w serif" style="font-size:{ws}px">{e(d["w"])}</div>'
            f'<div class="m" style="font-size:{ms}px">{e(d["m"])}</div></div>')


def slide_html(doc, ch, sc, words, i, total):
    t, a = sc["type"], sc["args"]
    if t == "title":
        head = a[1] if len(a) > 1 else ""
        body = (f'<div class="t serif"><div class="n">{e(a[0])}</div>'
                f'<div class="h" style="font-size:{fit(118, 1600, head)}px">{e(head)}</div></div>')
    elif t == "words":
        n = len(a)
        cols = 1 if n == 1 else (2 if n in (2, 4) else 3)
        body = (f'<div class="ws" style="grid-template-columns:repeat({cols},1fr);'
                f'{"max-width:1400px" if n == 1 else ""}">'
                + "".join(word_card(words[w], n, cols) for w in a) + "</div>")
    elif t == "flow":
        long_ = max(len(x) for x in a)
        fs = 64 if long_ <= 4 else (50 if long_ <= 8 else 40)
        parts = []
        for k, x in enumerate(a):
            if k: parts.append('<div class="a">→</div>')
            parts.append(f'<div class="b" style="font-size:{fs}px">{e(x)}</div>')
        body = f'<div class="fl">{"".join(parts)}</div>'
    elif t == "contrast":
        def side(x):
            d = words.get(x)
            if d:
                return (f'<div class="p"><div class="r">{e(d["r"])}</div>'
                        f'<div class="w serif" style="font-size:{fit(96, 655, x)}px">{e(x)}</div>'
                        f'<div class="m">{e(d["m"])}</div></div>')
            return (f'<div class="p"><div class="w serif" style="text-align:center;font-size:{fit(96, 655, x)}px">'
                    f'{e(x)}</div></div>')
        body = (f'<div class="cxw"><div class="cx">{side(a[0])}<div class="v">⇔</div>{side(a[1])}</div>'
                + (f'<div class="nt">{e(a[2])}</div>' if len(a) > 2 else "") + "</div>")
    elif t == "quote":
        body = (f'<div class="q"><div class="l">{e(a[0])}</div>'
                f'<div class="s serif">{e(a[1] if len(a) > 1 else "")}</div></div>')
    else:
        raise SystemExit(f"未知のスライド種類: {t}")
    return (f'<!doctype html><html lang="ja"><head><meta charset="utf-8">{FONTS}<style>{CSS}</style></head><body>'
            f'<div class="hd"><div><span class="f">{e(doc["title"])}</span>'
            f'<span class="c serif">{e(ch["title"])}</span></div><div class="s">{e(SITE)}</div></div>'
            f'<div class="main">{body}</div>'
            f'<div class="track"></div><div class="bar" style="width:{(i + 1) / total * 100:.2f}%"></div>'
            f'</body></html>')


def h8(s):
    return hashlib.sha1(s.encode("utf-8")).hexdigest()[:8]


def shoot(jobs, work):
    """[(html_path, png_path)] をヘッドレス Chrome で撮る。前面で待つと返らないため、背景で起こして待つ。"""
    for k in range(0, len(jobs), 6):
        batch, procs = jobs[k:k + 6], []
        for j, (src, png) in enumerate(batch):
            prof = work / f"prof{j}"
            shutil.rmtree(prof, ignore_errors=True)
            procs.append((subprocess.Popen(
                [CHROME, "--headless=new", "--disable-gpu", "--no-first-run", f"--user-data-dir={prof}",
                 "--hide-scrollbars", "--force-device-scale-factor=1", "--window-size=1920,1080",
                 f"--screenshot={png}", src.as_uri()],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL), png))
        deadline = time.time() + 60
        while time.time() < deadline and not all(p.exists() and p.stat().st_size > 0 for _, p in procs):
            time.sleep(0.5)
        time.sleep(1.0)
        for pr, _ in procs:
            pr.kill()
        miss = [str(p) for _, p in procs if not p.exists()]
        if miss:
            raise SystemExit("スライドを撮れませんでした: " + ", ".join(miss))
        print(f"  スライド {min(k + 6, len(jobs))}/{len(jobs)}", flush=True)


def blank(png):
    """見出し帯（左上の分野名あたり）に濃い画素が1つも無ければ、文字が描かれていないとみなす。"""
    raw = subprocess.run([str(FFMPEG), "-hide_banner", "-loglevel", "error", "-i", str(png), "-vf",
                          "crop=900:48:120:62,format=gray,scale=180:12:flags=area", "-f", "rawvideo", "-"],
                         capture_output=True).stdout
    return not raw or min(raw) > 200


def duration(path):
    out = subprocess.run([str(FFMPEG), "-hide_banner", "-i", str(path)], capture_output=True, text=True).stderr
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", out)
    return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))


def ff(*args):
    r = subprocess.run([str(FFMPEG), "-hide_banner", "-loglevel", "error", "-y", *map(str, args)],
                       capture_output=True, text=True)
    if r.returncode:
        raise SystemExit("ffmpeg が失敗しました:\n" + r.stderr[-2000:])


def cues(text, start, dur):
    """ナレーションを句点で区切り、字数に比例して時間を割り振る。長い文は読点でさらに割る。"""
    parts = []
    for sent in [x + "。" for x in text.split("。") if x.strip()]:
        if len(sent) <= 44:
            parts.append(sent); continue
        buf = ""
        for piece in re.split(r"(?<=、)", sent):
            if buf and len(buf) + len(piece) > 40:
                parts.append(buf); buf = ""
            buf += piece
        if buf: parts.append(buf)
    total = sum(len(p) for p in parts) or 1
    t, out = start, []
    for p in parts:
        d = dur * len(p) / total
        out.append((t, t + d, p)); t += d
    return out


def ts(sec, sep):
    h, r = divmod(sec, 3600); m, s = divmod(r, 60)
    return f"{int(h):02d}:{int(m):02d}:{s:06.3f}".replace(".", sep)


def system_voice(work, rate):
    """「システムの声」の指紋を返す。

    Siri の声は say -v で名前を指定できず、システムの声に設定したときだけ
    声指定なしの say で使われる。設定を変えると同じ台本でも別の声になるため、
    短い試し読みの中身から指紋を作り、音声の作り置きの鍵に混ぜる。
    また、うっかり Kyoko に戻したまま作ると気づけないので、そのときは止める。
    """
    probe, ref = work / "probe-system.aiff", work / "probe-kyoko.aiff"
    subprocess.run(["say", "-r", str(rate), "-o", str(probe), "近代の主体と客体"], check=True)
    subprocess.run(["say", "-v", "Kyoko", "-r", str(rate), "-o", str(ref), "近代の主体と客体"], check=True)
    if probe.read_bytes() == ref.read_bytes():
        raise SystemExit("システムの声が Kyoko になっています。設定 → アクセシビリティ → 読み上げコンテンツ → "
                         "システムの声 を Siri の声に戻してから、もう一度実行してください。")
    return "system-" + hashlib.sha1(probe.read_bytes()).hexdigest()[:8]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("--voice", default="system",
                    help="system＝システムの声（Siriの声2など）。Kyoko などの名前も指定できる")
    ap.add_argument("--rate", type=int, default=165)
    ap.add_argument("--slides", action="store_true", help="スライド画像だけ作る")
    o = ap.parse_args()

    words = G.load_dict()
    doc = G.parse(o.src)
    ng, _ = G.check(doc, words)
    if ng:
        raise SystemExit("原稿に問題があります。先に python3 tools/guide_src.py で直してください:\n  " + "\n  ".join(ng))
    code = doc["code"]
    work = ROOT / "guide" / ".work" / code
    work.mkdir(parents=True, exist_ok=True)
    scenes = [(ch, sc) for ch in doc["chapters"] for sc in ch["scenes"]]
    N = len(scenes)

    print(f"{doc['title']}: スライド {N} 枚", flush=True)
    pngs, jobs = [], []
    for i, (ch, sc) in enumerate(scenes):
        page = slide_html(doc, ch, sc, words, i, N)
        base = work / f"{i + 1:02d}-{h8(page)}"
        src, png = base.with_suffix(".html"), base.with_suffix(".png")
        if not png.exists():
            src.write_text(page, encoding="utf-8"); jobs.append((src, png))
        pngs.append(png)
    if jobs: shoot(jobs, work)
    else: print("  スライドはすべて作成済み")
    for attempt in range(2):
        bad = [(pathlib.Path(str(p)[:-4] + ".html"), p) for p in pngs if blank(p)]
        if not bad: break
        print(f"  文字の写っていないスライド {len(bad)} 枚を撮り直します: " + ", ".join(p.name[:2] for _, p in bad))
        for src, p in bad:
            p.unlink()
            if not src.exists():
                raise SystemExit(f"撮り直し用の HTML がありません: {src}")
        shoot(bad, work)
    else:
        raise SystemExit("撮り直しても文字の無いスライドが残りました")
    poster = ROOT / "guide" / f"{code}-poster.jpg"
    ff("-i", pngs[0], "-vf", "scale=1280:-2", "-q:v", 3, poster)   # 動画を読み込む前に見せる表紙
    if o.slides:
        print("スライド画像:", work); return

    if o.voice == "system":
        vtag, vopt = system_voice(work, o.rate), []
        print(f"  声: システムの声（{vtag}）", flush=True)
    else:
        vtag, vopt = o.voice, ["-v", o.voice]
    clips, subs, t = [], [], 0.0
    for i, ((ch, sc), png) in enumerate(zip(scenes, pngs)):
        spoken = G.speech(sc["narr"], words)
        a = work / f"{i + 1:02d}-{h8(vtag + str(o.rate) + spoken)}.aiff"
        if not a.exists():
            subprocess.run(["say", *vopt, "-r", str(o.rate), "-o", str(a), spoken], check=True)
        clip = work / f"{i + 1:02d}-{h8(png.name + a.name)}.mp4"
        if not clip.exists():
            ff("-loop", 1, "-framerate", 30, "-i", png, "-i", a,
               "-af", f"adelay={int(LEAD_IN * 1000)}:all=1,apad=pad_dur={TAIL}",
               "-c:v", "libx264", "-tune", "stillimage", "-preset", "medium", "-crf", 22,
               "-pix_fmt", "yuv420p", "-r", 30, "-c:a", "aac", "-b:a", "128k", "-ar", 48000, "-ac", 2,
               "-shortest", "-movflags", "+faststart", clip)
        speak, whole = duration(a), duration(clip)
        subs += cues(G.display(sc["narr"]), t + LEAD_IN, speak)
        clips.append({"file": clip, "start": t, "dur": whole, "png": png})
        t += whole
        print(f"  {i + 1:02d}/{N} {whole:5.1f}秒  {ch['title']}", flush=True)

    lst = work / "concat.txt"
    lst.write_text("".join(f"file '{c['file'].name}'\n" for c in clips), encoding="utf-8")
    joined = work / "joined.mp4"
    ff("-f", "concat", "-safe", 0, "-i", lst, "-c", "copy", joined)

    srt = work / f"{code}.srt"
    srt.write_text("".join(f"{k}\n{ts(a, ',')} --> {ts(b, ',')}\n{s}\n\n" for k, (a, b, s) in enumerate(subs, 1)),
                   encoding="utf-8")
    vtt = ROOT / "guide" / f"{code}.vtt"
    vtt.write_text("WEBVTT\n\n" + "".join(f"{ts(a, '.')} --> {ts(b, '.')}\n{s}\n\n" for a, b, s in subs),
                   encoding="utf-8")
    out = ROOT / "guide" / f"{code}.mp4"
    ff("-i", joined, "-i", srt, "-map", 0, "-map", 1, "-c", "copy", "-c:s", "mov_text",
       "-metadata:s:s:0", "language=jpn", "-metadata", f"title={doc['title']}｜{SITE}",
       "-movflags", "+faststart", out)
    (work / "timeline.json").write_text(json.dumps(
        [{"start": c["start"], "dur": c["dur"], "png": str(c["png"])} for c in clips], ensure_ascii=False, indent=1),
        encoding="utf-8")
    print(f"動画: {out.relative_to(ROOT)}  {duration(out) / 60:.1f}分  {out.stat().st_size / 1e6:.1f}MB")
    print(f"字幕: {vtt.relative_to(ROOT)}  {len(subs)}件")


if __name__ == "__main__":
    main()
