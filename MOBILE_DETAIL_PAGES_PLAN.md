# Mobile Detail Pages Implementation Plan
**Scheduled: Monday, May 26, 2026 (10:00-14:00)**

## Objective
Make all dashboard list/card components clickable to detail pages for better mobile UX. Pattern: Grid of cards → click → dedicated detail page with full information.

## Completed ✅
- [x] `/dashboard/build-tracker` - Detail page at `/dashboard/build-tracker/[id]`
- [x] Sidebar mobile UX (swipe, escape key, better viewport)

## To Implement (Top 5 Priority)

### 1. `/dashboard/projects`
**Current state:** Client component with modal editing
**Type:** List of project cards
**What needs:**
- Make project cards clickable → `/dashboard/projects/[id]`
- Create detail page showing:
  - Full description
  - Budget vs spent breakdown
  - Timeline (start/end dates)
  - Location/address
  - Company association
  - Notes/details
- Keep existing modal for edit/delete (can be triggered from detail page)

### 2. `/dashboard/taken` (Tasks)
**Current state:** Complex component with modal details and orchestrator integration
**Type:** List of task items with multiple filters
**What needs:**
- Make task cards clickable → `/dashboard/taken/[id]`
- Create detail page showing:
  - Full description
  - Assigned person
  - Due date
  - Status & priority
  - Related project
  - Associated company
  - If has orchestrator_task_id: link to orchestrator details
- Keep existing edit modal

### 3. `/dashboard/documenten`
**Current state:** Client component with folder structure
**Type:** File list with folder filtering
**What needs:**
- Make document rows clickable → `/dashboard/documenten/[id]`
- Create detail page showing:
  - Full file name
  - Folder location
  - File type/size
  - URL/link (if available)
  - Notes
  - Associated company/project
  - Created date
  - Download link button

### 4. `/dashboard/workflows`
**Current state:** Server component with WorkflowControls sub-component
**Type:** List of workflows with stats
**What needs:**
- Make workflow items clickable → `/dashboard/workflows/[id]`
- Create detail page showing:
  - Full workflow definition
  - Status (actief/inactief)
  - Recent runs history
  - Last execution status/time
  - Trigger type (cron/webhook/event/manual)
  - Actions/steps
- Link to RunHistory filtered by workflow

### 5. `/dashboard/companies`
**Current state:** Server component with company cards
**Type:** Grid of company cards
**What needs:**
- Make company cards clickable → `/dashboard/companies/[id]`
- Create detail page showing:
  - Company details (name, address, etc.)
  - Associated projects
  - Associated workflows
  - Financial data if available
  - Users/team members assigned
  - Quick stats dashboard

## Implementation Pattern

For each component:

1. **Modify list/grid page:**
   - Convert cards to `<Link href={`/dashboard/[component]/[id]`}>` wrappers
   - Add hover effects & cursor pointer
   - Maintain all existing functionality

2. **Create detail page:**
   - Path: `/dashboard/[component]/[id]/page.tsx`
   - Fetch full item data
   - Display all metadata
   - Include back button
   - Add edit/delete actions (link to existing modals or create new flows)

3. **Mobile optimization:**
   - Use full width on mobile
   - Proper spacing & readability
   - Touch-friendly buttons
   - Smooth navigation

## Notes
- Keep existing modals for CRUD operations initially (can refactor later)
- Build incrementally: test each one before moving to next
- All details should be readable on mobile (build-tracker is the template)
