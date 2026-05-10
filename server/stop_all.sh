#!/usr/bin/env bash
set -e

pkill -f "account_server/app.js" || true
pkill -f "hall_server/app.js" || true
pkill -f "game_server/app.js" || true
pkill -f "admin_server/app_start.js" || true

echo "Guandan servers stopped."
