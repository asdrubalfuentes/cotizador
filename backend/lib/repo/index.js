function getRepo() {
  const backend = (process.env.REPO_BACKEND || 'file').toLowerCase();
  switch (backend) {
    case 'file':
    default:
      return require('./file');
  }
}

module.exports = { getRepo };
