#!/bin/bash
# Docker Container Health Check Script

PORT=${PORT:-3000}
URL="http://localhost:${PORT}/health"

echo "Checking health at ${URL}..."

if command -v curl >/dev/null 2>&1; then
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${URL}")
elif command -v wget >/dev/null 2>&1; then
  STATUS=$(wget --spider -S "${URL}" 2>&1 | grep "HTTP/" | awk '{print $2}' | tail -n1)
else
  echo "Neither curl nor wget is installed. Exiting."
  exit 1
fi

if [ "$STATUS" -eq 200 ]; then
  echo "✅ Health check passed (HTTP 200)"
  exit 0
else
  echo "❌ Health check failed (HTTP ${STATUS})"
  exit 1
fi
