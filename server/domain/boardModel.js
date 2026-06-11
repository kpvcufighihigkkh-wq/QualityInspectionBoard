"use strict";

function createEmptyBoardSnapshot() {
  return {
    id: null,
    version: 0,
    status: "empty",
    createdAt: null,
    publishedAt: null,
    meta: {
      boardTitle: "质量检验看板",
      screenCode: "quality-tv-01",
      updatedBy: "",
      sourceType: "excel",
      sourceSummary: ""
    },
    display: {
      rotationMode: "sequential",
      defaultVisibleRowCount: 8
    },
    tables: [
      {
        id: "table-a",
        title: "检验明细",
        sourceName: "",
        durationSeconds: 18,
        visibleRowCount: 8,
        headers: [],
        rows: []
      },
      {
        id: "table-b",
        title: "退换货明细",
        sourceName: "",
        durationSeconds: 18,
        visibleRowCount: 8,
        headers: [],
        rows: []
      },
      {
        id: "table-c",
        title: "月度黑榜",
        sourceName: "",
        durationSeconds: 18,
        visibleRowCount: 8,
        headers: [],
        rows: []
      }
    ]
  };
}

module.exports = {
  createEmptyBoardSnapshot
};
