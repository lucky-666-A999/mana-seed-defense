#!/bin/bash
# 더블클릭하면 서버 켜고 브라우저 열림. 종료: 이 창에서 Ctrl+C
cd "$(dirname "$0")"
PORT=8124
lsof -ti tcp:$PORT | xargs kill -9 2>/dev/null
python3 serve.py $PORT &
SRV=$!
sleep 1
open "http://localhost:$PORT/index.html"
trap "kill $SRV 2>/dev/null" EXIT
wait $SRV
