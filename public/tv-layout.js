(function attachTvLayout(globalScope) {
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

    if (!/[脙脗脜脝脟脨脩脴脵脷脹脺脻脼脽脿]/.test(text)) {
      return text;
    }

    try {
      const bytes = Uint8Array.from(text, (char) => char.charCodeAt(0) & 0xff);
      const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      const replacementCount = (decoded.match(/锟/g) || []).length;
      return replacementCount ? text : decoded;
    } catch (error) {
      return text;
    }
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
      const index = normalizedHeaders.indexOf(normalizeHeaderKey(candidate));
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

  function buildStaffingView(table) {
    const headers = Array.isArray(table?.headers) ? table.headers.map(repairMojibake) : [];
    const rows = Array.isArray(table?.rows) ? table.rows : [];
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

    const planMissingCount = normalizedRows.filter((row) => !row.weeklyPlan).length;
    const filledPlanCount = normalizedRows.length - planMissingCount;
    const metrics = [
      { label: "排工人数", value: String(normalizedRows.length), tone: "metric-tone-1" },
      { label: "涉及项目", value: String(new Set(normalizedRows.map((row) => row.projects).filter(Boolean)).size || 0), tone: "metric-tone-2" },
      { label: "计划已填", value: String(filledPlanCount), tone: "metric-tone-4" },
      { label: "待补计划", value: String(planMissingCount), tone: planMissingCount ? "metric-warn metric-tone-3" : "metric-tone-3" }
    ];

    const cards = normalizedRows
      .map((row) => {
        const assignmentTags = String(row.assignment || "")
          .split(/[、,，/]+/)
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) => `<span class="task-pill">${escapeHtml(repairMojibake(item))}</span>`)
          .join("");

        const projectTags = String(row.projects || "")
          .split(/[、,，/]+/)
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 4)
          .map((item) => `<span class="project-mini-pill">${escapeHtml(repairMojibake(item))}</span>`)
          .join("");

        const weeklyPlanMarkup = formatWeeklyPlan(row.weeklyPlan);
        const weeklyTimeMarkup = row.weeklyTime
          ? `<div class="staff-week-range">${escapeHtml(repairMojibake(row.weeklyTime))}</div>`
          : "";
        const fallbackProjects = `<span class="project-pill">${escapeHtml(repairMojibake(row.projects || "未填写生产项目"))}</span>`;
        const fallbackAssignments = `<span class="task-pill task-pill-empty">${escapeHtml(repairMojibake(row.assignment || "未填写"))}</span>`;
        const staffName = escapeHtml(repairMojibake(row.person || "未分配"));
        const staffStatus = escapeHtml(row.weeklyPlan ? "计划已填" : "待补计划");

        return `
        <article class="staff-card ${row.weeklyPlan ? "" : "staff-card-warn"}">
          <div class="staff-card-top">
            <div>
              <div class="staff-name">${staffName}</div>
              <div class="staff-role-line">仓库岗位排工</div>
            </div>
            <div class="staff-badge ${row.weeklyPlan ? "staff-badge-ok" : "staff-badge-warn"}">
              ${staffStatus}
            </div>
          </div>
          <div class="staff-card-body">
            <div class="staff-card-main">
              <div class="staff-projects">${projectTags || fallbackProjects}</div>
              ${weeklyTimeMarkup}
            </div>
            <div class="staff-card-side">
              <div class="staff-assignment-cluster">
                <div class="staff-section-label">工作分工</div>
                <div class="staff-assignment">
                  ${assignmentTags || fallbackAssignments}
                </div>
              </div>
              <div class="staff-plan-panel">
                <div class="staff-section-label">本周计划</div>
                <div class="staff-plan">${weeklyPlanMarkup}</div>
              </div>
            </div>
          </div>
        </article>
      `;
      })
      .join("");

    return {
      metrics,
      content: `<div class="table-scroll table-scroll-single"><div class="staff-grid">${cards}</div></div>`
    };
  }

  const api = {
    buildStaffingView,
    formatWeeklyPlan
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (globalScope) {
    globalScope.tvLayout = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
