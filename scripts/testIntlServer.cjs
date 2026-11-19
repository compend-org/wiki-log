// ABOUTME: A stand-in for next-intl/server in tests, answering from messages/en.json.
// ABOUTME: Has the parts of the server API the site uses: translations, number and date formats, and the locale.
const { createFormatter, createTranslator } = require("next-intl");
const messages = require("../messages/en.json");

exports.getTranslations = async (namespace) =>
  createTranslator({ locale: "en", messages, namespace });
exports.getFormatter = async () => createFormatter({ locale: "en" });
exports.getLocale = async () => "en";
