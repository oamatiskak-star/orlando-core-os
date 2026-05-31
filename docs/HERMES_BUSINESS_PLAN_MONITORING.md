# Hermes Business Plan Monitoring System

## Overview

Hermes now actively monitors your Aquier master business plan, tracking milestone progress, identifying risks, and surfacing strategic insights. The system enables Hermes to understand what matters most to your business and proactively recommend actions aligned with your roadmap.

## System Architecture

### Core Components

#### 1. **Plan Milestone Tracking** (Migration 125)
- **Function**: `hermes.get_milestone_status(p_company_id)`
  - Fetches all milestones from the Aquier roadmap
  - Calculates progress against targets (MRR, customers)
  - Identifies at-risk milestones based on timeline and progress
  - Returns: milestone code, name, status, targets, current metrics, risk flags

- **Function**: `hermes.identify_plan_risks(p_company_id)`
  - Analyzes each milestone for specific risks
  - Categories: overdue, critical deadline, slow progress, upcoming, low progress
  - Severity levels: critical, high, medium, low
  - Returns: risk type, description, and recommended action for each

- **Function**: `hermes.get_next_milestone_focus(p_company_id)`
  - Returns the single most critical next milestone
  - Used by Hermes to maintain focus and context

#### 2. **Business Plan Integration** (Migration 126)
- **Enhanced**: `hermes.gather_partnership_context()`
  - Now includes `business_plan` data from milestone tracking
  - Exposes: active milestone, upcoming milestones, critical risks, plan health status

- **Enhanced**: `hermes.generate_strategic_response()`
  - Incorporates business plan data into all responses
  - Adjusts tone based on plan health (critical, needs attention, executing, on track)
  - Surfaces plan milestones in insights and concerns
  - Prioritizes recommendations based on plan criticality
  - Adds `plan_focused: boolean` flag to responses

#### 3. **Metrics and Alerts** (Migration 127)
- **Table**: `hermes.plan_metrics`
  - Tracks revenue, customers, churn, NPS, implementation progress
  - References milestones and records actual performance
  - Time-series data for trend analysis

- **Table**: `hermes.milestone_alerts`
  - Stores alerts generated for at-risk milestones
  - Tracks: alert type, severity, detection time, when presented to Orlando, resolution
  - Prevents duplicate alerts for same issue

- **Functions**:
  - `hermes.log_plan_metric()` - record performance data
  - `hermes.create_milestone_alert()` - generate alerts, avoid duplicates
  - `hermes.generate_plan_alerts()` - scan all milestones for risks

#### 4. **Automated Monitoring** (Migration 128)
- **Scheduled**: `hermes.monitor_all_plans()`
  - Runs hourly via cron: `0 * * * *`
  - Runs every 15 minutes during business hours: `*/15 7-18 * * 1-5`
  - Generates fresh alerts for all milestones
  - Logs monitoring runs

- **On-demand**: `hermes.refresh_plan_context(p_company_id)`
  - Called by Hermes before generating strategic responses
  - Ensures latest alerts and context

- **View**: `hermes.active_plan_alerts`
  - Real-time window into unpresented, unresolved alerts
  - Sorted by severity and detection time

#### 5. **Strategic Insights** (Migration 129)
- **Function**: `hermes.get_plan_performance_summary(p_company_id)`
  - High-level health overview: completion rate, at-risk count, critical risks
  - Overall risk level and trend analysis

- **Function**: `hermes.get_strategic_recommendations(p_company_id)`
  - AI-friendly recommendations table with:
    - Category: execution, risk management, planning, stabilization, acceleration
    - Priority and effort level
    - Rationale and expected impact
    - Suggested owner for each recommendation
  - Examples:
    - "Deliver M1 NL on schedule" (critical, execution)
    - "Resolve critical plan risks" (critical, risk management)
    - "Begin preparation for M7 UK launch" (high, planning)
    - "Stabilize plan execution" (high, stabilization)
    - "Accelerate remaining milestones" (medium, acceleration)

- **Functions**:
  - `hermes.mark_alerts_presented()` - prevent duplicate surfacing
  - `hermes.resolve_milestone_alert()` - track resolutions

