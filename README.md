# Orlando Core OS

Centrale orchestratielaag voor het volledige Orlando ecosysteem.

## Structuur

```
ORLANDO CORE OS
│
├── AUTH & IDENTITY
├── COMPANIES (multi-tenant, company_id)
├── AI AGENTS
├── WORKFLOW ENGINE
├── NOTIFICATION CENTER
├── CALENDAR & TASKS
├── FILE STORAGE
├── BILLING
├── SYSTEM HEALTH
└── SAAS APPS
     ├── VastgoedScalper   (STRKBEHEER)
     ├── SterkCalc          (STRKBOUW)
     ├── BouwplaatsApp      (STRKBOUW)
     ├── YouTubeAutomation  (Modiwe Media)
     └── MailAutomation     (Modiwerijo)
```

## BV Structuur

| BV | Rol | SaaS |
|----|-----|------|
| Modiwerijo Financial Management BV | AI/IP Holding | Core OS, Automations |
| Modiwe Media BV | Media execution | YouTube, Mail |
| STRKBEHEER BV | Vastgoed + Deals | VastgoedScalper, CRM, Finance |
| STRKBOUW BV | Bouw + Uitvoering | SterkCalc, BouwplaatsApp |
| Bouwproffs BV | Reserve | — |

## Tech Stack

- Frontend: Next.js + Tailwind → Vercel
- Backend: Node.js + Express → Render
- Database: Supabase (single cluster, company_id segmented)
- Executors: Docker / PM2 → Render
- Automation: n8n
- Storage: Supabase Storage / Cloudflare R2
