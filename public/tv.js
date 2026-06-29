const boardTitleElement = document.getElementById("boardTitle");
const screenCodeElement = document.getElementById("screenCode");
const updatedAtElement = document.getElementById("updatedAt");
const connectionMetaElement = document.getElementById("connectionMeta");
const screenTitleElement = document.getElementById("screenTitle");
const rotationMetaElement = document.getElementById("rotationMeta");
const rotationCountdownElement = document.getElementById("rotationCountdown");
const rotationFillElement = document.getElementById("rotationFill");
const screenMetricsElement = document.getElementById("screenMetrics");
const screenContentElement = document.getElementById("screenContent");
const emptyStateElement = document.getElementById("emptyState");
const params = new URLSearchParams(window.location.search);
const screenCode = params.get("screen") || "quality-tv-01";
const legacyBoardTitle = "AGV自动化仓储车间";
const currentBoardTitle = "质量检验看板";
let currentVersion = "-";
let currentSnapshot = null;
let activeTableIndex = 0;
let rotationTimer = null;
let scrollAnimationFrame = null;
let scrollDelayTimer = null;
let countdownTimer = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function repairMojibake(value) {
  const text = String(value ?? "");
  if (!text) {
    return "";
  }

  // Repair common UTF-8 -> latin1 mojibake such as "éè´­".
  if (!/[ÃÂÅÆÇÐÑØÙÚÛÜÝÞßà-ÿ]/.test(text)) {
    return text;
  }

  try {
    const bytes = Uint8Array.from(text, (char) => char.charCodeAt(0) & 0xff);
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const replacementCount = (decoded.match(/�/g) || []).length;
    if (!replacementCount) {
      return decoded;
    }
  } catch (error) {
    return text;
  }

  return text;
}

function normalizeBoardTitle(value) {
  const title = repairMojibake(value);
  return title === legacyBoardTitle ? currentBoardTitle : title;
}

function formatDateTime(isoString) {
  if (!isoString) {
    return "未更新";
  }

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "未更新";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "short",
    timeStyle: "medium"
  }).format(date);
}

function parsePlanDate(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return null;
  }

  const parts = normalized.split(/[./-]/).map((item) => Number.parseInt(item, 10));
  if (parts.length !== 3 || parts.some((item) => Number.isNaN(item))) {
    return null;
  }

  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function classifyDueStatus(value) {
  const date = parsePlanDate(value);
  if (!date) {
    return { label: "待确认", className: "status-neutral", weight: 1, diffDays: null };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const planDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((planDay - today) / 86400000);

  if (diffDays < 0) {
    return { label: "已延期", className: "status-danger", weight: 4, diffDays };
  }

  if (diffDays <= 3) {
    return { label: "临近到期", className: "status-warn", weight: 3, diffDays };
  }

  return { label: "计划内", className: "status-ok", weight: 2, diffDays };
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("\n", " ");
}

function normalizeHeaderKey(value) {
  return repairMojibake(value)
    .replace(/\s+/g, "")
    .replace(/[：:]/g, "")
    .trim()
    .toLowerCase();
}

function findHeaderIndex(headers, candidates) {
  const normalizedHeaders = headers.map(normalizeHeaderKey);
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeHeaderKey(candidate);
    const index = normalizedHeaders.indexOf(normalizedCandidate);
    if (index >= 0) {
      return index;
    }
  }

  return -1;
}

function getCellByHeader(row, headers, candidates, fallbackIndex = -1) {
  const headerIndex = findHeaderIndex(headers, candidates);
  if (headerIndex >= 0) {
    return row[headerIndex] ?? "";
  }

  if (fallbackIndex >= 0) {
    return row[fallbackIndex] ?? "";
  }

  return "";
}

function buildMetricsMarkup(metrics) {
  return metrics
    .map((metric, index) => {
      const toneClass = metric.tone || `metric-tone-${(index % 4) + 1}`;
      return `
        <div class="metric-card ${escapeAttr(toneClass)}">
          <div class="metric-label">${escapeHtml(metric.label)}</div>
          <div class="metric-value ${escapeAttr(metric.tone || "")}">${escapeHtml(metric.value)}</div>
        </div>
      `;
    })
    .join("");
}

