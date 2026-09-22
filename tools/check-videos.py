#!/usr/bin/env python3
"""解説動画（guide/<code>.mp4）をまとめて点検する。公開の前に必ず通す。

    python3 tools/check-videos.py            # guide/src にある分野すべて
    python3 tools/check-videos.py kindai

見るもの:
  - 映像・音声・字幕の3トラックがそろっているか
  - 平均音量が極端に小さくないか
  - 3秒以上の無音が無いか（途中で音が途切れていないか）
  - 最後の字幕が動画の長さに収まっているか
  - ページ（guide/<code>.html）に動画が埋め込まれているか

読み間違いは機械では確かめられない。原稿を直したら、特に語の読みを耳で確認すること。
"""
import pathlib, re, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
FF = "/Users/syota/Documents/00 Claude Code/09 ICT関係/議事録自動化/.bin/ffmpeg"


def err(*a):
    return subprocess.run([FF, "-hide_banner", *a], capture_output=True, text=True).stderr


def main():
    codes = sys.argv[1:] or sorted(p.stem for p in (ROOT / "guide" / "src").glob("*.md"))
    bad = False
    for code in codes:
        mp4, vtt, page = (ROOT / "guide" / f"{code}{x}" for x in (".mp4", ".vtt", ".html"))
        if not mp4.exists():
            print(f"{code:<9} 動画がありません"); bad = True; continue
        info = err("-i", str(mp4))
        h, m, s = re.search(r"Duration: (\d+):(\d+):([\d.]+)", info).groups()
        dur = int(h) * 3600 + int(m) * 60 + float(s)
        tracks = all(k in info for k in ("Video: h264", "Audio: aac", "Subtitle: mov_text"))
        vol = err("-i", str(mp4), "-map", "0:a", "-af", "volumedetect", "-f", "null", "-")
        mean = float(re.search(r"mean_volume: ([-\d.]+)", vol).group(1))
        gaps = err("-i", str(mp4), "-map", "0:a", "-af", "silencedetect=n=-45dB:d=3", "-f", "null", "-").count("silence_start")
        ends = re.findall(r"--> (\d+):(\d+):([\d.]+)", vtt.read_text(encoding="utf-8")) if vtt.exists() else []
        last = max((int(a) * 3600 + int(b) * 60 + float(c) for a, b, c in ends), default=0)
        embedded = page.exists() and "<video" in page.read_text(encoding="utf-8")
        p = [x for x, c in [("トラック不足", not tracks), ("音が小さい", mean < -35), (f"無音{gaps}箇所", gaps),
                            ("字幕なし／はみ出し", not ends or last > dur), ("ページに未埋め込み", not embedded)] if c]
        bad |= bool(p)
        print(f"{code:<9} {dur / 60:4.1f}分  平均{mean:6.1f}dB  字幕{len(ends):3}件  "
              + ("OK" if not p else "要確認: " + "・".join(p)))
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
