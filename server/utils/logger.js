"use strict";

function logInfo(message, meta) {
  if (meta) {
    console.log(message, meta);
    return;
  }

  console.log(message);
}

function logError(message, error) {
  console.error(message, error);
}

module.exports = {
  logInfo,
  logError
};