function buildProcurementView(table) {
  const headers = Array.isArray(table.headers) ? table.headers.map(repairMojibake) : [];
  const rows = Array.isArray(table.rows) ? table.rows : [];
  const normalizedRows = rows.map((row) => {
    const parentCode = getCellByHeader(row, headers, ["父件编号", "父件号", "父项编号"], 0);
    const itemCode = getCellByHeader(row, headers, ["号码", "物料编码", "物料号", "子件编号"], 1);
    const description = getCellByHeader(row, headers, ["描述", "物料描述", "名称"], 2);
    const quantity = getCellByHeader(row, headers, ["计划数量", "数量", "需求数量"], 3);
    const supplier = getCellByHeader(row, headers, ["供应商名称", "供应商", "厂商"], 4);
    const eta = getCellByHeader(row, headers, ["预计时间", "预计到货时间", "到货时间", "交期"], 5);
    const due = window.tvDue?.classifyDueStatus ? window.tvDue.classifyDueStatus(eta) : classifyDueStatus(eta);
    return {
      parentCode,
      itemCode,
      description,
      quantity,
      supplier,
      eta,
      due
    };
  });

  normalizedRows.sort((left, right) => {
    if (right.due.weight !== left.due.weight) {
      return right.due.weight - left.due.weight;
    }

    if (left.due.diffDays == null && right.due.diffDays == null) {
      return 0;
    }

    if (left.due.diffDays == null) {
      return 1;
    }

    if (right.due.diffDays == null) {
      return -1;
    }

    return left.due.diffDays - right.due.diffDays;
  });

  const overdueCount = normalizedRows.filter((row) => row.due.label === "已延期").length;
  const warningCount = normalizedRows.filter((row) => row.due.label === "临近到期").length;
  const supplierCount = new Set(normalizedRows.map((row) => row.supplier).filter(Boolean)).size;

  const metrics = [
    { label: "总计划行数", value: String(normalizedRows.length), tone: "metric-tone-1" },
    { label: "供应商数量", value: String(supplierCount || 0), tone: "metric-tone-2" },
    { label: "延期项", value: String(overdueCount), tone: overdueCount ? "metric-danger metric-tone-3" : "metric-tone-3" },
    { label: "临近到期", value: String(warningCount), tone: warningCount ? "metric-warn metric-tone-4" : "metric-tone-4" }
  ];

  const tableMarkup = normalizedRows
    .map(
      (row) => `
        <tr class="${escapeAttr(row.due.className)}">
          <td><span class="code-pill">${escapeHtml(repairMojibake(row.parentCode))}</span></td>
          <td><span class="code-pill">${escapeHtml(repairMojibake(row.itemCode))}</span></td>
          <td class="cell-strong">${escapeHtml(repairMojibake(row.description))}</td>
          <td><span class="qty-chip">${escapeHtml(row.quantity)}</span></td>
          <td>${escapeHtml(repairMojibake(row.supplier))}</td>
          <td>
            <div>${escapeHtml(repairMojibake(row.eta))}</div>
            <span class="status-pill ${row.due.className}">${escapeHtml(row.due.label)}</span>
          </td>
        </tr>
      `
    )
    .join("");

  return {
    metrics,
    content: `
      <div class="table-scroll table-scroll-single">
        <table class="data-table data-table-tv">
          <thead>
            <tr>
              <th>父件编号</th>
              <th>号码</th>
              <th>描述</th>
              <th>计划数量</th>
              <th>供应商名称</th>
              <th>预计时间</th>
            </tr>
          </thead>
          <tbody>${tableMarkup}</tbody>
        </table>
      </div>
    `
  };
}

