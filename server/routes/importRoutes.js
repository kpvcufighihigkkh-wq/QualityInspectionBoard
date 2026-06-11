"use strict";

const express = require("express");
const multer = require("multer");
const path = require("path");
const { randomUUID } = require("crypto");
const { UPLOAD_DIR, MAX_FILE_SIZE } = require("../config");
const { processExcelImport } = require("../services/importService");
const { publishBoardUpdated } = require("../services/publishService");

const storage = multer.diskStorage({
  destination: (request, file, callback) => {
    callback(null, UPLOAD_DIR);
  },
  filename: (request, file, callback) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    callback(null, `${Date.now()}-${randomUUID()}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE
  }
});

const router = express.Router();

router.post(
  "/",
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "fileA", maxCount: 1 }
  ]),
  (request, response) => {
    try {
      const result = processExcelImport(request.body, request.files || {});
      publishBoardUpdated({
        screenCode: result.snapshot.meta.screenCode,
        snapshotId: result.snapshot.id,
        version: result.snapshot.version,
        publishedAt: result.snapshot.publishedAt
      });

      response.json({
        ok: true,
        jobId: result.jobId,
        snapshotId: result.snapshot.id,
        version: result.snapshot.version,
        publishedAt: result.snapshot.publishedAt
      });
    } catch (error) {
      response.status(400).json({
        ok: false,
        message: error.message || "导入失败"
      });
    }
  }
);

module.exports = router;
