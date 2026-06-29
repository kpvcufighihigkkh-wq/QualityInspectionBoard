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
              boardTitle: "质量检验看板",
              screenCode: "quality-tv-01"
            },
            publishedAt: "2026-06-26T09:00:00.000Z",
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

  return context;
}

function run() {
  const context = loadTvScript();
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const formatDate = (date) => `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
  const view = context.buildReturnExchangeView({
    headers: ["送货日期", "订单号", "图号", "送货数量", "退换货数量", "退换货日期", "返回日期", "责任人", "需求人"],
    rows: [
      [formatDate(yesterday), "TH-001", "P-001", "10", "2", formatDate(tomorrow), "", "王工", "李工"],
      [formatDate(yesterday), "TH-002", "P-002", "8", "1", formatDate(yesterday), formatDate(yesterday), "赵工", "陈工"]
    ]
  });

  assert.equal(view.metrics[3].label, "日期提醒");
  assert.equal(view.metrics[3].value, "1");
  assert.match(view.content, /<tr class="status-warn">/);
  assert.match(view.content, /<tr class="status-ok">/);
  assert.doesNotMatch(view.content, /已闭环/);
  assert.doesNotMatch(view.content, /待返回/);
  assert.doesNotMatch(view.content, /<th>状态<\/th>/);

  console.log("tv return exchange view tests passed");
}

run();
