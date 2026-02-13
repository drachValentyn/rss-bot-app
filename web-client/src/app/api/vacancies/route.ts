import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  const jobs = await db
    .prepare("SELECT * FROM sent_jobs ORDER BY published_at DESC LIMIT 50")
    .all();
  return NextResponse.json(jobs);
}
