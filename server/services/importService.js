"use strict";

const { randomUUID } = require("crypto");
const { toTablePayload } = require("../adapters/excelAdapter");
const { createImportJob, updateImportJob } = require("../repositories/importJobRepository");
const { createAndPublishSnapshot } = require("./boardService");
const { requireText, optionalText, validateExcelFile } = require("../domain/validators");
const { nowIso } = require("../utils/time");

function createImportJobRecord(input) {
  const createdAt = nowIso();
  return {
    id: randomUUID(),
    status: "processing",
    sourceType: "excel",
    createdBy: input.updatedBy,
    sourceSummary: input.sourceSummary,
    fileAName: input.file.originalname,
    fileBName: "",
    errorMessage: "",
    createdAt,
    updatedAt: createdAt
  };
}

function sanitizePositiveInteger(value, fallback) {
  const nextValue = Number.parseInt(String(value || "").trim(), 10);
  return Number.isInteger(nextValue) && nextValue > 0 ? nextValue : fallback;
}

function calculateDurationSeconds(rowCount, visibleRowCount, configuredValue) {
  const manualValue = sanitizePositiveInteger(configuredValue, 0);
  if (manualValue > 0) {
    return manualValue;
  }

  const effectiveRows = Math.max(1, rowCount);
  if (effectiveRows <= visibleRowCount) {
    return Math.min(35, Math.max(15, 8 + effectiveRows * 2));
  }

  return Math.min(60, Math.max(20, 10 + effectiveRows * 2));
}

function buildSnapshotInput(fields, files) {
  const boardTitle = requireText(fields.boardTitle, "看板标题");
  const screenCode = requireText(fields.screenCode, "屏幕编号");
  const updatedBy = requireText(fields.updatedBy, "导入人员");
  const sourceSummary = optionalText(fields.sourceSummary, "Excel 三版面导入");
  const tableTitleA = optionalText(fields.tableTitleA, "检验明细");
  const tableTitleB = optionalText(fields.tableTitleB, "退换货明细");
  const tableTitleC = optionalText(fields.tableTitleC, "月度黑榜");
  const file = validateExcelFile(files.file?.[0] || files.fileA?.[0], "质检 Excel");
  const visibleRowCount = sanitizePositiveInteger(fields.visibleRowCount, 8);

  return {
    boardTitle,
    screenCode,
    updatedBy,
    sourceSummary,
    file,
    tableTitleA,
    tableTitleB,
    tableTitleC,
    visibleRowCount,
    durationSecondsA: fields.durationSecondsA,
    durationSecondsB: fields.durationSecondsB,
    durationSecondsC: fields.durationSecondsC
  };
}

function processExcelImport(fields, files) {
  const input = buildSnapshotInput(fields, files);
  const importJob = createImportJobRecord(input);
  createImportJob(importJob);

  try {
    const tableA = toTablePayload({
      id: "table-a",
      title: input.tableTitleA,
      file: input.file,
      visibleRowCount: input.visibleRowCount,
      preferredSheetName: "检验明细",
      requirePreferredSheet: true,
      dateColumnHeaders: ["送货日期", "检验日期"]
    });

    const tableB = toTablePayload({
      id: "table-b",
      title: input.tableTitleB,
      file: input.file,
      visibleRowCount: input.visibleRowCount,
      preferredSheetName: "退换货明细",
      requirePreferredSheet: true,
      dateColumnHeaders: ["送货日期", "退换货日期", "返回日期"]
    });

    const tableC = toTablePayload({
      id: "table-c",
      title: input.tableTitleC,
      file: input.file,
      visibleRowCount: input.visibleRowCount,
      preferredSheetName: "月度黑榜",
      requirePreferredSheet: true,
      headerRowOffset: 1,
      dateColumnHeaders: ["送货日期"]
    });

    tableA.durationSeconds = calculateDurationSeconds(
      tableA.rows.length,
      input.visibleRowCount,
      input.durationSecondsA
    );
    tableB.durationSeconds = calculateDurationSeconds(
      tableB.rows.length,
      input.visibleRowCount,
      input.durationSecondsB
    );
    tableC.durationSeconds = calculateDurationSeconds(
      tableC.rows.length,
      input.visibleRowCount,
      input.durationSecondsC
    );

    const snapshot = createAndPublishSnapshot({
      meta: {
        boardTitle: input.boardTitle,
        screenCode: input.screenCode,
        updatedBy: input.updatedBy,
        sourceType: "excel",
        sourceSummary: input.sourceSummary
      },
      display: {
        rotationMode: "sequential",
        defaultVisibleRowCount: input.visibleRowCount
      },
      tables: [tableA, tableB, tableC]
    });

    updateImportJob({
      id: importJob.id,
      status: "success",
      errorMessage: "",
      updatedAt: nowIso()
    });

    return {
      jobId: importJob.id,
      snapshot
    };
  } catch (error) {
    updateImportJob({
      id: importJob.id,
      status: "failed",
      errorMessage: error.message || "导入失败",
      updatedAt: nowIso()
    });
    throw error;
  }
}

module.exports = {
  processExcelImport
};
