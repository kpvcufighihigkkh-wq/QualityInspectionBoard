"use strict";

const express = require("express");
const { getCurrentBoard } = require("../services/boardService");

const router = express.Router();

router.get("/current", (request, response) => {
  const screenCode = String(request.query.screenCode || "quality-tv-01").trim();
  response.json({
    ok: true,
    snapshot: getCurrentBoard(screenCode)
  });
});

module.exports = router;
