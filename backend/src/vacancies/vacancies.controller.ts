import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from "@nestjs/common";
import { VacanciesService } from "./vacancies.service";

@Controller()
export class VacanciesController {
  constructor(private readonly vacancies: VacanciesService) {}

  @Get("health")
  health() {
    return { ok: true, timestamp: new Date().toISOString() };
  }

  @Get("vacancies")
  async findAll(
    @Query("limit") limitStr?: string,
    @Query("offset") offsetStr?: string,
  ) {
    const limit = Math.min(Number(limitStr) || 50, 200);
    const offset = Number(offsetStr) || 0;
    return this.vacancies.findAll(limit, offset);
  }

  @Get("vacancies/:id")
  async findOne(@Param("id") id: string) {
    const vacancy = await this.vacancies.findOne(id);
    if (!vacancy) {
      throw new NotFoundException(`Vacancy ${id} not found`);
    }
    return vacancy;
  }
}
