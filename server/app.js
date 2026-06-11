"use strict";

const express = require("express");
const path = require("path");
const { PORT, PUBLIC_DIR } = require("./config");
const boardRoutes = require("./routes/boardRoutes");
const importRoutes = require("./routes/importRoutes");
const healthRoutes = require("./routes/healthRoutes");
const { registerClient, unregisterClient } = require("./services/publishService");
const { logError, logInfo } = require("./utils/logger");

function createApp() {
  const app = express();

  app.use((request, response, next) => {
    if (/\.(html|js|css)$/i.test(request.path)) {
      response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      response.setHeader("Pragma", "no-cache");
      response.setHeader("Expires", "0");
      response.setHeader("Surrogate-Control", "no-store");
    }

    next();
  });

  app.use(
    express.static(PUBLIC_DIR, {
      extensions: ["html"],
      etag: false,
      maxAge: 0
    })
  );
  app.use("/api/board", boardRoutes);
  app.use("/api/imports", importRoutes);
  app.use("/health", healthRoutes);

  app.get("/events", (request, response) => {
    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    });

    response.write("retry: 3000\n\n");
    registerClient(response);

    request.on("close", () => {
      unregisterClient(response);
    });
  });

  app.get("/", (request, response) => {
    response.sendFile(path.join(PUBLIC_DIR, "tv.html"));
  });

  app.use((error, request, response, next) => {
    if (error?.code === "LIMIT_FILE_SIZE") {
      response.status(400).json({
        ok: false,
        message: "上传文件超过大小限制"
      });
      return;
    }

    logError("Unhandled request error", error);
    response.status(500).json({
      ok: false,
      message: "服务内部错误"
    });
  });

  return app;
}

function startServer() {
  const app = createApp();
  app.listen(PORT, () => {
    logInfo(`Quality inspection board server is running at http://localhost:${PORT}`);
  });
}

module.exports = {
  createApp,
  startServer
};
