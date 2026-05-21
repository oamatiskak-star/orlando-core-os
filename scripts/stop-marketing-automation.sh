#!/bin/bash

# Stop all marketing automation services

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Stopping Orlando Marketing Automation Services...${NC}"

# Stop services by PID
for service in analyst intelligence orchestrator notifier; do
  pidfile=".pids/${service}.pid"

  if [ -f "$pidfile" ]; then
    pid=$(cat "$pidfile")
    if kill $pid 2>/dev/null; then
      echo -e "${GREEN}✓ Stopped $service (PID: $pid)${NC}"
      rm "$pidfile"
    else
      echo -e "${YELLOW}⚠ $service not running (PID: $pid)${NC}"
      rm "$pidfile"
    fi
  else
    echo -e "${YELLOW}⚠ No PID file for $service${NC}"
  fi
done

echo -e "\n${GREEN}All services stopped${NC}"
