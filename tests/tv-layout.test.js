const assert = require("node:assert/strict");

const { buildStaffingView, formatWeeklyPlan } = require("../public/tv-layout.js");

function run() {
  const weeklyPlanMarkup = formatWeeklyPlan("周一盘点\n周二补货");
  assert.match(weeklyPlanMarkup, /staff-plan-line/);
  assert.match(weeklyPlanMarkup, /周一盘点/);
  assert.match(weeklyPlanMarkup, /周二补货/);

  const view = buildStaffingView({
    headers: ["人员", "项目", "分工", "本周时间", "本周计划"],
    rows: [["张三", "A项目/B项目", "收货、盘点", "周一-周五", "周一盘点\n周二补货"]]
  });

  assert.equal(view.metrics[0].value, "1");
  assert.match(view.content, /staff-card-body/);
  assert.match(view.content, /staff-card-main/);
  assert.match(view.content, /staff-card-side/);
  assert.match(view.content, /staff-plan-panel/);
  assert.match(view.content, /staff-assignment-cluster/);

  console.log("tv layout tests passed");
}

run();
