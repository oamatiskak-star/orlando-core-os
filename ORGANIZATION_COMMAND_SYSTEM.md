# Organization Agent Command & Planning System

## Overview

A comprehensive organization-wide agent command and planning system integrated into Orlando Core OS as an extension of the existing `/dashboard/agents`. This system provides centralized visibility and control over all agents, tasks, workers, and the ClickUp integration layer.

**Status**: Phase A, B, C (Database, API, Frontend) Complete ✅

## Architecture

### 1. **Database Schema** (Supabase)

**Migration**: `078_organization_command_system.sql`

Core tables:
- **organization_agents** - Central registry of all agents (personas, external, system)
- **organization_workers** - Unified worker registry (Orchestrator, AI-OS, local CLI, YouTube, Mail, Finance)
- **organization_llama_workers** - Dedicated llama.cpp worker registry with model details
- **organization_tasks** - Unified task view across ClickUp, Supabase, local queues, manual
- **organization_task_logs** - Complete audit trail of task execution
- **organization_clickup_imports** - ClickUp sync metadata and deduplication tracking
- **organization_task_dependencies** - Task graph for prerequisites and dependencies
- **organization_agent_assignments** - History of agent-to-task assignments

All tables include:
- UUID primary keys
- created_at / updated_at timestamps
- Proper indexes for performance
- RLS policies (read for authenticated, all for service_role)
- Unique constraints to prevent duplicates

### 2. **RPC Functions** (Supabase)

**Migration**: `079_organization_rpc_functions.sql`

Query functions:
- `get_organization_overview()` - Dashboard statistics
- `get_organization_agents()` - List agents with filters
- `get_organization_tasks()` - List tasks with filters
- `get_organization_task_detail()` - Full task with logs and timeline
- `get_agent_timeline()` - Chronological task history per agent
- `get_organization_workers()` - List workers with health status
- `get_organization_llama_workers()` - List llama.cpp workers

Mutation functions:
- `log_task_action()` - Log task events
- `claim_organization_task()` - Atomic task assignment
- `update_task_status()` - Update task status with logging

### 3. **Backend API Routes**

**Base URL**: `/api/organization/`

#### Agents
- `GET /agents` - List agents (filters: status, system)
- `GET /agents/:id` - Agent detail with tasks

#### Tasks
- `GET /tasks` - List tasks (filters: status, agent_id, worker_id, source, priority, system)
- `GET /tasks/:id` - Task detail with logs and timeline
- `POST /tasks` - Create manual task
- `POST /tasks/:id/assign` - Assign task to agent/worker
- `POST /tasks/:id/status` - Update task status

#### Workers
- `GET /workers` - List workers (filters: status, type)
- `POST /workers` - Register/update worker
- `POST /workers/heartbeat` - Worker heartbeat (registration + status)

#### llama.cpp Workers
- `GET /llama-workers` - List llama workers
- `POST /llama-workers` - Register llama worker
- `POST /llama-workers/heartbeat` - llama worker heartbeat

#### ClickUp Integration
- `GET /clickup/import` - Import status (synced, pending, errors counts)
- `POST /clickup/import` - Trigger ClickUp sync (with optional api_token, team_id)

#### Agent Timeline
- `GET /agent-timeline/:agent_id` - Chronological task history

### 4. **ClickUp Integration Service**

**Location**: `/lib/clickup/`

**Files**:
- `client.ts` - ClickUp API client with rate limiting
- `mapper.ts` - Status/priority/assignee mapping
- `sync.ts` - Full import logic with duplicate prevention
- `index.ts` - Module exports

**Features**:
- Full task hierarchy import (spaces → folders → lists → tasks)
- Subtask preservation
- Attachment metadata tracking
- Comment/note integration
- Automatic duplicate prevention via clickup_task_id
- Status mapping: ClickUp → internal (new/queued/running/completed/failed)
- Priority mapping: ClickUp (urgent/high/normal/low) → internal (critical/high/normal/low/backlog)
- Assignee mapping: ClickUp user → organization_agent

**Environment Variables**:
- `CLICKUP_API_TOKEN` - ClickUp API token
- `CLICKUP_TEAM_ID` - ClickUp team ID

