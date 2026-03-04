-- CreateTable
CREATE TABLE "vacancies" (
    "id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "company" VARCHAR(255),
    "description" TEXT,
    "url" VARCHAR(1000) NOT NULL,
    "source" VARCHAR(50) NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,
    "raw_data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vacancies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "telegram_id" BIGINT,
    "email" TEXT,
    "username" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vacancies_external_id_key" ON "vacancies"("external_id");

-- CreateIndex
CREATE INDEX "vacancies_published_at_idx" ON "vacancies"("published_at" DESC);

-- CreateIndex
CREATE INDEX "vacancies_source_idx" ON "vacancies"("source");

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
