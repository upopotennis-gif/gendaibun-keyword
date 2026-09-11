#!/usr/bin/env python3
"""index.html の W 配列を点検する。

四択テストの誤答選択肢は他の語の語義をそのまま使うため、語義の長さが偏ると
「いちばん長いものが正解」で当てられてしまう。語を足したあとはこれを通すこと。

    python3 tools/check-words.py
"""
import collections, json, pathlib, random, re, statistics, sys

root = pathlib.Path(__file__).resolve().parent.parent
src = (root / "index.html").read_text(encoding="utf-8")
head = src.index("const W=[") + len("const W=")
W = json.loads(re.sub(r"/\*.*?\*/", "", src[head : src.index("];", head) + 1], flags=re.S))

ng = []
seen_w, seen_m = collections.Counter(), collections.Counter()
for row in W:
    if len(row) != 6 or not all(isinstance(f, str) and f for f in row):
        ng.append(f"項目の形が違う: {row[:1]}")
        continue
    w, y, m, e, k, c = row
    seen_w[w] += 1
    seen_m[m] += 1
    if not 9 <= len(m) <= 43:
        ng.append(f"語義が{len(m)}字（9〜43字に収める）: {w} — {m}")
    if len(e) < 10:
        ng.append(f"用例が短い: {w} — {e}")
ng += [f"見出し語が重複: {w}" for w, n in seen_w.items() if n > 1]
ng += [f"語義が重複: {m}" for m, n in seen_m.items() if n > 1]

bycat = collections.defaultdict(list)
for row in W:
    bycat[row[5]].append(row)

random.seed(0)
longest = shortest = 0
N = 40000
for _ in range(N):
    w = random.choice(W)
    same = [x for x in bycat[w[5]] if x[0] != w[0]]
    pool = same if len(same) >= 3 else [x for x in W if x[0] != w[0]]
    opts = random.sample(pool, 3)
    if len(w[2]) > max(len(o[2]) for o in opts):
        longest += 1
    if len(w[2]) < min(len(o[2]) for o in opts):
        shortest += 1

L = [len(row[2]) for row in W]
print(f"{len(W)} 語 / " + " ".join(f"{k}:{len(v)}" for k, v in bycat.items()))
print(f"語義の長さ 最短{min(L)} 中央{statistics.median(L):.0f} 最長{max(L)}")
print(f"正解が単独で最長 {longest/N*100:.1f}% / 最短 {shortest/N*100:.1f}%（偶然なら25%）")
if not 20 <= longest / N * 100 <= 30:
    ng.append("正解の語義の長さが偏っている（25%から離れすぎ）")

if ng:
    print("\n--- 要修正 ---")
    for x in ng:
        print(" ", x)
    sys.exit(1)
print("問題なし")