function buildMaterialView(table) {
  const headers = Array.isArray(table.headers) ? table.headers.map(repairMojibake) : [];
  const rows = Array.isArray(table.rows) ? table.rows : [];
  const normalizedRows = rows.map((row) => {
    const projectNo = getCellByHeader(row, headers, ["项目号", "项目编号"], 0);
    const parentCode = getCellByHeader(row, headers, ["父件编号", "父件号", "父项编号"], 1);
    const itemCode = getCellByHeader(row, headers, ["号码", "物料编码", "物料号", "子件编号"], 2);
    const description = getCellByHeader(row, headers, ["描述", "物料描述", "名称"], 3);
    const quantity = getCellByHeader(row, headers, ["计划数量", "数量", "需求数量"], 4);
    const contractNo = getCellByHeader(row, headers, ["合同号", "合同编号"], 5);
    const inspectionAt = getCellByHeader(row, headers, ["送检时间"], 6);
    const eta = getCellByHeader(row, headers, ["预计时间", "预计到货时间", "到货时间", "交期"], 7);
    const due = window.tvDue?.classifyMaterialDueStatus
      ? window.tvDue.classifyMaterialDueStatus({ eta, inspectionAt })
      : {
          label: "待确认",
          className: "status-neutral",
          weight: 1,
          diffDays: null,
          arrivalOverdue: false,
          inspectionOverdue: false,
          tags: []
        };

    return {
      projectNo,
      parentCode,
      itemCode,
      description,
      quantity,
      contractNo,
      inspectionAt,
      eta,
      due
    };
  });

  normalizedRows.sort((left, right) => {
    if (right.due.weight !== left.due.weight) {
      return right.due.weight - left.due.weight;
    }

    if (left.due.diffDays == null && right.due.diffDays == null) {
      return 0;
    }

    if (left.due.diffDays == null) {
      return 1;
    }

    if (right.due.diffDays == null) {
      return -1;
    }

    return left.due.diffDays - right.due.diffDays;
  });

  const arrivalOverdueCount = normalizedRows.filter((row) => row.due.arrivalOverdue).length;
  const inspectionOverdueCount = normalizedRows.filter((row) => row.due.inspectionOverdue).length;
  const projectCount = new Set(normalizedRows.map((row) => row.projectNo).filter(Boolean)).size;

  const metrics = [
    { label: "总计划行数", value: String(normalizedRows.length), tone: "metric-tone-1" },
    { label: "项目数量", value: String(projectCount || 0), tone: "metric-tone-2" },
    { label: "到料逾期", value: String(arrivalOverdueCount), tone: arrivalOverdueCount ? "metric-danger metric-tone-3" : "metric-tone-3" },
    { label: "送检逾期", value: String(inspectionOverdueCount), tone: inspectionOverdueCount ? "metric-danger metric-tone-4" : "metric-tone-4" }
  ];

  const tableMarkup = normalizedRows
    .map((row) => {
      const statusMarkup = row.due.tags.length
        ? row.due.tags
            .map((tag) => `<span class="status-pill ${tag.className}">${escapeHtml(tag.label)}</span>`)
            .join("")
        : `<span class="status-pill ${row.due.className}">${escapeHtml(row.due.label)}</span>`;

      return `
        <tr class="${escapeAttr(row.due.className)}">
          <td class="material-nowrap-col"><span class="code-pill">${escapeHtml(repairMojibake(row.projectNo))}</span></td>
          <td class="material-nowrap-col"><span class="code-pill">${escapeHtml(repairMojibake(row.parentCode))}</span></td>
          <td class="material-nowrap-col"><span class="code-pill">${escapeHtml(repairMojibake(row.itemCode))}</span></td>
          <td class="cell-strong material-description-col">${escapeHtml(repairMojibake(row.description))}</td>
          <td><span class="qty-chip">${escapeHtml(row.quantity)}</span></td>
          <td>${escapeHtml(repairMojibake(row.contractNo))}</td>
          <td>${escapeHtml(repairMojibake(row.inspectionAt))}</td>
          <td>${escapeHtml(repairMojibake(row.eta))}</td>
          <td>${statusMarkup}</td>
        </tr>
      `;
    })
    .join("");

  return {
    metrics,
    content: `
      <div class="table-scroll table-scroll-single">
        <table class="data-table data-table-tv">
          <thead>
            <tr>
              <th class="material-nowrap-col">项目号</th>
              <th class="material-nowrap-col">父件编号</th>
              <th class="material-nowrap-col">号码</th>
              <th class="material-description-col">描述</th>
              <th class="material-nowrap-col">计划数量</th>
              <th>合同号</th>
              <th>送检时间</th>
              <th>预计时间</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>${tableMarkup}</tbody>
        </table>
      </div>
    `
  };
}

