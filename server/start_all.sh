#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"
nohup node ./account_server/app.js ../configs.js > account_server.log 2>&1 &
nohup node ./hall_server/app.js ../configs.js > hall_server.log 2>&1 &
nohup node ./game_server/app.js ../configs.js > game_server.log 2>&1 &

echo "Guandan servers started. Logs: server/account_server.log server/hall_server.log server/game_server.log"
