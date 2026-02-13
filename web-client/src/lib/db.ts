import "server-only";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const cwd = process.cwd();
const candidates = [
  path.join(cwd, "jobs.db"),
  path.join(cwd, "..", "jobs.db"),
];

const dbPath =
  candidates.find((candidate) => fs.existsSync(candidate)) ??
  path.join(cwd, "jobs.db");

const db = new Database(dbPath);

export default db;