### 5. **Frontend Dashboard Extension**

**Location**: `/dashboard/agents/` (extended with new tabs)

#### Tab Navigation
- **Agent OS** - Existing agent grid and task feed
- **Identity** - Existing persona identity layer
- **Command Center** - NEW: Organization-wide overview
- **ClickUp Import** - NEW: Import and sync management

#### Command Center Components
- **Agent Registry** (`AgentRegistry.tsx`)
  - Table view of all agents
  - Status, role, system, task counts
  - Expandable detail modal
  - Search and filter

- **Task Command Center** (`TaskCommandCenter.tsx`)
  - Unified task list from all sources
  - Filters: status, source, priority
  - Color-coded badges (status, priority, source)
  - Task detail panel with execution log
  - Output URL links

- **Worker Monitor** (`WorkerMonitor.tsx`)
  - Grid view of worker health
  - Real-time status (green <30s, amber <90s, red >90s)
  - Queue length and current task
  - Auto-refresh every 30 seconds
  - Detail panel with full worker info

- **ClickUp Import Panel** (`ClickUpImportPanel.tsx`)
  - Connection status (configured/unconfigured)
  - API token and Team ID input
  - Sync button and progress
  - Status summary (synced, pending, errors)
  - Error handling and success messages

#### UI Patterns
- Dark theme with cyan/indigo accent colors
- Responsive grid layout
- Real-time data fetching
- Status color coding
- Expandable detail views
- Filter and search capabilities

## Integration Points

### Sync with Existing Systems

1. **Orchestrator Tasks**
   - New `executor_task_id` field in organization_tasks
   - Maps orchestrator task status/priority/executor
   - Backlink for status updates

2. **AI-OS Tasks**
   - New `ai_task_id` field in organization_tasks
   - Maps ai_tasks status and queue state
   - Backlink for execution tracking

3. **Worker Registration**
   - Heartbeat endpoint: `POST /api/organization/workers/heartbeat`
   - Auto-updates last_heartbeat and status
   - Health check: 30s = green, 90s = amber, >90s = red/offline

### ClickUp Import Flow

1. User provides API token and Team ID
2. Client connects to ClickUp API
3. Fetches all spaces, folders, lists, tasks
4. Maps to internal task structure
5. Inserts into organization_tasks
6. Tracks migration in organization_clickup_imports
7. Prevents duplicates via unique constraint

## Status Model

**Internal Task Statuses** (normalized):
- `new` - Newly created, not yet queued
- `queued` - Ready to execute, waiting in queue
- `assigned` - Assigned to agent/worker
- `running` - Currently executing
- `waiting_for_input` - Blocked on human input
- `blocked` - Blocked on dependency or resource
- `completed` - Successfully finished
- `failed` - Terminal failure
- `cancelled` - User cancelled

## Priority Model

