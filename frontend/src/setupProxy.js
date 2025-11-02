const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Proxy /api/* requests to backend, stripping /api prefix
  // This matches the nginx configuration for production
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:3001',
      changeOrigin: true,
      pathRewrite: {
        '^/api': '', // Strip /api prefix before forwarding
      },
    })
  );
};

