import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { RssModule } from "./rss/rss.module";
import { VacanciesModule } from "./vacancies/vacancies.module";

@Module({
  imports: [ScheduleModule.forRoot(), RssModule, VacanciesModule],
})
export class AppModule {}
