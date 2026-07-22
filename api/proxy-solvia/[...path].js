import { createProxyHandler } from '../../lib/proxyCore.js';

export default createProxyHandler({
  targetOrigin: 'https://www.solvia.es',
  proxyPrefix: '/api/proxy-solvia',
});
