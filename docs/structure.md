## Project Structure

```
RSS-JOB-BOT/                     ← Root
├── bot/                         ← Telegram bot (separate process)
│   ├── src/
│   │   └── index.ts
│   └── package.json
│
├── web-client/                  ← Next.js application
│   ├── app/                     ← App Router
│   │   ├── page.tsx
│   │   ├── api/
│   │   │   ├── vacancies/
│   │   │   └── applications/
│   │   ├── vacancies/
│   │   └── applications/
│   ├── components/              ← React components
│   │   ├── ui/                  ← Shared UI (buttons, inputs)
│   │   ├── vacancies/           ← Domain-specific
│   │   └── layout/
│   ├── lib/                     ← Utilities
│   │   └── utils/
│   └── types/
│
├── prisma/                      ← Database schema (shared)
│   ├── schema.prisma
│   └── migrations/
│
├── lib/                         ← Shared code
│   └── prisma.ts                ← Prisma client singleton
│
├── generated/                   ← Prisma generated client
│   └── prisma/
│       └── client/
│
├── .env                         ← Environment variables (NOT in git)
├── prisma.config.ts             ← Prisma 7 config
├── tsconfig.json                ← TypeScript config
└── package.json                 ← Root dependencies
```

### Architecture Pattern: **Pragmatic Domain-Driven**

**NOT using:**

- ❌ FSD (Feature-Sliced Design) - too much overhead for MVP
- ❌ Atomic Design - only for UI, doesn't cover business logic

**Using:**

- ✅ Domain folders (vacancies, applications, users)
- ✅ Colocation (keep related code together)
- ✅ Shared modules for reusable code

**Why:** Fast development, easy to refactor to FSD later if team grows

---
