# Migrate Backend to NestJS + PostgreSQL + Docker

Read AGENTS.md for full project context.

## Current State
- RSS worker: Supabase Edge Function (to be removed)
- Database: Supabase PostgreSQL (to be replaced)
- Bot: Node.js + Prisma (connects to Supabase)
- Web: Next.js + Prisma (connects to Supabase)

## Target Architecture
- Backend: NestJS API + PostgreSQL in Docker
- Bot: unchanged code (just change DATABASE_URL)
- Web: unchanged code (just change DATABASE_URL)
- All services connect to local/self-hosted PostgreSQL

## Requirements

### 1. Create NestJS Backend
Location: `backend/` in project root

**Structure:**
```
backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── rss/
│   │   ├── rss.module.ts
│   │   ├── rss.service.ts
│   │   └── rss.controller.ts
│   └── vacancies/
│       ├── vacancies.module.ts
│       ├── vacancies.service.ts
│       └── vacancies.controller.ts
├── Dockerfile
├── docker-compose.yml
└── package.json
```

**Features:**
- Prisma ORM (reuse schema from `/prisma`)
- Cron job: RSS collection 9:00-19:00 hourly (`@Cron('0 9-19 * * *')`)
- REST API: GET /vacancies, GET /vacancies/:id
- Health check: GET /health
- CORS for Next.js client

### 2. RSS Service
Migrate logic from `supabase/functions/rss-worker/` to NestJS

**Sources:**
- https://jobs.dou.ua/vacancies/feeds/ → source: 'dou'
- https://djinni.co/jobs/rss/ → source: 'djinni'

**Logic:**
- Fetch RSS every hour (9-19)
- Parse XML
- Upsert to vacancies table by externalId
- Error handling + logging

### 3. Docker Setup

**docker-compose.yml:**
```yaml
services:
  postgres:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: jobtracker
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data

  backend:
    build: ./backend
    ports: ["3001:3001"]
    depends_on: [postgres]
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/jobtracker
      PORT: 3001

volumes:
  postgres_data:
```

**backend/Dockerfile:**
- Node 20 Alpine
- Multi-stage build
- Install dependencies + Prisma
- Run migrations on startup
- Start NestJS

### 4. Prisma Integration
- Copy `/prisma/schema.prisma` to `backend/prisma/`
- Update datasource url to use Docker PostgreSQL
- Run migrations: `npx prisma migrate deploy`
- Generate client: `npx prisma generate`

### 5. Update Existing Services

**Bot (`bot/.env`):**
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/jobtracker
```

**Web (`web-client/.env`):**
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/jobtracker
```

**Remove:**
- Delete `/supabase` folder entirely
- Remove Supabase dependencies from package.json
- Remove SUPABASE_* env vars

### 6. Migration Steps
1. Create NestJS project structure
2. Setup Docker Compose (PostgreSQL + NestJS)
3. Copy Prisma schema, run migrations
4. Implement RSS cron service
5. Create vacancies API endpoints
6. Start services: `docker-compose up`
7. Update bot/web .env files
8. Test: bot and web work with new DB
9. Delete Supabase folder and configs
10. Update AGENTS.md

## Technical Stack
- NestJS (latest stable)
- PostgreSQL 16 in Docker
- Prisma 7 with pg adapter
- TypeScript strict mode
- Docker Compose v3.8+

## Definition of Done
- [ ] `docker-compose up` starts everything
- [ ] PostgreSQL accessible at localhost:5432
- [ ] NestJS API at localhost:3001
- [ ] RSS cron runs successfully
- [ ] GET /vacancies returns data
- [ ] Bot works with new DB
- [ ] Web works with new DB
- [ ] Supabase completely removed
- [ ] AGENTS.md updated

Start with Docker setup, then NestJS, then migrate services.
