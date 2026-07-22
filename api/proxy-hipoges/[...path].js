import { createProxyHandler } from '../../lib/proxyCore.js';

export default createProxyHandler({
  targetOrigin: 'https://realestate.hipoges.com',
  proxyPrefix: '/api/proxy-hipoges',
});
