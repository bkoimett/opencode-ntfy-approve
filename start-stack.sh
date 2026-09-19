#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
npm run build
cp dist/src/*.js .opencode/plugins/
cp dist/src/plugin.js .opencode/plugins/opencode-ntfy-approve.js

if [ -z "$AGENTLINK_TOPIC" ]; then
  echo "AGENTLINK_TOPIC not set. Run: export AGENTLINK_TOPIC=opencode-approve-<topic>"
  exit 1
fi
if [ -z "$AGENTLINK_RELAY_URL" ]; then
  echo "AGENTLINK_RELAY_URL not set. Run: export AGENTLINK_RELAY_URL=http://100.95.231.122:7342"
  exit 1
fi

echo "Starting OpenCode with AGENTLINK_TOPIC=$AGENTLINK_TOPIC"
echo "Relay: $AGENTLINK_RELAY_URL"
opencode