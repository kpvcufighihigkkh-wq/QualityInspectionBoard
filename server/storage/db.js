"use strict";

const Database = require("better-sqlite3");
const { DATA_DIR, DB_PATH, UPLOAD_DIR } = require("../config");
const { ensureDir } = require("../utils/file");

ensureDir(DATA_DIR);
ensureDir(UPLOAD_DIR);

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS import_jobs (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    source_type TEXT NOT NULL,
    created_by TEXT,
    source_summary TEXT,
    file_a_name TEXT,
    file_b_name TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS board_snapshots (
    id TEXT PRIMARY KEY,
    version INTEGER NOT NULL UNIQUE,
    screen_code TEXT NOT NULL,
    status TEXT NOT NULL,
    board_title TEXT NOT NULL,
    updated_by TEXT,
    source_type TEXT NOT NULL,
    source_summary TEXT,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    published_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_board_snapshots_screen_code_status
  ON board_snapshots(screen_code, status, version DESC);
`);

module.exports = {
  db
};