function buildStaffingView(table) {
  const headers = Array.isArray(table.headers) ? table.headers.map(repairMojibake) : [];
  const rows = Array.isArray(table.rows) ? table.rows : [];
  const normalizedRows = rows
    .map((row) => {
      const person = getCellByHeader(row, headers, ["仓库人员", "人员", "姓名", "负责人"], 1);
      const projects = getCellByHeader(row, headers, ["生产项目", "项目", "项目编号"], 2);
      const assignment = getCellByHeader(row, headers, ["工作分工", "分工", "任务内容"], 3);
      const weeklyTime = getCellByHeader(row, headers, ["本周时间", "周时间", "时间"], 4);
      const weeklyPlan = getCellByHeader(row, headers, ["本周计划", "周计划", "计划"], 4);

      return {
        person,
        projects,
        assignment,
        weeklyTime,
        weeklyPlan
      };
    })
    .filter((row) => row.person || row.projects || row.assignment || row.weeklyTime || row.weeklyPlan);

  normalizedRows.sort((left, right) => {
    const leftPlanMissing = left.weeklyPlan ? 0 : 1;
    const rightPlanMissing = right.weeklyPlan ? 0 : 1;
    if (leftPlanMissing !== rightPlanMissing) {
      return rightPlanMissing - leftPlanMissing;
    }

    return String(left.person || "").localeCompare(String(right.person || ""), "zh-CN");
  });

  const assignmentKeywords = new Set();
  normalizedRows.forEach((row) => {
    String(row.assignment || "")
      .split(/[，,、/]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => assignmentKeywords.add(item));
  });

  const planMissingCount = normalizedRows.filter((row) => !row.weeklyPlan).length;
  const filledPlanCount = normalizedRows.length - planMissingCount;
  const metrics = [
    { label: "排工人数", value: String(normalizedRows.length), tone: "metric-tone-1" },
    { label: "涉及项目", value: String(new Set(normalizedRows.map((row) => row.projects).filter(Boolean)).size || 0), tone: "metric-tone-2" },
    { label: "计划已填", value: String(filledPlanCount), tone: "metric-tone-4" },
    { label: "待补计划", value: String(planMissingCount), tone: planMissingCount ? "metric-warn metric-tone-3" : "metric-tone-3" }
  ];

  const cards = normalizedRows
    .map(
      (row) => {
        const assignmentTags = String(row.assignment || "")
          .split(/[，,、/]/)
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) => `<span class="task-pill">${escapeHtml(repairMojibake(item))}</span>`)
          .join("");

        const projectTags = String(row.projects || "")
          .split(/[，,、]/)
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 4)
          .map((item) => `<span class="project-mini-pill">${escapeHtml(repairMojibake(item))}</span>`)
          .join("");

        const weeklyPlanMarkup = formatWeeklyPlan(row.weeklyPlan);
        const weeklyTimeMarkup = row.weeklyTime
          ? `<div class="staff-week-range">${escapeHtml(repairMojibake(row.weeklyTime))}</div>`
          : "";

        return `
        <article class="staff-card ${row.weeklyPlan ? "" : "staff-card-warn"}">
          <div class="staff-card-top">
            <div>
              <div class="staff-name">${escapeHtml(repairMojibake(row.person || "未分配"))}</div>
              <div class="staff-role-line">仓库岗位排工</div>
            </div>
            <div class="staff-badge ${row.weeklyPlan ? "staff-badge-ok" : "staff-badge-warn"}">
              ${escapeHtml(row.weeklyPlan ? "计划已填" : "待补计划")}
            </div>
          </div>
          <div class="staff-projects">${projectTags || `<span class="project-pill">${escapeHtml(repairMojibake(row.projects || "未填写生产项目"))}</span>`}</div>
          ${weeklyTimeMarkup}
          <div class="staff-section-label">工作分工</div>
          <div class="staff-assignment">
            ${assignmentTags || `<span class="task-pill task-pill-empty">${escapeHtml(repairMojibake(row.assignment || "未填写"))}</span>`}
          </div>
          <div class="staff-section-label">本周计划</div>
          <div class="staff-plan">${weeklyPlanMarkup}</div>
        </article>
      `;
      }
    )
    .join("");

  return {
    metrics,
    content: `<div class="table-scroll table-scroll-single"><div class="staff-grid">${cards}</div></div>`
  };
}

