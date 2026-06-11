const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { TextDecoder } = require("node:util");

function createElement() {
  return {
    textContent: "",
    innerHTML: "",
    hidden: false,
    style: {},
    querySelector() {
      return null;
    }
  };
}

function loadTvScript() {
  const elements = new Map();
  const dueCalls = [];
  const context = {
    console,
    TextDecoder,
    URLSearchParams,
    Intl,
    Date,
    Math,
    JSON,
    String,
    Number,
    Boolean,
    Array,
    Object,
    RegExp,
    Promise,
    encodeURIComponent,
    fetch: async () => ({
      ok: true,
      async json() {
        return {
          ok: true,
          snapshot: {
            meta: {
              boardTitle: "AGV仓储系统",
              screenCode: "screen-01"
            },
            publishedAt: "2026-04-16T09:00:00.000Z",
            version: "1",
            tables: []
          }
        };
      }
    }),
    EventSource: class {
      addEventListener() {}
      close() {}
    },
    document: {
      getElementById(id) {
        if (!elements.has(id)) {
          elements.set(id, createElement());
        }
        return elements.get(id);
      }
    }
  };

  context.window = {
    location: {
      search: "",
      reload() {}
    },
    tvDue: {
      classifyMaterialDueStatus(input) {
        dueCalls.push(input);
        return {
          label: "计划内",
          className: "status-ok",
          weight: 2,
          diffDays: 4,
          arrivalOverdue: false,
          inspectionOverdue: false,
          tags: []
        };
      }
    },
    setTimeout() {
      return 1;
    },
    clearTimeout() {},
    setInterval() {
      return 1;
    },
    clearInterval() {},
    requestAnimationFrame() {
      return 1;
    },
    cancelAnimationFrame() {}
  };
  context.globalThis = context;

  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, "..", "public", "tv.js"), "utf8");
  vm.runInContext(source, context, { filename: "tv.js" });

  return { context, dueCalls };
}

function run() {
  const { context, dueCalls } = loadTvScript();

  const view = context.buildMaterialView({
    headers: [],
    rows: [
      ["PJ-01", "PARENT-01", "ITEM-01", "DESC-01", "2", "HT-01", "2026/4/10", "2026/4/20"],
      ["PJ-02", "PARENT-02", "ITEM-02", "DESC-02", "4", "HT-02", "", "2026/4/22"]
    ]
  });

  assert.equal(dueCalls[0].eta, "2026/4/20");
  assert.equal(dueCalls[0].inspectionAt, "2026/4/10");
  assert.equal(view.metrics[0].value, "2");
  assert.equal(view.metrics[1].label, "项目数量");
  assert.equal(view.metrics[1].value, "2");
  assert.match(view.content, /<th class="material-nowrap-col">项目号<\/th>/);
  assert.match(view.content, /<th class="material-nowrap-col">父件编号<\/th>/);
  assert.match(view.content, /<th class="material-nowrap-col">号码<\/th>/);
  assert.match(view.content, /<th class="material-description-col">描述<\/th>/);
  assert.match(view.content, /<th class="material-nowrap-col">计划数量<\/th>/);
  assert.match(view.content, /<th>合同号<\/th>/);
  assert.match(view.content, /<th>送检时间<\/th>/);
  assert.match(view.content, /<th>预计时间<\/th>/);
  assert.match(view.content, /<td class="material-nowrap-col"><span class="code-pill">PJ-01<\/span><\/td>/);
  assert.match(view.content, /<td class="material-nowrap-col"><span class="code-pill">PARENT-01<\/span><\/td>/);
  assert.match(view.content, /<td class="material-nowrap-col"><span class="code-pill">ITEM-01<\/span><\/td>/);
  assert.match(view.content, /<td class="cell-strong material-description-col">DESC-01<\/td>/);
  assert.match(view.content, /PJ-01/);
  assert.match(view.content, /HT-01/);
  assert.doesNotMatch(view.content, /供应商/);

  console.log("tv material view tests passed");
}

run();
