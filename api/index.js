/**
 * Vercel serverless entry: rewrites send page requests here with ?path=... so Express
 * receives the original path and can serve the right HTML (home, login, terms, etc.).
 */
const app = require('../server');

module.exports = (req, res) => {
  const path = (req.query && req.query.path) != null ? String(req.query.path) : '';
  const basePath = path ? (path.startsWith('/') ? path : '/' + path) : '/';
  const qs = req.url && req.url.includes('?') ? req.url.replace(/^[^?]*\?/, '').replace(/\bpath=[^&]*&?/g, '').replace(/&$/, '') : '';
  req.url = qs ? basePath + '?' + qs : basePath;
  return app(req, res);
};
