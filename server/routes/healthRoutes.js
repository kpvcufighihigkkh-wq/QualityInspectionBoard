"use strict";

const express = require("express");
const { db } = require("../storage/db");
const { nowIso } = require("../utils/time");

const router = express.Router();

router.get("/", (request, response) => {
  db.prepare("SELECT 1").get();

  response.json({
    ok: true,
    service: "quality-inspection-board",
    time: nowIso(),
    db: "up"
  });
});

module.exports = router;
