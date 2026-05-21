# Task Dispatcher Setup

## Environment Variables (.env.local)
```
TASK_DISPATCHER_URL=https://shaunumewswpxhmgbtvv.supabase.co/functions/v1/dispatch-task
TASK_DISPATCHER_API_KEY=RpxGGhrez1ATZk4e5Ih_2S3UOZh8Qq2xUY0uUNazqiM
```

⚠️ **SECURITY**: Place `.env.local` in `.gitignore` and REGENERATE this key on Supabase!

---

## Ready-to-Use curl Command

```bash
curl -X POST https://shaunumewswpxhmgbtvv.supabase.co/functions/v1/dispatch-task \
  -H "x-api-key: RpxGGhrez1ATZk4e5Ih_2S3UOZh8Qq2xUY0uUNazqiM" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "[TAAK NAAM]",
    "prompt": "[VOLLEDIGE OPDRACHT VOOR CLAUDE]",
    "priority": 7
  }'
```

---

## Ready-to-Use JSON Body (for Shortcut/Postman)

```json
{
  "title": "[TAAK NAAM]",
  "prompt": "[VOLLEDIGE OPDRACHT VOOR CLAUDE]",
  "priority": 7
}
```

---

## Usage Examples

### Example 1: Sync Database
```bash
curl -X POST https://shaunumewswpxhmgbtvv.supabase.co/functions/v1/dispatch-task \
  -H "x-api-key: RpxGGhrez1ATZk4e5Ih_2S3UOZh8Qq2xUY0uUNazqiM" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Database Sync",
    "prompt": "Synchroniseer alle databases en check voor fouten",
    "priority": 7
  }'
```

### Example 2: Check for New Tasks
```bash
curl -X POST https://shaunumewswpxhmgbtvv.supabase.co/functions/v1/dispatch-task \
  -H "x-api-key: RpxGGhrez1ATZk4e5Ih_2S3UOZh8Qq2xUY0uUNazqiM" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Check New Tasks",
    "prompt": "Controleer op nieuwe taken in de queue en voer uit",
    "priority": 5
  }'
```

---

## For Shortcut (iOS/Mac Automation)

Copy this exact JSON and paste as "Request Body" in your Shortcut:

```json
{
  "title": "Your Task Name",
  "prompt": "Your complete task instructions here",
  "priority": 7
}
```

Headers needed:
- `x-api-key: RpxGGhrez1ATZk4e5Ih_2S3UOZh8Qq2xUY0uUNazqiM`
- `Content-Type: application/json`

---

## SessionStart Hook (Auto-launch on App Open)

To auto-execute a task when Claude opens, add to `.claude/settings.json`:

```json
{
  "hooks": {
    "session-start": "curl -X POST https://shaunumewswpxhmgbtvv.supabase.co/functions/v1/dispatch-task -H 'x-api-key: RpxGGhrez1ATZk4e5Ih_2S3UOZh8Qq2xUY0uUNazqiM' -H 'Content-Type: application/json' -d '{\"title\": \"Auto-check Tasks\", \"prompt\": \"Check for pending tasks\", \"priority\": 5}'"
  }
}
```

---

**Status**: ✅ Ready to use  
**Last Updated**: 2026-05-21
