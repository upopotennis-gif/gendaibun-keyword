#!/usr/bin/env python3
"""学習ガイドの原稿（guide/src/*.md）を読み、辞典と突き合わせて点検する。

原稿ひとつから、ガイドのページと解説動画の両方を作る。ここはその共通の読み込み部分。

    python3 tools/guide_src.py guide/src/kindai.md
"""
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
KEY = re.compile(r"\{([^{}]+)\}")
SCENE_TYPES = {"title", "words", "flow", "contrast", "quote"}


def load_dict():
    src = (ROOT / "index.html").read_text(encoding="utf-8")
    head = src.index("const W=[") + len("const W=")
    rows = json.loads(re.sub(r"/\*.*?\*/", "", src[head: src.index("];", head) + 1], flags=re.S))
    return {r[0]: {"w": r[0], "r": r[1], "m": r[2], "e": r[3], "k": r[4], "c": r[5]} for r in rows}


def parse(path):
    text = re.sub(r"<!--.*?-->", "", pathlib.Path(path).read_text(encoding="utf-8"), flags=re.S)
    doc = {"title": "", "code": "", "lead": "", "chapters": []}
    ch = sec = scene = None
    for n, raw in enumerate(text.splitlines(), 1):
        line = raw.rstrip()
        if not line.strip():
            continue
        if line.startswith("# "):
            doc["title"] = line[2:].strip()
        elif line.startswith("## "):
            ch = {"title": line[3:].strip(), "id": "", "words": [], "guide": [],
                  "contrasts": [], "quotes": [], "scenes": []}
            doc["chapters"].append(ch); sec = scene = None
        elif line.startswith("### "):
            sec = line[4:].strip(); scene = None
        elif ch is None:
            k, _, v = line.partition(":")
            if k.strip() in ("code", "lead"):
                doc[k.strip()] = v.strip()
        elif sec is None:
            k, _, v = line.partition(":")
            if k.strip() == "id":
                ch["id"] = v.strip()
            elif k.strip() == "words":
                ch["words"] = [w.strip() for w in v.split(",") if w.strip()]
        elif sec == "ガイド":
            ch["guide"].append(line.strip())
        elif sec == "対比":
            ch["contrasts"].append([p.strip() for p in line.split("|")])
        elif sec == "評論ではこう出る":
            ch["quotes"].append(line.strip())
        elif sec == "動画":
            m = re.match(r"\[(\w+)\]\s*(.*)$", line.strip())
            if m:
                scene = {"type": m.group(1), "args": [a.strip() for a in re.split(r"[|,]", m.group(2)) if a.strip()]
                         if m.group(1) in ("words", "title", "contrast", "quote") else [m.group(2).strip()],
                         "narr": "", "line": n}
                if m.group(1) == "flow":
                    scene["args"] = [a.strip() for a in m.group(2).split("→")]
                ch["scenes"].append(scene)
            elif line.startswith(">") and scene is not None:
                scene["narr"] += line[1:].strip()
            else:
                raise SystemExit(f"{path}:{n}: 動画の行として読めません: {line}")
    return doc


def display(text):
    return KEY.sub(lambda m: m.group(1), text)


KATAKANA = re.compile(r"^[ァ-ヶー・／]+$")


def speech(text, words):
    """ナレーション用。{語} を辞典の読みがな（複数あれば最初）に置き換える。

    ただしカタカナだけの語はそのまま読ませる。ひらがなにすると小さい「ぃ」「ぇ」を
    大きく読み、「あいでんてぃてぃ」が「アイデンテイテイ」になった（2026-09 実測）。
    カタカナなら合成音声は外来語として正しく読む。
    """
    def rd(m):
        w = m.group(1)
        return w.replace("・", "、").replace("／", "、") if KATAKANA.match(w) else words[w]["r"].split("・")[0]
    return KEY.sub(rd, text)


def check(doc, words):
    ng = []
    code = doc["code"]
    listed = []
    for ch in doc["chapters"]:
        blob = " ".join(ch["guide"] + ch["quotes"] + [s["narr"] for s in ch["scenes"]])
        for k in KEY.findall(blob):
            if k not in words:
                ng.append(f"［{ch['title']}］辞典に無い語: {{{k}}}")
        for w in ch["words"]:
            if w not in words:
                ng.append(f"［{ch['title']}］words に辞典に無い語: {w}")
            elif words[w]["c"] != code:
                ng.append(f"［{ch['title']}］{w} は分野が {words[w]['c']}")
            if "{" + w + "}" not in " ".join(ch["guide"]):
                ng.append(f"［{ch['title']}］{w} がガイド本文に {{}} 付きで出てこない")
        listed += ch["words"]
        for s in ch["scenes"]:
            if s["type"] not in SCENE_TYPES:
                ng.append(f"［{ch['title']}］{s['line']}行: 未知の種類 [{s['type']}]")
            if not s["narr"]:
                ng.append(f"［{ch['title']}］{s['line']}行: ナレーションが無い")
            if s["type"] == "words":
                ng += [f"［{ch['title']}］{s['line']}行: スライドの語が辞典に無い: {a}" for a in s["args"] if a not in words]
    mine = sorted(w for w, d in words.items() if d["c"] == code)
    missing = [w for w in mine if w not in listed]
    dup = sorted({w for w in listed if listed.count(w) > 1})
    if missing: ng.append(f"どの章にも入っていない語: {'、'.join(missing)}")
    if dup: ng.append(f"複数の章に入っている語: {'、'.join(dup)}")
    return ng, len(mine)


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "guide/src/kindai.md"
    words = load_dict()
    doc = parse(path)
    ng, total = check(doc, words)
    scenes = [s for c in doc["chapters"] for s in c["scenes"]]
    narr = sum(len(display(s["narr"])) for s in scenes)
    print(f"{doc['title']}（{doc['code']}）")
    for c in doc["chapters"]:
        print(f"  {c['title']:<18} 語{len(c['words']):>2}  段落{len(c['guide']):>2}  スライド{len(c['scenes']):>2}")
    print(f"章 {len(doc['chapters'])} / スライド {len(scenes)} / 分野の語 {total} 語")
    print(f"ナレーション {narr} 字 ≒ {narr/290:.1f} 分（速度165の目安）")
    if ng:
        print("--- 要修正 ---"); [print("  " + x) for x in ng]; sys.exit(1)
    print("点検: 問題なし")
