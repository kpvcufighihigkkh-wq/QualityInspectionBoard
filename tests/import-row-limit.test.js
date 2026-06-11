const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const XLSX = require("xlsx");

const { toTablePayload } = require("../server/adapters/excelAdapter");
const { MAX_ROW_COUNT } = require("../server/config");

function createWorkbookFile(dataRowCount) {
  const tempDir = fs.mkdtempSync(path.join(__dirname, "row-limit-"));
  const filePath = path.join(tempDir, `rows-${dataRowCount}.xlsx`);
  const rows = [["col1", "col2"]];

  for (let index = 0; index < dataRowCount; index += 1) {
    rows.push([`A-${index}`, `B-${index}`]);
  }

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  XLSX.writeFile(workbook, filePath);

  return {
    filePath,
    cleanup() {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  };
}

function run() {
  assert.equal(MAX_ROW_COUNT, 10000);

  const withinLimit = createWorkbookFile(10000);
  try {
    const result = toTablePayload({
      id: "table-a",
      title: "test-table",
      file: {
        path: withinLimit.filePath,
        originalname: "within-limit.xlsx"
      },
      visibleRowCount: 8
    });
    assert.equal(result.rows.length, 10000);
  } finally {
    withinLimit.cleanup();
  }

  const overLimit = createWorkbookFile(10001);
  try {
    assert.throws(
      () =>
        toTablePayload({
          id: "table-a",
          title: "test-table",
          file: {
            path: overLimit.filePath,
            originalname: "over-limit.xlsx"
          },
          visibleRowCount: 8
        }),
      /10000/
    );
  } finally {
    overLimit.cleanup();
  }

  console.log("import row limit tests passed");
}

run();