function toNumber(value) {
  const normalized = String(value ?? "").replace(/,/g, "").trim();
  const numberValue = Number(normalized);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function sumBy(rows, getter) {
  return rows.reduce((total, row) => total + toNumber(getter(row)), 0);
}

function isFutureDate(value) {
  const date = parsePlanDate(value);
  if (!date) {
    return false;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return targetDay > today;
}

function buildQualityInspectionView(table) {
  const headers = Array.isArray(table.headers) ? table.headers.map(repairMojibake) : [];
  const rows = Array.isArray(table.rows) ? table.rows : [];
  const normalizedRows = rows.map((row) => ({
    deliveryDate: getCellByHeader(row, headers, ["送货日期"], 0),
    orderNo: getCellByHeader(row, headers, ["订单号"], 1),
    drawingNo: getCellByHeader(row, headers, ["图号"], 2),
    deliveryQty: getCellByHeader(row, headers, ["送货数量"], 3),
    passQty: getCellByHeader(row, headers, ["合格数量"], 4),
    abnormalQty: getCellByHeader(row, headers, ["异常数量"], 5),
    inspectionDate: getCellByHeader(row, headers, ["检验日期"], 6),
    supplier: getCellByHeader(row, headers, ["供应商名称", "供应商"], 7),
    remark: getCellByHeader(row, headers, ["备注"], 8)
  }));

  const totalDeliveryQty = sumBy(normalizedRows, (row) => row.deliveryQty);
  const totalPassQty = sumBy(normalizedRows, (row) => row.passQty);
  const totalAbnormalQty = sumBy(normalizedRows, (row) => row.abnormalQty);
  const abnormalRows = normalizedRows.filter((row) => toNumber(row.abnormalQty) > 0).length;

  const metrics = [
    { label: "检验批次", value: String(normalizedRows.length), tone: "metric-tone-1" },
    { label: "送货数量", value: String(totalDeliveryQty), tone: "metric-tone-2" },
    { label: "合格数量", value: String(totalPassQty), tone: "metric-tone-4" },
    { label: "异常数量", value: String(totalAbnormalQty), tone: totalAbnormalQty ? "metric-danger metric-tone-3" : "metric-tone-3" }
  ];

  const tableMarkup = normalizedRows
    .map((row) => {
      const hasAbnormal = toNumber(row.abnormalQty) > 0;
      return `
        <tr class="${hasAbnormal ? "status-danger" : "status-ok"}">
          <td>${escapeHtml(repairMojibake(row.deliveryDate))}</td>
          <td><span class="code-pill">${escapeHtml(repairMojibake(row.orderNo))}</span></td>
          <td><span class="code-pill">${escapeHtml(repairMojibake(row.drawingNo))}</span></td>
          <td><span class="qty-chip">${escapeHtml(row.deliveryQty)}</span></td>
          <td><span class="qty-chip">${escapeHtml(row.passQty)}</span></td>
          <td><span class="qty-chip">${escapeHtml(row.abnormalQty)}</span></td>
          <td>${escapeHtml(repairMojibake(row.inspectionDate))}</td>
          <td>${escapeHtml(repairMojibake(row.supplier))}</td>
          <td>${escapeHtml(repairMojibake(row.remark))}</td>
          <td><span class="status-pill ${hasAbnormal ? "status-danger" : "status-ok"}">${hasAbnormal ? "存在异常" : "正常"}</span></td>
        </tr>
      `;
    })
    .join("");

  return {
    metrics,
    content: `
      <div class="table-scroll table-scroll-single">
        <table class="data-table data-table-tv">
          <thead>
            <tr>
              <th>送货日期</th>
              <th>订单号</th>
              <th>图号</th>
              <th>送货数量</th>
              <th>合格数量</th>
              <th>异常数量</th>
              <th>检验日期</th>
              <th>供应商名称</th>
              <th>备注</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>${tableMarkup}</tbody>
        </table>
      </div>
    `
  };
}

function buildReturnExchangeView(table) {
  const headers = Array.isArray(table.headers) ? table.headers.map(repairMojibake) : [];
  const rows = Array.isArray(table.rows) ? table.rows : [];
  const normalizedRows = rows.map((row) => ({
    deliveryDate: getCellByHeader(row, headers, ["送货日期"], 0),
    orderNo: getCellByHeader(row, headers, ["订单号"], 1),
    drawingNo: getCellByHeader(row, headers, ["图号"], 2),
    deliveryQty: getCellByHeader(row, headers, ["送货数量"], 3),
    returnQty: getCellByHeader(row, headers, ["退换货数量"], 4),
    returnDate: getCellByHeader(row, headers, ["退换货日期"], 5),
    backDate: getCellByHeader(row, headers, ["返回日期"], 6),
    owner: getCellByHeader(row, headers, ["责任人"], 7),
    requester: getCellByHeader(row, headers, ["需求人"], 8)
  }));

  const reminderRows = normalizedRows.filter((row) => isFutureDate(row.returnDate)).length;
  const metrics = [
    { label: "退换货批次", value: String(normalizedRows.length), tone: "metric-tone-1" },
    { label: "送货数量", value: String(sumBy(normalizedRows, (row) => row.deliveryQty)), tone: "metric-tone-2" },
    { label: "退换货数量", value: String(sumBy(normalizedRows, (row) => row.returnQty)), tone: "metric-danger metric-tone-3" },
    { label: "日期提醒", value: String(reminderRows), tone: reminderRows ? "metric-warn metric-tone-4" : "metric-tone-4" }
  ];

  const tableMarkup = normalizedRows
    .map((row) => {
      const needsReminder = isFutureDate(row.returnDate);
      return `
        <tr class="${needsReminder ? "status-warn" : "status-ok"}">
          <td>${escapeHtml(repairMojibake(row.deliveryDate))}</td>
          <td><span class="code-pill">${escapeHtml(repairMojibake(row.orderNo))}</span></td>
          <td><span class="code-pill">${escapeHtml(repairMojibake(row.drawingNo))}</span></td>
          <td><span class="qty-chip">${escapeHtml(row.deliveryQty)}</span></td>
          <td><span class="qty-chip">${escapeHtml(row.returnQty)}</span></td>
          <td>${escapeHtml(repairMojibake(row.returnDate))}</td>
          <td>${escapeHtml(repairMojibake(row.backDate))}</td>
          <td>${escapeHtml(repairMojibake(row.owner))}</td>
          <td>${escapeHtml(repairMojibake(row.requester))}</td>
        </tr>
      `;
    })
    .join("");

  return {
    metrics,
    content: `
      <div class="table-scroll table-scroll-single">
        <table class="data-table data-table-tv">
          <thead>
            <tr>
              <th>送货日期</th>
              <th>订单号</th>
              <th>图号</th>
              <th>送货数量</th>
              <th>退换货数量</th>
              <th>退换货日期</th>
              <th>返回日期</th>
              <th>责任人</th>
              <th>需求人</th>
            </tr>
          </thead>
          <tbody>${tableMarkup}</tbody>
        </table>
      </div>
    `
  };
}

function buildQualityBlacklistView(table) {
  const headers = Array.isArray(table.headers) ? table.headers.map(repairMojibake) : [];
  const rows = Array.isArray(table.rows) ? table.rows : [];
  const normalizedRows = rows.map((row) => ({
    deliveryDate: getCellByHeader(row, headers, ["送货日期"], 0),
    orderNo: getCellByHeader(row, headers, ["订单号"], 1),
    drawingNo: getCellByHeader(row, headers, ["图号"], 2),
    deliveryQty: getCellByHeader(row, headers, ["送货数量"], 3),
    abnormalQty: getCellByHeader(row, headers, ["异常数量"], 4),
    owner: getCellByHeader(row, headers, ["责任人"], 5)
  }));

  const ownerCount = new Set(normalizedRows.map((row) => row.owner).filter(Boolean)).size;
  const metrics = [
    { label: "黑榜记录", value: String(normalizedRows.length), tone: "metric-tone-1" },
    { label: "异常数量", value: String(sumBy(normalizedRows, (row) => row.abnormalQty)), tone: "metric-danger metric-tone-3" },
    { label: "涉及责任人", value: String(ownerCount), tone: "metric-tone-2" },
    { label: "送货数量", value: String(sumBy(normalizedRows, (row) => row.deliveryQty)), tone: "metric-tone-4" }
  ];

  const tableMarkup = normalizedRows
    .map((row) => `
      <tr class="status-danger">
        <td>${escapeHtml(repairMojibake(row.deliveryDate))}</td>
        <td><span class="code-pill">${escapeHtml(repairMojibake(row.orderNo))}</span></td>
        <td><span class="code-pill">${escapeHtml(repairMojibake(row.drawingNo))}</span></td>
        <td><span class="qty-chip">${escapeHtml(row.deliveryQty)}</span></td>
        <td><span class="qty-chip">${escapeHtml(row.abnormalQty)}</span></td>
        <td>${escapeHtml(repairMojibake(row.owner))}</td>
      </tr>
    `)
    .join("");

  return {
    metrics,
    content: `
      <div class="table-scroll table-scroll-single">
        <table class="data-table data-table-tv">
          <thead>
            <tr>
              <th>送货日期</th>
              <th>订单号</th>
              <th>图号</th>
              <th>送货数量</th>
              <th>异常数量</th>
              <th>责任人</th>
            </tr>
          </thead>
          <tbody>${tableMarkup}</tbody>
        </table>
      </div>
    `
  };
}

function formatWeeklyPlan(value) {
  const text = repairMojibake(String(value || "")).trim();
  if (!text) {
    return `<div class="staff-plan-empty">待补充</div>`;
  }

  const segments = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/。/g, "。\n")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!segments.length) {
    return `<div class="staff-plan-empty">待补充</div>`;
  }

  return segments
    .map((item) => `<div class="staff-plan-line">${escapeHtml(item)}</div>`)
    .join("");
}

