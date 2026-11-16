// ABOUTME: Lets tests import image files, as components do for content-hashed URLs.
// ABOUTME: Each image becomes an object whose src is its path under public/.
const path = require("node:path");

const publicDir = path.join(__dirname, "..", "public");

require.extensions[".png"] = (module, filename) => {
  module.exports = { src: `/${path.relative(publicDir, filename)}` };
};
