## Database Schema

### Core Tables

#### `vacancies`

Primary table for job listings collected from RSS feeds.

```prisma
model Vacancy {
  id          Int      @id @default(autoincrement())
  externalId  String   @unique @map("external_id")  // RSS guid or URL
  title       String   @db.VarChar(500)
  company     String?  @db.VarChar(255)
  description String?  @db.Text
  url         String   @db.VarChar(1000)
  source      String   @db.VarChar(50)              // 'dou', 'djinni', etc.
  publishedAt DateTime @map("published_at")
  rawData     Json?    @map("raw_data")             // Full RSS item
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@index([publishedAt(sort: Desc)])
  @@index([source])
  @@map("vacancies")
}
```

**Design decisions:**

- `externalId` as unique constraint (prevents duplicates from RSS)
- `rawData` JSONB stores original RSS for future parsing improvements
- Indexed by `publishedAt` for fast date filtering
- Snake_case DB columns, camelCase Prisma fields (convention)

#### `users`

Tracks users from both Telegram and web interface.

```prisma
model User {
  id         Int      @id @default(autoincrement())
  telegramId BigInt?  @unique @map("telegram_id")   // For bot users
  email      String?  @unique                        // For web users
  username   String?  @db.VarChar(100)
  createdAt  DateTime @default(now()) @map("created_at")

  @@map("users")
}
```

**Future tables (not yet implemented):**

- `applications` - Track where user applied (company, position, status, notes)
- `resumes` - Store multiple CV versions
- `user_preferences` - Filters, notification settings

---
