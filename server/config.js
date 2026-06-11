"use strict";

const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = path.join(ROOT_DIR, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DB_PATH = path.join(DATA_DIR, "quality-inspection-board.db");
const PORT = Number(process.env.PORT || 8094);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_ROW_COUNT = 10000;

module.exports = {
  ROOT_DIR,
  PUBLIC_DIR,
  DATA_DIR,
  UPLOAD_DIR,
  DB_PATH,
  PORT,
  MAX_FILE_SIZE,
  MAX_ROW_COUNT
};