**Standard Priorities**:
- `critical` - Must execute immediately
- `high` - Execute soon
- `normal` - Standard priority
- `low` - Execute when capacity available
- `backlog` - Defer indefinitely

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   Orlando Core OS                            │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ /dashboard/agents (Enhanced with Tabs)              │   │
│  │                                                        │   │
│  │ ┌─────────────┬─────────────┬──────────────────────┐ │   │
│  │ │ Agent OS    │  Identity   │  Command Center      │ │   │
│  │ │ (existing)  │  (existing) │  ✓ NEW              │ │   │
│  │ ├─────────────┴─────────────┴──────────────────────┤ │   │
│  │ │  Tab Container & Tab Navigation                   │ │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                    │
│  ┌──────────────────────▼────────────────────────────────┐   │
│  │ Frontend Components                                    │   │
│  │                                                        │   │
│  │ ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │   │
│  │ │ Agent        │  │ Task Command │  │ Worker     │  │   │
│  │ │ Registry     │  │ Center       │  │ Monitor    │  │   │
│  │ └──────┬───────┘  └──────┬───────┘  └─────┬──────┘  │   │
│  │        │                 │                 │         │   │
│  │ ┌──────▼─────────────────▼─────────────────▼─────┐   │   │
│  │ │       ClickUp Import Panel                      │   │   │
│  │ └──────┬────────────────────────────────────────┘   │   │
│  └────────┼────────────────────────────────────────────┘   │
│           │                                                  │
│  ┌────────▼────────────────────────────────────────────┐    │
│  │ Backend API Routes (/api/organization/*)            │    │
│  │                                                       │    │
│  │ - GET /agents, /tasks, /workers, /llama-workers     │    │
│  │ - POST /tasks, /tasks/:id/assign, /tasks/:id/status │    │
│  │ - POST /workers/heartbeat, /llama-workers/heartbeat │    │
│  │ - POST /clickup/import                              │    │
│  └────────┬────────────────────────────────────────────┘    │
│           │                                                  │
│  ┌────────▼──────────────────────────────────────┐          │
│  │ ClickUp Service (/lib/clickup/)                │          │
│  │                                                  │          │
│  │ - ClickUpClient (API + rate limiting)         │          │
│  │ - Mapper (status, priority, assignee)         │          │
│  │ - Sync (import, deduplicate, track)           │          │
│  └────────┬──────────────────────────────────────┘          │
│           │                                                  │
│  ┌────────▼──────────────────────────────────────┐          │
│  │ Supabase                                        │          │
│  │                                                  │          │
│  │ RPC Functions:                                  │          │
│  │ - get_organization_overview()                  │          │
│  │ - get_organization_agents/tasks/workers()      │          │
│  │ - get_agent_timeline()                         │          │
│  │ - claim_organization_task()                    │          │
│  │ - update_task_status()                         │          │
│  └────────┬──────────────────────────────────────┘          │
│           │                                                  │
│  ┌────────▼──────────────────────────────────────┐          │
│  │ Organization Schema                             │          │
│  │                                                  │          │
│  │ - organization_agents                          │          │
│  │ - organization_workers                         │          │
│  │ - organization_llama_workers                   │          │
│  │ - organization_tasks                           │          │
│  │ - organization_task_logs                       │          │
│  │ - organization_clickup_imports                 │          │
│  │ - organization_task_dependencies                │          │
│  │ - organization_agent_assignments               │          │
│  └──────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

## Environment Variables Required

```bash
# ClickUp Integration
CLICKUP_API_TOKEN=sk_xxxxx
CLICKUP_TEAM_ID=xxxxx

# Feature Flag
NEXT_PUBLIC_ORGANIZATION_AGENTS_ENABLED=true

# Optional: Sync Intervals
ORGANIZATION_SYNC_INTERVAL=300000  # 5 minutes
CLICKUP_SYNC_INTERVAL=600000       # 10 minutes
WORKER_HEARTBEAT_TIMEOUT=1800000   # 30 minutes
```

## Usage

### 1. Access the Dashboard
Navigate to `/dashboard/agents` and click the "Command Center" tab.

### 2. View Organization Overview
- See agent count, online workers, open/running tasks
- Agent Registry: Search agents by name, type, system
- Task Command Center: Filter tasks by status, source, priority
- Worker Monitor: Check worker health and queue status

### 3. Import ClickUp Tasks
1. Click "ClickUp Import" tab
2. Enter API token and Team ID (or let system use environment variables)
3. Click "Connect & Import"
4. Monitor import progress and review synced count

### 4. Assign Tasks
1. Select a task in Task Command Center
2. Click assignment button
3. Choose agent and optional worker
4. Task status updates automatically

### 5. Monitor Agent Timeline
Click on any agent in Agent Registry to see:
- All tasks assigned to that agent
- Task status and timeline
- Worker assignment history
- Execution duration and errors

## Implementation Status

### ✅ Completed

- Database schema (8 tables)
- RPC functions (10 functions)
- Backend API routes (11 routes)
- ClickUp integration service (3 modules)
- Frontend dashboard extension (6 components)
- Task sync utilities for orchestrator and AI-OS
- Environment configuration
- RLS policies and indexes

### 📋 Next Steps (Phase D/E)

- [ ] Real-time Supabase subscriptions (similar to existing AgentGrid/TaskFeed)
- [ ] Task dependency visualization
- [ ] Advanced filtering and search
- [ ] Export functionality (CSV, JSON)
- [ ] Automated task routing based on agent capabilities
- [ ] Integration with orchestrator_tasks for status bidirectional sync
- [ ] Integration with ai_tasks for queue synchronization
- [ ] llama.cpp worker auto-discovery
- [ ] Performance optimization and caching
- [ ] Comprehensive logging and error tracking

## Files Created

### Database
- `supabase/migrations/078_organization_command_system.sql` (344 lines)
- `supabase/migrations/079_organization_rpc_functions.sql` (420 lines)

### Backend API
- `frontend/app/api/organization/agents/route.ts`
- `frontend/app/api/organization/tasks/route.ts`
- `frontend/app/api/organization/tasks/[id]/route.ts`
- `frontend/app/api/organization/tasks/[id]/assign/route.ts`
- `frontend/app/api/organization/tasks/[id]/status/route.ts`
- `frontend/app/api/organization/workers/route.ts`
- `frontend/app/api/organization/workers/heartbeat/route.ts`
- `frontend/app/api/organization/llama-workers/route.ts`
- `frontend/app/api/organization/llama-workers/heartbeat/route.ts`
- `frontend/app/api/organization/agent-timeline/[agent_id]/route.ts`
- `frontend/app/api/organization/clickup/import/route.ts`

### Services
- `frontend/lib/clickup/client.ts` (150 lines)
- `frontend/lib/clickup/mapper.ts` (140 lines)
- `frontend/lib/clickup/sync.ts` (190 lines)
- `frontend/lib/clickup/index.ts`
- `frontend/lib/organization/task-sync.ts` (160 lines)

### Frontend Components
- `frontend/app/dashboard/agents/TabContainer.tsx`
- `frontend/app/dashboard/agents/CommandCenter.tsx`
- `frontend/app/dashboard/agents/AgentRegistry.tsx`
- `frontend/app/dashboard/agents/TaskCommandCenter.tsx`
- `frontend/app/dashboard/agents/WorkerMonitor.tsx`
- `frontend/app/dashboard/agents/ClickUpImportPanel.tsx`
- `frontend/app/dashboard/agents/page.tsx` (modified)

## Key Features

✅ **No Mock Data** - All data is live from Supabase
✅ **Real-time Updates** - Heartbeat mechanism for workers
✅ **ClickUp Integration** - Full import with status/priority mapping
✅ **Unified Task View** - ClickUp + Supabase + Manual tasks in one place
✅ **Worker Health** - Auto-refresh with color-coded status
✅ **Audit Trail** - Complete task execution logging
✅ **Extensible Design** - Foundation for additional workers/systems
✅ **RLS Compliant** - Row-level security for multi-tenant support

## Performance Considerations

- Indexes on: status, agent_id, worker_id, source, priority, created_at
- RPC functions use efficient queries
- Rate limiting on ClickUp API (100ms between requests)
- Worker heartbeat timeout: 30 minutes
- Task query limit: 50-100 per request (paginated)

## Security

- Authentication required on all routes
- RLS policies limit data access
- ClickUp API token stored in environment (not in database)
- Unique constraints prevent ClickUp duplicate imports
- No sensitive data logged

## Testing Checklist

- [ ] Database migrations apply without errors
- [ ] RPC functions execute correctly
- [ ] API routes return expected data
- [ ] ClickUp import successfully maps tasks
- [ ] Frontend components render without errors
- [ ] Filters and search work correctly
- [ ] Worker heartbeat updates status
- [ ] Task assignment updates status
- [ ] Real-time updates working
- [ ] No console errors or warnings

## Notes for Deployment

1. Run Supabase migrations before deploying frontend
2. Set ClickUp environment variables if importing
3. Ensure RLS policies are properly configured
4. Test worker heartbeat with at least one worker
5. Verify API authentication is working
6. Check that existing orchestrator_tasks are visible
7. Monitor initial ClickUp import for large teams

---

**Branch**: `claude/plane-agent-command-system-m0p8y`
**Implementation Date**: May 2026
**Status**: Ready for Phase D (Real-time Extensions)
