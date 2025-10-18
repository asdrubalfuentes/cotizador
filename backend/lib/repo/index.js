function getRepo() {
  const backend = (process.env.REPO_BACKEND || 'file').toLowerCase();
  switch (backend) {
    case 'file':
    default:
      return require('./file');
    case 'mongo':
      return require('./mongo');
  }
}

module.exports = { getRepo };
