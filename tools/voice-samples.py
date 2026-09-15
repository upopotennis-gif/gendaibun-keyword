#!/usr/bin/env python3
"""日本語の読み上げ音声を聞き比べる見本を作る。

動画の実際の場面（語は辞典の読みがなに置き換えたもの）を、使える声それぞれで読み上げる。

    python3 tools/voice-samples.py                 # いま使える声で作る
    python3 tools/voice-samples.py --wait 60       # 高品質音声が入るまで最大60分待ってから作る
    python3 tools/voice-samples.py --out 出力先 --rate 170
"""
import argparse, pathlib, re, subprocess, sys, time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import guide_src as G

# 簡易版の中でも、声色を遊ばせた音声は教材に向かないので既定では外す
NOVELTY = {"Eddy", "Flo", "Grandma", "Grandpa", "Reed", "Rocko", "Sandy", "Shelley"}
HIGH = re.compile(r"Premium|Enhanced|プレミアム|拡張|Otoya|Hattori|O-ren", re.I)
PICK = ("{客体}", "{疎外}")   # この語を含む場面を見本に使う


def voices():
    out = subprocess.run(["say", "-v", "?"], capture_output=True, text=True).stdout
    names = []
    for line in out.splitlines():
        m = re.match(r"^(.*?)\s{2,}ja_JP\b", line)
        if m:
            names.append(m.group(1).strip())
    return names


def base(name):
    return re.split(r"\s*\(", name)[0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="/private/tmp/claude-501/-Users-syota-Documents-00-Claude-Code-01-----/"
                                     "ed7f02b8-6f0c-498d-b128-791f06cf1e4a/scratchpad/voice2")
    ap.add_argument("--rate", type=int, default=170)
    ap.add_argument("--wait", type=int, default=0, help="高品質音声が現れるまで待つ分数")
    ap.add_argument("--all", action="store_true", help="声色を遊ばせた簡易音声も含める")
    o = ap.parse_args()

    if o.wait:
        deadline = time.time() + o.wait * 60
        while not any(HIGH.search(v) for v in voices()):
            if time.time() > deadline:
                raise SystemExit(f"{o.wait}分待ちましたが、高品質の日本語音声が見つかりませんでした")
            time.sleep(15)
        time.sleep(20)   # 一覧に出てからダウンロードが終わりきるまでの余裕

    words = G.load_dict()
    doc = G.parse(G.ROOT / "guide" / "src" / "kindai.md")
    scenes = [s["narr"] for c in doc["chapters"] for s in c["scenes"]]
    text = "".join(next(n for n in scenes if k in n) for k in PICK)
    spoken = G.speech(text, words)

    names = [v for v in voices() if o.all or base(v) not in NOVELTY]
    names.sort(key=lambda v: (not HIGH.search(v), v))
    out = pathlib.Path(o.out); out.mkdir(parents=True, exist_ok=True)
    for f in out.glob("*.m4a"):
        f.unlink()
    print(f"見本の文（{len(G.display(text))}字）: {G.display(text)}")
    made = 0
    for i, v in enumerate(names, 1):
        tag = "高品質" if HIGH.search(v) else "簡易（いまの動画）" if v == "Kyoko" else "簡易"
        safe = re.sub(r"[\\/:*?\"<>|（）()]+", "_", v).strip("_ ")
        path = out / f"{i:02d}_{safe}_{tag}.m4a"
        r = subprocess.run(["say", "-v", v, "-r", str(o.rate), "-o", str(path),
                            "--file-format=m4af", "--data-format=aac", spoken], capture_output=True, text=True)
        if r.returncode or not path.exists():
            print(f"  × {v}: 読み上げに失敗（{r.stderr.strip()[:60]}）")
            continue
        made += 1
        print(f"  ○ {path.name}")
    print(f"{made} 件を {out} に作成")


if __name__ == "__main__":
    main()
