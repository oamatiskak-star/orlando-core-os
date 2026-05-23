#!/bin/bash

# Orlando AI Marketing Orchestration System - Complete Startup Script
# Manages all microservices: YouTube Analyst, Intelligence Engine, Orchestrator, Notifier

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  🎬 Orlando AI Marketing Orchestration System${NC}"
echo -e "${BLUE}║  Complete Automation for 840K Views in 10 Days${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"

# Check environment variables
echo -e "\n${YELLOW}Checking environment variables...${NC}"

required_vars=(
  "SUPABASE_URL"
  "SUPABASE_SERVICE_ROLE_KEY"
  "TELEGRAM_BOT_TOKEN"
  "TELEGRAM_CHAT_ID"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo -e "${RED}✗ Missing: $var${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ $var configured${NC}"
done

optional_vars=(
  "SLACK_WEBHOOK_CRITICAL"
  "SLACK_WEBHOOK_MARKETING"
  "SLACK_WEBHOOK_TESTS"
  "DISCORD_WEBHOOK_CRITICAL"
  "DISCORD_WEBHOOK_MARKETING"
  "DISCORD_WEBHOOK_TESTS"
  "MAILTRAP_API_TOKEN"
  "MAILTRAP_INBOX_ID"
)

for var in "${optional_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo -e "${YELLOW}⚠ Optional: $var not configured${NC}"
  else
    echo -e "${GREEN}✓ $var configured${NC}"
  fi
done

# Build services
echo -e "\n${YELLOW}Building services...${NC}"

echo -e "${BLUE}→ Building monitoring-agent${NC}"
cd monitoring-agent
npm install --silent
npm run build
cd ..
echo -e "${GREEN}✓ monitoring-agent built${NC}"

echo -e "${BLUE}→ Building youtube-engine${NC}"
cd youtube-engine
npm install --silent
npm run build
cd ..
echo -e "${GREEN}✓ youtube-engine built${NC}"

# Start services in background
echo -e "\n${YELLOW}Starting services...${NC}"

# YouTube Analyst
echo -e "${BLUE}→ Starting YouTube Channel Analyst${NC}"
nohup npm run start:analyst -w monitoring-agent > logs/analyst.log 2>&1 &
ANALYST_PID=$!
echo -e "${GREEN}✓ YouTube Analyst (PID: $ANALYST_PID)${NC}"

# Content Intelligence Engine
echo -e "${BLUE}→ Starting Content Intelligence Engine${NC}"
nohup node -e "const { runContentIntelligenceEngine } = require('./dist/content-intelligence-engine'); setInterval(runContentIntelligenceEngine, 3600000);" > logs/intelligence.log 2>&1 &
INTELLIGENCE_PID=$!
echo -e "${GREEN}✓ Intelligence Engine (PID: $INTELLIGENCE_PID)${NC}"

# Marketing Orchestrator
echo -e "${BLUE}→ Starting Marketing Orchestrator${NC}"
nohup node youtube-engine/dist/marketing-orchestrator.js > logs/orchestrator.log 2>&1 &
ORCHESTRATOR_PID=$!
echo -e "${GREEN}✓ Marketing Orchestrator (PID: $ORCHESTRATOR_PID)${NC}"

# Slack/Discord Notifier
echo -e "${BLUE}→ Starting Slack/Discord Notifier${NC}"
nohup node -e "const { notifyBehindSchedule, notifyViralMomentum, notifyNewRecommendation, notifyABTestWinner } = require('./dist/slack-discord-notifier'); setInterval(async () => { await notifyBehindSchedule(); await notifyViralMomentum(); await notifyNewRecommendation(); await notifyABTestWinner(); }, 600000);" > logs/notifier.log 2>&1 &
NOTIFIER_PID=$!
echo -e "${GREEN}✓ Slack/Discord Notifier (PID: $NOTIFIER_PID)${NC}"

# Project Manager
echo -e "${BLUE}→ Starting Project Manager${NC}"
nohup npm run start:project-manager -w monitoring-agent > logs/project-manager.log 2>&1 &
PROJECT_MANAGER_PID=$!
echo -e "${GREEN}✓ Project Manager (PID: $PROJECT_MANAGER_PID)${NC}"

# Save PIDs
echo -e "\n${YELLOW}Saving process IDs...${NC}"
mkdir -p .pids
echo "$ANALYST_PID" > .pids/analyst.pid
echo "$INTELLIGENCE_PID" > .pids/intelligence.pid
echo "$ORCHESTRATOR_PID" > .pids/orchestrator.pid
echo "$NOTIFIER_PID" > .pids/notifier.pid
echo "$PROJECT_MANAGER_PID" > .pids/project-manager.pid

# Summary
echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}✓ All services started successfully!${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"

echo -e "\n${YELLOW}Service Status:${NC}"
echo -e "  ${GREEN}✓ YouTube Channel Analyst${NC}        - Analyzes channel performance"
echo -e "  ${GREEN}✓ Intelligence Engine${NC}           - Generates AI recommendations"
echo -e "  ${GREEN}✓ Marketing Orchestrator${NC}        - Executes & schedules actions"
echo -e "  ${GREEN}✓ Slack/Discord Notifier${NC}       - Team alerts & notifications"
echo -e "  ${GREEN}✓ Project Manager${NC}              - Daily standup & 12-channel reporting"

echo -e "\n${YELLOW}Metrics:${NC}"
echo -e "  📊 Analyst runs every: 1 hour"
echo -e "  💡 Intelligence runs every: 1 hour"
echo -e "  🎯 Orchestrator runs every: 30 minutes"
echo -e "  🔔 Notifier runs every: 10 minutes"
echo -e "  👨‍💼 Project Manager runs every: 24 hours (9 AM)"

echo -e "\n${YELLOW}Logs:${NC}"
echo -e "  tail -f logs/analyst.log"
echo -e "  tail -f logs/intelligence.log"
echo -e "  tail -f logs/orchestrator.log"
echo -e "  tail -f logs/notifier.log"
echo -e "  tail -f logs/project-manager.log"

echo -e "\n${YELLOW}Stop services:${NC}"
echo -e "  bash scripts/stop-marketing-automation.sh"

echo -e "\n${BLUE}Dashboard available at: http://localhost:3000/youtube/marketing${NC}"
echo -e "${BLUE}API endpoints available at: http://localhost:3000/api/youtube/marketing/*${NC}"

echo -e "\n${GREEN}🚀 Marketing Automation System is LIVE!${NC}\n"