function buildGenericView(table) {
  const headers = Array.isArray(table.headers) ? table.headers : [];
  const rows = Array.isArray(table.rows) ? table.rows : [];
  const headMarkup = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const bodyMarkup = rows
    .map(
      (row) => `
        <tr>
          ${headers.map((_, index) => `<td>${escapeHtml(row[index] ?? "")}</td>`).join("")}
        </tr>
      `
    )
    .join("");

  return {
    metrics: [
      { label: "总行数", value: String(rows.length) },
      { label: "列数", value: String(headers.length) }
    ],
    content: `
      <div class="table-scroll table-scroll-single">
        <table class="data-table data-table-tv">
          <thead><tr>${headMarkup}</tr></thead>
          <tbody>${bodyMarkup}</tbody>
        </table>
      </div>
    `
  };
}

function resolveScreenView(table) {
  const title = String(table?.title || "");
  const headers = Array.isArray(table?.headers) ? table.headers.map(repairMojibake) : [];

  if (title.includes("检验明细") || (headers.includes("合格数量") && headers.includes("异常数量"))) {
    return buildQualityInspectionView(table);
  }

  if (title.includes("退换货") || headers.includes("退换货数量")) {
    return buildReturnExchangeView(table);
  }

  if (title.includes("黑榜") || (headers.includes("异常数量") && headers.includes("责任人"))) {
    return buildQualityBlacklistView(table);
  }

  if (title.includes("采购") || headers.includes("供应商名称") || headers.includes("项目号")) {
    return buildMaterialView(table);
  }

  if (title.includes("人员") || headers.includes("仓库人员")) {
    return window.tvLayout?.buildStaffingView ? window.tvLayout.buildStaffingView(table) : buildStaffingView(table);
  }

  return buildGenericView(table);
}

