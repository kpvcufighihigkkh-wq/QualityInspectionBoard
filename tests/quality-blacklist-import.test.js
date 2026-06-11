const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const XLSX = require("xlsx");

const { toTablePayload } = require("../server/adapters/excelAdapter");

function createWorkbookFile() {
  const tempDir = fs.mkdtempSync(path.join(__dirname, "quality-blacklist-"));
  const filePath = path.join(tempDir, "quality.xlsx");
  const rows = [
    ["6月份质量黑榜", "", "", "", "", ""],
    ["送货日期", "订单号", "图号", "送货数量", "异常数量", "责任人"],
    [new Date(2026, 5, 2), "H050.26.NB.1234", "H050.201.01.02", 5, 1, "张三"]
  ];

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet.A3.z = "m/d/yy";
  XLSX.utils.book_append_sheet(workbook, sheet, "月度黑榜");
  XLSX.writeFile(workbook, filePath);

  return {
    filePath,
    cleanup() {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  };
}

function run() {
  const workbookFile = createWorkbookFile();

  try {
    const table = toTablePayload({
      id: "table-c",
      title: "月度黑榜",
      file: {
        path: workbookFile.filePath,
        originalname: "quality.xlsx"
      },
      preferredSheetName: "月度黑榜",
      requirePreferredSheet: true,
      headerRowOffset: 1,
      dateColumnHeaders: ["送货日期"],
      visibleRowCount: 8
    });

    assert.deepEqual(table.headers.slice(0, 6), ["送货日期", "订单号", "图号", "送货数量", "异常数量", "责任人"]);
    assert.equal(table.rows.length, 1);
    assert.equal(table.rows[0][0], "2026/6/2");
    assert.equal(table.rows[0][1], "H050.26.NB.1234");
    assert.equal(table.rows[0][5], "张三");
  } finally {
    workbookFile.cleanup();
  }

  console.log("quality blacklist import tests passed");
}

run();
