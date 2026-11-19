// ABOUTME: Lets tests run server code that asks next-intl for translations outside a request.
// ABOUTME: next-intl/server needs a request, so tests get a stand-in that answers from the English messages.
const Module = require("node:module");
const path = require("node:path");

const stand_in = path.join(__dirname, "testIntlServer.cjs");
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "next-intl/server") return stand_in;
  return resolve.call(this, request, ...rest);
};
