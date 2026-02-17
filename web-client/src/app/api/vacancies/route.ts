import { NextResponse } from "next/server";
import { getVacanciesPage } from "@/lib/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");

  const data = await getVacanciesPage(page);
  return NextResponse.json(data);
}
