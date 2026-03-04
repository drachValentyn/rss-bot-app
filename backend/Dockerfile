FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# ---- runtime ----
FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY --from=builder /app/dist ./dist
COPY prisma/ ./prisma/

# Run migrations then start app
CMD sh -c "npx prisma migrate deploy --schema=prisma/schema.prisma && node dist/main.js"
