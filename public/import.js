const messageElement = document.getElementById("message");

function setMessage(text, type = "") {
  messageElement.textContent = text;
  messageElement.className = `message ${type}`.trim();
}

function buildFormData() {
  const formData = new FormData();
  const file = document.getElementById("file").files[0];

  if (!file) {
    throw new Error("请选择质检 Excel 文件");
  }

  formData.set("boardTitle", document.getElementById("boardTitle").value.trim());
  formData.set("screenCode", document.getElementById("screenCode").value.trim());
  formData.set("updatedBy", document.getElementById("updatedBy").value.trim());
  formData.set("sourceSummary", document.getElementById("sourceSummary").value.trim());
  formData.set("tableTitleA", document.getElementById("tableTitleA").value.trim());
  formData.set("tableTitleB", document.getElementById("tableTitleB").value.trim());
  formData.set("tableTitleC", document.getElementById("tableTitleC").value.trim());
  formData.set("durationSecondsA", document.getElementById("durationSecondsA").value.trim());
  formData.set("durationSecondsB", document.getElementById("durationSecondsB").value.trim());
  formData.set("durationSecondsC", document.getElementById("durationSecondsC").value.trim());
  formData.set("visibleRowCount", document.getElementById("visibleRowCount").value.trim());
  formData.set("file", file);

  return formData;
}

async function submitImport() {
  const submitButton = document.getElementById("submitBtn");
  submitButton.disabled = true;
  setMessage("正在上传质检 Excel 并等待服务端发布...", "");

  try {
    const formData = buildFormData();
    const notes = document.getElementById("notes").value.trim();
    const currentSummary = formData.get("sourceSummary");
    formData.set("sourceSummary", [currentSummary, notes].filter(Boolean).join(" | "));

    const response = await fetch("/api/imports", {
      method: "POST",
      body: formData
    });

    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.message || "导入失败");
    }

    setMessage(
      `导入成功，已发布版本 V${result.version}。发布时间：${new Date(result.publishedAt).toLocaleString("zh-CN")}，三屏将按配置轮播显示。`,
      "success"
    );
  } catch (error) {
    setMessage(error.message || "导入失败", "error");
  } finally {
    submitButton.disabled = false;
  }
}

document.getElementById("submitBtn").addEventListener("click", submitImport);
