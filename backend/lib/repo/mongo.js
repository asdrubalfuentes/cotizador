// MongoDB repository adapter (stub). To be implemented.
// This file defines the same API as file.js so routes can switch by env.

async function notImpl() { throw new Error('Mongo repo not implemented yet'); }

module.exports = {
  listQuotes: notImpl,
  saveJSON: notImpl,
  readJSON: notImpl,
  nextRef: notImpl,
  OUTPUTS_DIR: undefined,
  PDFS_DIR: undefined,
};
