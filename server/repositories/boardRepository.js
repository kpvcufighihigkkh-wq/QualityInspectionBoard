"use strict";

const { db } = require("../storage/db");

const selectCurrentStatement = db.prepare(`
  SELECT payload_json
  FROM board_snapshots
  WHERE screen_code = ? AND status = 'published'
  ORDER BY version DESC
`);

const selectVersionStatement = db.prepare(`
  SELECT COALESCE(MAX(version), 0) AS max_version
  FROM board_snapshots
`);

const archiveCurrentStatement = db.prepare(`
  UPDATE board_snapshots
  SET status = 'archived'
  WHERE screen_code = ? AND status = 'published'
`);

const insertSnapshotStatement = db.prepare(`
  INSERT INTO board_snapshots (
    id, version, screen_code, status, board_title, updated_by, source_type, source_summary, payload_json, created_at, published_at
  ) VALUES (
    @id, @version, @screenCode, @status, @boardTitle, @updatedBy, @sourceType, @sourceSummary, @payloadJson, @createdAt, @publishedAt
  )
`);

const publishTransaction = db.transaction((record) => {
  archiveCurrentStatement.run(record.screenCode);
  insertSnapshotStatement.run(record);
});

function getCurrentBoardSnapshot(screenCode) {
  const row = selectCurrentStatement.get(screenCode);
  return row ? JSON.parse(row.payload_json) : null;
}

function getNextVersion() {
  const row = selectVersionStatement.get();
  return Number(row?.max_version || 0) + 1;
}

function publishBoardSnapshot(record) {
  publishTransaction(record);
}

module.exports = {
  getCurrentBoardSnapshot,
  getNextVersion,
  publishBoardSnapshot
};