### UI Component

**`HermesBusinessPlan.tsx`**
- Displays the Aquier master plan directly in the dashboard
- Shows:
  - **Active Milestone**: Currently executing milestone with progress, targets, timeline
  - **Next Up**: 2 upcoming milestones with countdown timers
  - **Risks**: Top 3 critical/high severity risks with recommended actions
  - **Stats**: Completion rate, executing count, planned count
- Updates in real-time by calling RPC functions
- Color-coded severity for easy scanning

## How Hermes Uses Business Plan Data

### Response Generation Flow

1. **Context Gathering**
   - User sends message to Hermes
   - `gather_partnership_context()` called
   - Includes: `refresh_plan_context()` for latest alerts
   - Plan data merged with operational context

2. **Intent Analysis**
   - Message intent detected (status check, advice, action request, etc.)
   - Plan status checked: are we on track, at risk, or critical?

3. **Response Construction**
   - **Concerns** built from context + plan risks
   - **Insights** include active milestone and progress
   - **Tone** adjusted if plan health is compromised
   - **Recommendations** prioritized around plan milestones

4. **Example Response Flow**
   ```
   Orlando: "Status?"
   
   Hermes detects:
   - intent: status_check
   - active_milestone: M1 NL (critical) - 5 days to launch, 80% progress
   - critical_risks: 1 (revenue target 60% of goal)
   - plan_health: needs_attention
   
   Response: "M1 NL is 5 days away at 80% complete, but revenue is only 
   at 60% of target. We need to focus on customer acquisition this week. 
   Are we on schedule for launch, or do we need to extend?"
   ```

## Integration Points

### Milestones from buildtracker

The system monitors milestones in the `buildtracker.projects` table:
- Must have `project_type = 'milestone'`
- Must have `module_ref = '25_IMPLEMENTATION_ROADMAP'`
- Metadata includes: `mrr_target_eur`, `customers_target`, `month_index`

### Metrics from Various Sources

Currently tracks:
- **Revenue**: Sum of `plan_metrics` with `metric_type = 'revenue'` from past 30 days
- **Customers**: Count of `plan_metrics` with `metric_type = 'customer_acquisition'` from past 30 days
- **Blocked Tasks**: Count from `buildtracker.issues` where `status = 'blocked'`
- **Implementation Progress**: From `plan_metrics` with `metric_type = 'implementation_progress'`

### Alert Generation Rules

Alerts are created when:
- **Overdue**: `status = 'in_progress'` AND `now() > target_date`
- **Blocked**: Multiple blocked tasks (`count > 2 = critical, else high`)
- **Slow Progress**: Few active tasks in progress (`count < 2`)
- **Revenue Behind**: Current revenue < 50% of target
- **Critical Deadline**: `status = 'in_progress'` AND `target_date` within 7 days

## Usage in Hermes Conversations

### Example 1: Proactive Risk Surface
```
Orlando logs into dashboard
Hermes sees M1 NL is at risk (overdue + revenue 60% of target)

Hermes greeting:
"Orlando, welcome back. M1 NL launches in 2 days but we're at 60% of 
revenue target. I recommend we focus 100% on customer acquisition today 
and tomorrow. Should we consider a soft launch to mitigate risk?"
```

### Example 2: Strategic Advice
```
Orlando: "What should we focus on?"

Hermes checks:
- M1 NL executing, 2 days left
- M7 UK due in 60 days, prep needed
- Revenue target at risk
- 3 blocked tasks

Response: "Two priorities: (1) M1 NL is critical and at risk on revenue — 
get customer acquisition to 75% this week. (2) M7 UK prep should start 
next week to avoid the crunch we had with M1. 

I also see 3 tasks blocked on infrastructure — those need to be unblocked 
today. What's holding them up?"
```

