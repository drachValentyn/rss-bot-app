You have a description of the architecture in @docs/architecture
You have a description of the database in @docs/database
You have a description of the structure in @docs/structure

## Project Overview

**Purpose:** Automated job search aggregator and application tracker for Ukrainian developers
**Status:** MVP in development
**Tech Stack:** TypeScript, Next.js, NestJS, PostgreSQL (Docker), Prisma, Telegram Bot (grammY)
**Target:** Personal use → Small startup (scalable architecture)

---

## Core Problem Solved

Job hunting is chaotic and time-consuming:

- Manual monitoring of multiple job sites (Dou, Djinni, Robota)
- No centralized view of opportunities
- Difficult to track application status
- Hard to manage multiple CV versions

**Solution:** Automated RSS aggregation + web interface + application tracker + Telegram notifications

---

## Technology Decisions & Why

### Database: PostgreSQL 16 in Docker

- **Why:** Self-hosted, no external dependencies, full control
- **Connection:** `postgresql://postgres:postgres@localhost:5432/jobtracker`
- **Start:** `docker-compose up`

### ORM: Prisma 7 (migrations only)

- **Why:** Type-safe migrations, great DX
- **⚠️ Critical:** Uses Prisma 7 with driver adapters (pg adapter required)
- **Schema location:** `prisma/schema.prisma` (root) and `backend/prisma/schema.prisma`
- **Actual queries:** Raw `pg` Pool in all services (bot, web-client, backend)

### Backend: NestJS (RSS worker + REST API)

- **Location:** `backend/`
- **Port:** 3001
- **RSS cron:** 9:00–19:00 hourly (`@Cron('0 9-19 * * *')`)
- **Feeds:** DOU + Djinni
- **API:** GET /vacancies, GET /vacancies/:id, GET /health, POST /rss/collect

### Frontend: Next.js 14+ (App Router)

- **Why:** SSR, API routes, easy deployment to Vercel
- **Structure:** Domain-driven (NOT FSD, NOT Atomic Design)
- **Styling:** MUI (Material-UI) for speed
- **DB:** Reads `DATABASE_URL` from root `.env` or its own `.env`

### Bot: grammY (not node-telegram-bot-api)

- **Why:** Security issues in old library, better TypeScript support
- **RSS:** Removed from bot — handled by NestJS backend

### TypeScript: Mandatory

- **Why:** Fewer bugs, better refactoring, industry standard for startups
- **Config:** CommonJS (not ESM) for compatibility

---

## Prisma Specifics (CRITICAL)

### Version: Prisma 7.3.0+

**Major changes from Prisma 5:**

- Requires driver adapters for PostgreSQL
- Uses `prisma.config.ts` instead of only `schema.prisma`
- Generated client location can be customized

## Key Design Principles

### 1. Type Safety First

- TypeScript everywhere (no `any` unless absolutely necessary)
- Prisma provides DB types automatically
- Validate user input with Zod (planned)

### 2. Simplicity Over Cleverness

- Pragmatic architecture (not over-engineered)
- Can refactor to FSD/Clean Architecture later if needed
- Focus on shipping features, not perfect structure

### 3. Preparation for Scale

- Docker = production-ready from day 1
- Prisma = easy to change schema
- NestJS = easy to add more features
- No technical debt that blocks growth

### 4. User-Centric

- Fast response times (indexed queries)
- Clear UI (MUI components)
- Telegram for quick access, Web for deep work

---

## Running the Project

```bash
# Start PostgreSQL + NestJS backend
docker-compose up

# Start bot (in a separate terminal)
cd bot && node index.js

# Start web client (in a separate terminal)
cd web-client && npm run dev
```

---

## Future Features (Roadmap)

### Phase 1 (Current): MVP

- [x] Database setup (Docker PostgreSQL + Prisma)
- [x] Basic schema (vacancies, users)
- [x] Migration from old SQLite-based bot
- [x] RSS worker (NestJS cron job)
- [x] Bot commands with pg
- [x] Basic web UI (vacancy list)

### Phase 2: Core Features

- [ ] Vacancy filters (date, source, keywords)
- [ ] Application tracker (where applied, status)
- [ ] Resume manager (multiple versions)
- [ ] User authentication (Telegram + email)

### Phase 3: Advanced

- [ ] Auto-categorization (frontend/backend/mobile)
- [ ] AI-powered resume matching
- [ ] Custom RSS sources (user-added)
- [ ] Email notifications
- [ ] Analytics dashboard

### Phase 4: Monetization

- [ ] Freemium model (basic free, advanced paid)
- [ ] Premium filters
- [ ] Unlimited tracked applications
- [ ] API access for recruiters (B2B)

---

## Working with This Project (Agent Instructions)

### Before Writing Code

1. **Check Architecture:** Review this doc's Architecture section
2. **Check Prisma Version:** We use Prisma 7 (requires adapters!)
3. **Check Structure:** Follow domain-driven pattern, not FSD
4. **Check .env:** Ensure DATABASE_URL points to Docker PostgreSQL

### Project Structure

```
rss-job-bot/
├── backend/          # NestJS RSS worker + REST API
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── prisma.service.ts  (pg Pool wrapper)
│   │   ├── rss/               (RSS cron + manual trigger)
│   │   └── vacancies/         (REST API endpoints)
│   ├── prisma/schema.prisma
│   └── Dockerfile
├── bot/              # Telegram bot (grammY)
├── web-client/       # Next.js frontend
├── prisma/           # Root schema (for migrations from host)
├── docker-compose.yml
└── .env              # DATABASE_URL for local services
```

## Contacts & Resources

**Documentation:**

- Prisma: https://www.prisma.io/docs
- NestJS: https://docs.nestjs.com
- Next.js: https://nextjs.org/docs
- grammY: https://grammy.dev

**Project Owner:** Valentyn (Ukrainian developer)
**Development Location:** WSL Ubuntu 24.04 on Windows

---

## Final Notes for Agents

- **Always check latest Prisma docs** - library updates frequently
- **Don't guess** - if unsure about Prisma syntax, search docs first
- **Use Prisma Studio** - visual debugging is faster than console.log
- **Respect architecture** - domain-driven structure is intentional
- **Ask before big changes** - especially to database schema or architecture
- **Supabase is completely removed** - do not reference it

**When in doubt:** Check docker-compose → Verify with pg connect → Read this doc → Search official docs → Ask user

---

_Last Updated: March 3, 2026_
_Prisma Version: 7.3.0_
_NestJS Version: 10.x_
_Next.js Version: 14+_
_Node.js Version: 20+_