function cancelAnimations() {
  if (rotationTimer) {
    window.clearTimeout(rotationTimer);
    rotationTimer = null;
  }

  if (scrollAnimationFrame) {
    window.cancelAnimationFrame(scrollAnimationFrame);
    scrollAnimationFrame = null;
  }

  if (scrollDelayTimer) {
    window.clearTimeout(scrollDelayTimer);
    scrollDelayTimer = null;
  }

  if (countdownTimer) {
    window.clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function renderEmptyTable(table) {
  screenTitleElement.textContent = table?.title || "未命名屏幕";
  rotationMetaElement.textContent = "当前屏无有效数据";
  rotationCountdownElement.textContent = "--s";
  rotationFillElement.style.width = "0%";
  screenMetricsElement.innerHTML = "";
  screenContentElement.innerHTML = "";
  emptyStateElement.hidden = false;
}

function startCountdown(durationSeconds) {
  const startedAt = Date.now();
  rotationCountdownElement.textContent = `${durationSeconds}s`;
  rotationFillElement.style.width = "0%";

  countdownTimer = window.setInterval(() => {
    const elapsedMs = Date.now() - startedAt;
    const remainSeconds = Math.max(0, Math.ceil((durationSeconds * 1000 - elapsedMs) / 1000));
    const progress = Math.min(100, (elapsedMs / (durationSeconds * 1000)) * 100);
    rotationCountdownElement.textContent = `${remainSeconds}s`;
    rotationFillElement.style.width = `${progress}%`;

    if (remainSeconds <= 0) {
      window.clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }, 250);
}

function renderTable(table, index, totalCount) {
  const headers = Array.isArray(table?.headers) ? table.headers : [];
  const rows = Array.isArray(table?.rows) ? table.rows : [];
  const durationSeconds = Number(table?.durationSeconds || 15);
  const visibleRowCount = Number(table?.visibleRowCount || 8);

  screenTitleElement.textContent = repairMojibake(table?.title || "未命名屏幕");
  rotationMetaElement.textContent = `第 ${index + 1} 屏 / 共 ${totalCount} 屏 · 停留 ${durationSeconds} 秒`;

  if (!headers.length || !rows.length) {
    renderEmptyTable(table);
    return durationSeconds;
  }

  const view = resolveScreenView(table);
  screenMetricsElement.innerHTML = buildMetricsMarkup(view.metrics);
  screenContentElement.innerHTML = view.content;
  emptyStateElement.hidden = true;
  startCountdown(durationSeconds);

  if (rows.length > visibleRowCount) {
    startAutoScroll(durationSeconds);
  }

  return durationSeconds;
}

function startAutoScroll(durationSeconds) {
  const tableScrollElement = screenContentElement.querySelector(".table-scroll");
  if (!tableScrollElement) {
    return;
  }

  const maxScrollTop = tableScrollElement.scrollHeight - tableScrollElement.clientHeight;
  if (maxScrollTop <= 0) {
    return;
  }

  const delayMs = 1200;
  const animationMs = Math.max(2000, durationSeconds * 1000 - delayMs - 1200);
  let startTime = null;

  const step = (timestamp) => {
    if (!startTime) {
      startTime = timestamp;
    }

    const progress = Math.min(1, (timestamp - startTime) / animationMs);
    tableScrollElement.scrollTop = maxScrollTop * progress;

    if (progress < 1) {
      scrollAnimationFrame = window.requestAnimationFrame(step);
    }
  };

  scrollDelayTimer = window.setTimeout(() => {
    scrollAnimationFrame = window.requestAnimationFrame(step);
  }, delayMs);
}

function playNextTable() {
  cancelAnimations();

  const tables = Array.isArray(currentSnapshot?.tables) ? currentSnapshot.tables : [];
  if (!tables.length) {
    renderEmptyTable(null);
    return;
  }

  const table = tables[activeTableIndex];
  const durationSeconds = renderTable(table, activeTableIndex, tables.length);
  activeTableIndex = (activeTableIndex + 1) % tables.length;
  rotationTimer = window.setTimeout(playNextTable, durationSeconds * 1000);
}

function renderBoard(data) {
  currentSnapshot = data;
  boardTitleElement.textContent = normalizeBoardTitle(data?.meta?.boardTitle || currentBoardTitle);
  screenCodeElement.textContent = data?.meta?.screenCode || screenCode;
  updatedAtElement.textContent = formatDateTime(data?.publishedAt || data?.createdAt);
  currentVersion = data?.version || "-";
  connectionMetaElement.textContent = `已连接 / V${currentVersion}`;
  activeTableIndex = 0;
  playNextTable();
}

async function loadBoard() {
  const response = await fetch(`/api/board/current?screenCode=${encodeURIComponent(screenCode)}`, {
    cache: "no-store"
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.message || "加载看板失败");
  }

  renderBoard(payload.snapshot);
}

function subscribeBoardEvents() {
  const eventSource = new EventSource("/events");
  connectionMetaElement.textContent = `连接中 / V${currentVersion}`;

  eventSource.addEventListener("board-published", async (event) => {
    const data = JSON.parse(event.data);
    if (data.screenCode !== screenCode) {
      return;
    }

    if (String(data.version || "") !== String(currentVersion || "")) {
      window.location.reload();
      return;
    }

    await loadBoard();
  });

  eventSource.onerror = () => {
    eventSource.close();
    connectionMetaElement.textContent = `连接断开 / V${currentVersion}`;
    window.setTimeout(subscribeBoardEvents, 3000);
  };
}

loadBoard().catch((error) => {
  connectionMetaElement.textContent = "加载失败";
  screenTitleElement.textContent = error.message || "无法加载当前看板";
});
subscribeBoardEvents();
