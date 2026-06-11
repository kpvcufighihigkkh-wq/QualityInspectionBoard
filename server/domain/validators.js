"use strict";

const path = require("path");

function requireText(value, fieldName) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw new Error(`${fieldName}不能为空`);
  }

  return normalized;
}

function optionalText(value, fallback = "") {
  return String(value || fallback).trim();
}

function validateExcelFile(file, fieldName) {
  if (!file) {
    throw new Error(`${fieldName}未上传`);
  }

  const extension = path.extname(file.originalname || "").toLowerCase();
  if (![".xlsx", ".xls"].includes(extension)) {
    throw new Error(`${fieldName}仅支持 .xlsx 或 .xls 文件`);
  }

  return file;
}

module.exports = {
  requireText,
  optionalText,
  validateExcelFile
};
