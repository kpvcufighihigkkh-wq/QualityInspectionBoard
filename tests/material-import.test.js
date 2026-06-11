const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const XLSX = require("xlsx");

const { toTablePayload } = require("../server/adapters/excelAdapter");

function createWorkbookFile() {
  const tempDir = fs.mkdtempSync(path.join(__dirname, "material-import-"));
  const filePath = path.join(tempDir, "material.xlsx");

  const sheet1Rows = [
    ["项目号", "父件编号", "号码", "描述", "计划数量", "合同号", "送检时间", "预计时间"],
    ["25064", "P-1", "M-1", "desc-1", "3", "HT-1", new Date(2026, 3, 12), new Date(2026, 3, 20)],
    ["25065", "P-2", "M-2", "desc-2", "5", "HT-2", "", "2026/4/25"],
    ["25066", "", "M-3", "", "8", "HT-3", "4/15/26", "bad-format"]
  ];
  const sheet2Rows = [["ignored"], ["ignored-row"]];

  const workbook = XLSX.utils.book_new();
  const sheet1 = XLSX.utils.aoa_to_sheet(sheet1Rows);
  const sheet2 = XLSX.utils.aoa_to_sheet(sheet2Rows);

  sheet1.G2.z = "m/d/yy";
  sheet1.H2.z = "m/d/yy";

  XLSX.utils.book_append_sheet(workbook, sheet1, "Sheet1");
  XLSX.utils.book_append_sheet(workbook, sheet2, "Sheet2");
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
      id: "table-a",
      title: "material-table",
      file: {
        path: workbookFile.filePath,
        originalname: "material.xlsx"
      },
      preferredSheetName: "Sheet1",
      dateColumnIndexes: [6, 7]
    });

    assert.equal(table.rows.length, 3);
    assert.equal(table.rows[0][0], "25064");
    assert.equal(table.rows[0][1], "P-1");
    assert.equal(table.rows[0][5], "HT-1");
    assert.equal(table.rows[0][6], "2026/4/12");
    assert.equal(table.rows[0][7], "2026/4/20");
    assert.equal(table.rows[1][7], "2026/4/25");
    assert.equal(table.rows[2][6], "4/15/26");
    assert.equal(table.rows[2][7], "bad-format");
  } finally {
    workbookFile.cleanup();
  }

  console.log("material import tests passed");
}

run();
