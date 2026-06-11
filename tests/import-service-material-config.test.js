const assert = require("node:assert/strict");
const path = require("node:path");

const importServicePath = path.join(__dirname, "..", "server", "services", "importService.js");
const excelAdapterPath = path.join(__dirname, "..", "server", "adapters", "excelAdapter.js");
const importJobRepositoryPath = path.join(__dirname, "..", "server", "repositories", "importJobRepository.js");
const boardServicePath = path.join(__dirname, "..", "server", "services", "boardService.js");
const validatorsPath = path.join(__dirname, "..", "server", "domain", "validators.js");
const timePath = path.join(__dirname, "..", "server", "utils", "time.js");

function withStubbedModule(modulePath, exportsValue, fn) {
  const resolvedPath = require.resolve(modulePath);
  const previousEntry = require.cache[resolvedPath];
  require.cache[resolvedPath] = {
    id: resolvedPath,
    filename: resolvedPath,
    loaded: true,
    exports: exportsValue
  };

  try {
    return fn();
  } finally {
    if (previousEntry) {
      require.cache[resolvedPath] = previousEntry;
    } else {
      delete require.cache[resolvedPath];
    }
  }
}

function run() {
  const toTablePayloadCalls = [];

  withStubbedModule(
    excelAdapterPath,
    {
      toTablePayload(input) {
        toTablePayloadCalls.push(input);
        return {
          id: input.id,
          title: input.title,
          headers: [],
          rows: [["value"]],
          visibleRowCount: input.visibleRowCount
        };
      }
    },
    () =>
      withStubbedModule(
        importJobRepositoryPath,
        {
          createImportJob() {},
          updateImportJob() {}
        },
        () =>
          withStubbedModule(
            boardServicePath,
            {
              createAndPublishSnapshot(input) {
                return {
                  meta: input.meta,
                  display: input.display,
                  tables: input.tables
                };
              }
            },
            () =>
              withStubbedModule(
                validatorsPath,
                {
                  requireText(value) {
                    return String(value ?? "").trim();
                  },
                  optionalText(value, fallback) {
                    const text = String(value ?? "").trim();
                    return text || fallback;
                  },
                  validateExcelFile(file) {
                    return file;
                  }
                },
                () =>
                  withStubbedModule(
                    timePath,
                    {
                      nowIso() {
                        return "2026-04-16T09:00:00.000Z";
                      }
                    },
                    () => {
                      delete require.cache[require.resolve(importServicePath)];
                      const { processExcelImport } = require(importServicePath);

                      processExcelImport(
                        {
                          boardTitle: "Quality Board",
                          screenCode: "quality-tv-01",
                          updatedBy: "tester",
                          visibleRowCount: "8"
                        },
                        {
                          file: [{ path: "quality.xlsx", originalname: "quality.xlsx" }]
                        }
                      );

                      delete require.cache[require.resolve(importServicePath)];
                    }
                  )
              )
          )
      )
  );

  assert.equal(toTablePayloadCalls.length, 3);
  assert.equal(toTablePayloadCalls[0].preferredSheetName, "检验明细");
  assert.equal(toTablePayloadCalls[0].requirePreferredSheet, true);
  assert.deepEqual(toTablePayloadCalls[0].dateColumnHeaders, ["送货日期", "检验日期"]);
  assert.equal(toTablePayloadCalls[1].preferredSheetName, "退换货明细");
  assert.equal(toTablePayloadCalls[1].requirePreferredSheet, true);
  assert.deepEqual(toTablePayloadCalls[1].dateColumnHeaders, ["送货日期", "退换货日期", "返回日期"]);
  assert.equal(toTablePayloadCalls[2].preferredSheetName, "月度黑榜");
  assert.equal(toTablePayloadCalls[2].requirePreferredSheet, true);
  assert.equal(toTablePayloadCalls[2].headerRowOffset, 1);
  assert.deepEqual(toTablePayloadCalls[2].dateColumnHeaders, ["送货日期"]);

  console.log("import service quality config tests passed");
}

run();
