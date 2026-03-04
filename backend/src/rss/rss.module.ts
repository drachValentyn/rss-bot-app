import { Module } from "@nestjs/common";
import { VacanciesModule } from "../vacancies/vacancies.module";
import { RssController } from "./rss.controller";
import { RssService } from "./rss.service";

@Module({
  imports: [VacanciesModule],
  controllers: [RssController],
  providers: [RssService],
})
export class RssModule {}