### Example 3: Decision Support
```
Orlando: "Can we launch earlier?"

Hermes analyzes:
- M1 NL 80% complete, 2 days target
- Early launch means 90% rather than 100% complete
- Risks: customer acquisition might not hit target
- Upside: 2-week head start on market

Response: "Technically possible — we're at 80% now. But here's the risk: 
we're already at 60% of our revenue target. Launching at 90% complete 
rather than 100% could push us to 50%, forcing a larger soft launch. 

I'd recommend hitting 90% by tomorrow morning, then launching Wed instead 
of Fri. That gives us one more week of prep without the full engineering 
risk. What do you think?"
```

## Data Flow

```
┌─────────────────────────────────────────┐
│  buildtracker.projects (milestones)    │
│  buildtracker.issues (tasks/blockers)  │
│  hermes.plan_metrics (tracked metrics) │
└─────────────────────┬───────────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │  Monitoring Functions  │
         ├────────────────────────┤
         │ • get_milestone_status │
         │ • identify_plan_risks  │
         │ • generate_plan_alerts │
         └────────────┬───────────┘
                      │
         ┌────────────▼───────────┐
         │  Alert Storage         │
         ├────────────────────────┤
         │ milestone_alerts table │
         │ active_plan_alerts view│
         └────────────┬───────────┘
                      │
         ┌────────────▼─────────────────┐
         │  Hermes Context Generation   │
         ├──────────────────────────────┤
         │ gather_business_plan_context │
         │ refresh_plan_context         │
         └────────────┬────────────────┘
                      │
         ┌────────────▼───────────────────────┐
         │  Hermes Response Generation        │
         ├────────────────────────────────────┤
         │ generate_strategic_response        │
         │ (enhanced with plan context)       │
         └────────────┬──────────────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │  Orlando sees response │
         │  with plan context     │
         └────────────────────────┘
```

## Configuration & Customization

### Enable/Disable Monitoring

To pause monitoring:
```sql
select cron.unschedule('hermes-plan-monitoring');
select cron.unschedule('hermes-plan-monitoring-business-hours');
```

To resume:
```sql
select cron.schedule('hermes-plan-monitoring', '0 * * * *', 
  'select hermes.monitor_all_plans();');
select cron.schedule('hermes-plan-monitoring-business-hours', 
  '*/15 7-18 * * 1-5', 'select hermes.monitor_all_plans();');
```

### Customize Alert Thresholds

Modify `hermes.generate_plan_alerts()` to change when alerts trigger:
- Revenue behind threshold (currently 50% of target)
- Slow progress threshold (currently < 2 active tasks)
- Critical deadline window (currently 7 days)
- Blocked task count (currently > 2 for critical)

### Add New Metrics

1. Create metric records: `hermes.log_plan_metric(company_id, milestone_id, type, value, target)`
2. Update `hermes.generate_plan_alerts()` to reference new metric types
3. Hermes will automatically factor into health assessment

## Monitoring the Monitoring

Check alert health:
```sql
-- View unpresented alerts
select * from hermes.active_plan_alerts;

-- Check monitoring execution
select * from hermes.conversation_logs 
where log_type = 'plan_monitoring' 
order by created_at desc limit 10;

-- Performance summary
select * from hermes.get_plan_performance_summary('company-uuid'::uuid);

-- Current risks
select * from hermes.identify_plan_risks('company-uuid'::uuid);
```

## Future Enhancements

1. **Predictive Risk Scoring**: ML model to predict which milestones will slip
2. **Dependency Tracking**: Alerts when blocking milestones fall behind
3. **Customer Feedback Integration**: Surface NPS/feedback about milestone features
4. **Team Capacity Planning**: Match resource availability to milestone needs
5. **Financial Forecasting**: Project cash impact of milestone delays
6. **Stakeholder Reports**: Automated executive briefings with plan status
7. **What-if Scenarios**: "What if we slip M1 by 2 weeks?"

## Key Takeaways

- **Proactive Monitoring**: Hermes continuously watches your master plan
- **Risk Surfacing**: Critical risks are surfaced before crisis
- **Smart Context**: All Hermes recommendations aligned with business plan
- **Continuous Improvement**: Monitoring data helps refine planning
- **Human-in-Loop**: Orlando always decides; Hermes advises
- **Transparency**: All alerts and recommendations are visible and auditable
