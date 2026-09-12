#!/bin/bash
# 案内プリント.html から A4 1ページの PDF を書き出す。
#
# ヘッドレス Chrome に刷らせる。--print-to-pdf は @page をそのまま使うので、
# A4・余白14/15mm が保たれる。
#
# 注意（実測）:
#   - Chrome を前面で待つと返らないことがある。背景で起こし、PDF が出るまで待って落とす。
#   - --dump-dom も同様に返らない。中身を確かめたいときは --screenshot を使う。
#   - file:// だと QR 画像の読み込みが環境によって止まるため、一時的に配信する。
set -uo pipefail
cd "$(dirname "$0")"

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$CHROME" ] || { echo "Google Chrome が見つかりません: $CHROME" >&2; exit 1; }

PORT=8899
SRC="案内プリント.html"
OUT="案内プリント.pdf"
PROF="$(mktemp -d)"

python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SRV=$!
disown "$SRV" 2>/dev/null || true   # 終了時の「Terminated」表示を出さない
cleanup(){ { kill "$SRV"; wait "$SRV"; } 2>/dev/null; pkill -f "$PROF" 2>/dev/null; rm -rf "$PROF"; }
trap cleanup EXIT
sleep 1

rm -f "$OUT"
URL="http://127.0.0.1:$PORT/$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$SRC")"
"$CHROME" --headless=new --disable-gpu --no-first-run \
  --user-data-dir="$PROF" --no-pdf-header-footer \
  --print-to-pdf="$OUT" "$URL" >/dev/null 2>&1 &
disown %% 2>/dev/null || true

for _ in $(seq 1 30); do [ -s "$OUT" ] && break; sleep 1; done
sleep 1
pkill -f "$PROF" 2>/dev/null

[ -s "$OUT" ] || { echo "PDF を書き出せませんでした" >&2; exit 1; }

python3 - "$OUT" <<'PY'
import sys, re
d = open(sys.argv[1], 'rb').read()
pages = len(re.findall(rb'/Type\s*/Page[^s]', d))
mb = re.search(rb'/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)', d)
w, h = (float(mb.group(3)), float(mb.group(4))) if mb else (0, 0)
print(f"{sys.argv[1]}: {pages} ページ / {w/72*25.4:.1f} x {h/72*25.4:.1f} mm")
if pages != 1:
    print("！ 1ページに収まっていません。本文を削るか余白を詰めてください。")
    sys.exit(1)
PY
