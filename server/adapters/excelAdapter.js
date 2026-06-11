"use strict";

const path = require("path");
const XLSX = require("xlsx");
const { MAX_ROW_COUNT } = require("../config");

function normalizeCell(value) {
  return String(value ?? "").trim();
}

function normalizeHeaderName(value) {
  return normalizeCell(value).replace(/\s+/g, "");
}

function findLastMeaningfulHeaderIndex(headers) {
  for (let index = headers.length - 1; index >= 0; index -= 1) {
    if (headers[index]) {
      return index;
    }
  }

  return -1;
}

function formatCanonicalDate(year, month, day) {
  return `${year}/${month}/${day}`;
}

function formatExcelDateCell(cell) {
  if (!cell) {
    return "";
  }

  if (typeof cell.v === "number") {
    const parsed = XLSX.SSF.parse_date_code(cell.v);
    if (parsed?.y && parsed?.m && parsed?.d) {
      return formatCanonicalDate(parsed.y, parsed.m, parsed.d);
    }
  }

  const displayText = normalizeCell(cell.w);
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(displayText)) {
    return displayText;
  }

  const rawText = normalizeCell(cell.v);
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(rawText)) {
    return rawText;
  }

  return rawText || displayText;
}

function parseWorksheetRows(sheet, options = {}) {
  const ref = sheet["!ref"];
  if (!ref) {
    return [];
  }

  const range = XLSX.utils.decode_range(ref);
  const headerRowOffset = Number.isInteger(options.headerRowOffset) && options.headerRowOffset >= 0
    ? options.headerRowOffset
    : 0;
  const headerRowIndex = range.s.r + headerRowOffset;

  if (headerRowIndex > range.e.r) {
    return [];
  }

  const headerRow = [];

  for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
    const cellRef = XLSX.utils.encode_cell({ r: headerRowIndex, c: columnIndex });
    const cell = sheet[cellRef];
    headerRow.push(normalizeCell(cell?.w ?? cell?.v ?? ""));
  }

  const dateHeaders = new Set(
    (options.dateColumnHeaders || []).map((header) => normalizeHeaderName(header))
  );
  const dateColumnIndexes = new Set([
    ...((options.dateColumnIndexes || []).filter((index) => Number.isInteger(index) && index >= 0)),
    ...headerRow
      .map((header, index) => (dateHeaders.has(normalizeHeaderName(header)) ? index : -1))
      .filter((index) => index >= 0)
  ]);

  const rows = [headerRow];

  for (let rowIndex = headerRowIndex + 1; rowIndex <= range.e.r; rowIndex += 1) {
    const row = [];
    for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      const cell = sheet[cellRef];
      const logicalColumnIndex = columnIndex - range.s.c;
      row.push(
        dateColumnIndexes.has(logicalColumnIndex)
          ? formatExcelDateCell(cell)
          : normalizeCell(cell?.w ?? cell?.v ?? "")
      );
    }
    rows.push(row);
  }

  return rows;
}

function toTablePayload(options) {
  const workbook = XLSX.readFile(options.file.path, { cellDates: false });
  const preferredSheetName = String(options.preferredSheetName || "").trim();
  const sheetName = preferredSheetName && workbook.Sheets[preferredSheetName]
    ? preferredSheetName
    : workbook.SheetNames[0];

  if (preferredSheetName && options.requirePreferredSheet && !workbook.Sheets[preferredSheetName]) {
    throw new Error(`${options.title} 未找到工作表：${preferredSheetName}`);
  }

  if (!sheetName) {
    throw new Error(`${options.title} 未找到可用工作表`);
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = parseWorksheetRows(sheet, {
    dateColumnIndexes: options.dateColumnIndexes,
    dateColumnHeaders: options.dateColumnHeaders,
    headerRowOffset: options.headerRowOffset
  });

  if (!rows.length) {
    throw new Error(`${options.title} 工作表没有数据`);
  }

  const [rawHeaders, ...rawDataRows] = rows;
  const initialHeaders = Array.isArray(rawHeaders) ? rawHeaders.map(normalizeCell) : [];
  const lastHeaderIndex = findLastMeaningfulHeaderIndex(initialHeaders);
  const headers = lastHeaderIndex >= 0 ? initialHeaders.slice(0, lastHeaderIndex + 1) : [];

  if (!headers.some(Boolean)) {
    throw new Error(`${options.title} 缺少有效表头`);
  }

  const dataRows = rawDataRows
    .map((row) => (Array.isArray(row) ? row.slice(0, headers.length).map(normalizeCell) : []))
    .filter((row) => row.some(Boolean));

  if (dataRows.length > MAX_ROW_COUNT) {
    throw new Error(`${options.title} 数据行数超过限制(${MAX_ROW_COUNT})`);
  }

  return {
    id: options.id,
    title: options.title,
    sourceName: `${path.basename(options.file.originalname)}/${sheetName}`,
    durationSeconds: Number(options.durationSeconds),
    visibleRowCount: Number(options.visibleRowCount),
    headers,
    rows: dataRows
  };
}

module.exports = {
  toTablePayload
};
