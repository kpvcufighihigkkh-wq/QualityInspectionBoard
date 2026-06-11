"use strict";

const { randomUUID } = require("crypto");
const { createEmptyBoardSnapshot } = require("../domain/boardModel");
const { getCurrentBoardSnapshot, getNextVersion, publishBoardSnapshot } = require("../repositories/boardRepository");
const { nowIso } = require("../utils/time");

function getCurrentBoard(screenCode) {
  return getCurrentBoardSnapshot(screenCode) || createEmptyBoardSnapshot();
}

function createAndPublishSnapshot(snapshotInput) {
  const createdAt = nowIso();
  const version = getNextVersion();
  const snapshot = {
    id: randomUUID(),
    version,
    status: "published",
    createdAt,
    publishedAt: createdAt,
    meta: snapshotInput.meta,
    display: snapshotInput.display,
    tables: snapshotInput.tables
  };

  publishBoardSnapshot({
    id: snapshot.id,
    version: snapshot.version,
    screenCode: snapshot.meta.screenCode,
    status: snapshot.status,
    boardTitle: snapshot.meta.boardTitle,
    updatedBy: snapshot.meta.updatedBy,
    sourceType: snapshot.meta.sourceType,
    sourceSummary: snapshot.meta.sourceSummary,
    payloadJson: JSON.stringify(snapshot),
    createdAt: snapshot.createdAt,
    publishedAt: snapshot.publishedAt
  });

  return snapshot;
}

module.exports = {
  getCurrentBoard,
  createAndPublishSnapshot
};
