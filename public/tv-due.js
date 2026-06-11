(function attachTvDue(globalScope) {
  const DAY_IN_MS = 24 * 60 * 60 * 1000;

  function buildDate(year, month, day) {
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  function startOfDay(value) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  function addDays(value, days) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate() + days);
  }

  function parsePlanDate(value) {
    const text = String(value ?? "").trim();
    if (!text) {
      return null;
    }

    const matched = text.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!matched) {
      return null;
    }

    const [, rawYear, rawMonth, rawDay] = matched;
    return buildDate(
      Number.parseInt(rawYear, 10),
      Number.parseInt(rawMonth, 10),
      Number.parseInt(rawDay, 10)
    );
  }

  function classifyMaterialDueStatus(input = {}, now = new Date()) {
    const today = startOfDay(now);
    const expectedDate = parsePlanDate(input.expectedDate ?? input.eta);
    const inspectionDate = parsePlanDate(input.inspectionDate ?? input.inspectionAt);
    const inspectionDeadline = inspectionDate ? addDays(inspectionDate, 3) : null;
    const tags = [];

    if (expectedDate && expectedDate < today) {
      tags.push({
        key: "arrival",
        label: "到料逾期",
        className: "status-danger"
      });
    }

    if (inspectionDeadline && inspectionDeadline < today) {
      tags.push({
        key: "inspection",
        label: "送检逾期",
        className: "status-danger"
      });
    }

    const candidateDates = [expectedDate, inspectionDeadline].filter(Boolean);
    const nearestDate = candidateDates.length
      ? new Date(Math.min(...candidateDates.map((value) => value.getTime())))
      : null;
    const diffDays = nearestDate
      ? Math.floor((nearestDate.getTime() - today.getTime()) / DAY_IN_MS)
      : null;

    if (tags.length) {
      return {
        label: tags.map((tag) => tag.label).join(" / "),
        className: "status-danger",
        weight: tags.length > 1 ? 5 : 4,
        diffDays,
        arrivalOverdue: tags.some((tag) => tag.key === "arrival"),
        inspectionOverdue: tags.some((tag) => tag.key === "inspection"),
        tags
      };
    }

    if (nearestDate) {
      return {
        label: "计划内",
        className: "status-ok",
        weight: 2,
        diffDays,
        arrivalOverdue: false,
        inspectionOverdue: false,
        tags: []
      };
    }

    return {
      label: "待确认",
      className: "status-neutral",
      weight: 1,
      diffDays: null,
      arrivalOverdue: false,
      inspectionOverdue: false,
      tags: []
    };
  }

  const api = {
    parsePlanDate,
    classifyMaterialDueStatus
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (globalScope) {
    globalScope.tvDue = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
