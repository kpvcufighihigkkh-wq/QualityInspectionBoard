const assert = require("node:assert/strict");

const { parsePlanDate, classifyMaterialDueStatus } = require("../public/tv-due.js");

function run() {
  const parsedCanonicalDate = parsePlanDate("2026/4/15");
  assert.equal(parsedCanonicalDate.getFullYear(), 2026);
  assert.equal(parsedCanonicalDate.getMonth(), 3);
  assert.equal(parsedCanonicalDate.getDate(), 15);

  assert.equal(parsePlanDate("4/15/26"), null);
  assert.equal(parsePlanDate("2026-04-15"), null);

  const arrivalOverdue = classifyMaterialDueStatus(
    { eta: "2026/4/15" },
    new Date("2026-04-16T09:00:00")
  );
  assert.equal(arrivalOverdue.arrivalOverdue, true);
  assert.equal(arrivalOverdue.inspectionOverdue, false);
  assert.equal(arrivalOverdue.tags[0].label, "到料逾期");

  const inspectionOverdue = classifyMaterialDueStatus(
    { inspectionAt: "2026/4/10" },
    new Date("2026-04-14T09:00:00")
  );
  assert.equal(inspectionOverdue.arrivalOverdue, false);
  assert.equal(inspectionOverdue.inspectionOverdue, true);
  assert.equal(inspectionOverdue.tags[0].label, "送检逾期");

  const bothOverdue = classifyMaterialDueStatus(
    { eta: "2026/4/10", inspectionAt: "2026/4/10" },
    new Date("2026-04-15T09:00:00")
  );
  assert.equal(bothOverdue.arrivalOverdue, true);
  assert.equal(bothOverdue.inspectionOverdue, true);
  assert.equal(bothOverdue.tags.length, 2);

  const planned = classifyMaterialDueStatus(
    { eta: "2026/4/20", inspectionAt: "2026/4/20" },
    new Date("2026-04-15T09:00:00")
  );
  assert.equal(planned.label, "计划内");

  const unknown = classifyMaterialDueStatus(
    { eta: "4/20/26", inspectionAt: "" },
    new Date("2026-04-15T09:00:00")
  );
  assert.equal(unknown.label, "待确认");

  console.log("tv due tests passed");
}

run();
