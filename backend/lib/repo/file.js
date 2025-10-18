// File-based repository adapter: re-export storage primitives
const {
  listQuotes,
  saveJSON,
  readJSON,
  nextRef,
  OUTPUTS_DIR,
  PDFS_DIR,
} = require('../storage');

module.exports = {
  listQuotes,
  saveJSON,
  readJSON,
  nextRef,
  OUTPUTS_DIR,
  PDFS_DIR,
};
