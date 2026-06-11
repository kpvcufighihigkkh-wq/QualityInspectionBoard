"use strict";

const clients = new Set();

function registerClient(response) {
  clients.add(response);
}

function unregisterClient(response) {
  clients.delete(response);
}

function publishBoardUpdated(payload) {
  const body = `event: board-published\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) {
    client.write(body);
  }
}

module.exports = {
  registerClient,
  unregisterClient,
  publishBoardUpdated
};
