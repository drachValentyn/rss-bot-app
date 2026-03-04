import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ["http://localhost:3000", "http://localhost:3001"],
    methods: ["GET"],
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`[backend] listening on port ${port}`);
}

bootstrap().catch((err) => {
  console.error("[backend] failed to start:", err);
  process.exit(1);
});
