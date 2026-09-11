#!/usr/bin/env python3
"""index.html から Claude Artifact 用の本文を切り出して artifact.html に書き出す。

Artifact はページ本体を <!doctype html>…<head></head><body> のひな形で包むため、
外側のタグを取り除いた中身だけを渡す必要がある。index.html を唯一の正とし、
Artifact 版は常にここから生成することで、両者のずれを防ぐ。

    python3 tools/make-artifact.py
"""
import pathlib

root = pathlib.Path(__file__).resolve().parent.parent
src = (root / "index.html").read_text(encoding="utf-8")

body = src[src.index("<title>") : src.rindex("</script>") + len("</script>")]
body = body.replace("</head>\n<body>\n", "")

out = root / "artifact.html"
out.write_text(body + "\n", encoding="utf-8")
print(f"{out.name}: {len(body)} characters")
