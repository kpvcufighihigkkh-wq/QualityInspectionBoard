"use strict";

const { db } = require("../storage/db");

const insertStatement = db.prepare(`
  INSERT INTO import_jobs (
    id, status, source_type, created_by, source_summary, file_a_name, file_b_name, error_message, created_at, updated_at
  ) VALUES (
    @id, @status, @sourceType, @createdBy, @sourceSummary, @fileAName, @fileBName, @errorMessage, @createdAt, @updatedAt
  )
`);

const updateStatement = db.prepare(`
  UPDATE import_jobs
  SET status = @status,
      error_message = @errorMessage,
      updated_at = @updatedAt
  WHERE id = @id
`);

function createImportJob(record) {
  insertStatement.run(record);
}

function updateImportJob(record) {
  updateStatement.run(record);
}

module.exports = {
  createImportJob,
  updateImportJob
};
