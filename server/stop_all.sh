#!/usr/bin/env bash
set -e

pkill -f "account_server/app.js" || true
pkill -f "hall_server/app.js" || true
pkill -f "game_server/app.js" || true

echo "Guandan servers stopped."
