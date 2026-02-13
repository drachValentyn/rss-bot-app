## Architecture

### Current Phase: MVP (Local Development)

```
┌─────────────────────────────────┐
│      Next.js Server             │
│  (TypeScript)                   │
│                                 │
│  ├─ Web UI (React + MUI)        │
│  ├─ API Routes (/api/...)       │
│  └─ Worker (setInterval)        │ ← RSS collection inside Next.js
│                                 │
└────────────┬────────────────────┘
             │
             ├─────────────────┐
             ↓                 ↓
    ┌────────────────┐  ┌─────────────┐
    │ Telegram Bot   │  │  Supabase   │
    │ (TypeScript +  │  │ PostgreSQL  │
    │  grammY)       │  │             │
    └────────┬───────┘  └─────────────┘
             │                 ↑
             └─────────────────┘
                  Prisma ORM
```

### Future Phases

**Phase 2 (Beta for friends):**

- Next.js → Vercel (free)
- Worker → Supabase Edge Functions (serverless cron)
- Bot → Still local

**Phase 3 (Public launch):**

- Bot → VPS ($5/mo) or Railway/Render
- Everything production-ready

---
