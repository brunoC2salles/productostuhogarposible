// Núcleo compartilhado do proxy de páginas parceiras (Solvia, Hipoges).
//
// IMPORTANTE: o caminho depois do prefixo (ex: /api/proxy-hipoges/assets/x.js)
// chega até esta função via um rewrite do vercel.json (:path* -> ?path=...),
// não via arquivo de rota dinâmica entre colchetes ([...path].js).
//
// Motivo da mudança: confirmamos com header de diagnóstico que caminhos com
// múltiplos níveis de pasta (ex: /api/proxy-hipoges/api/security/csrf-token)
// devolviam 404 do PRÓPRIO VERCEL, antes mesmo de chegar na nossa função —
// ou seja, a rota dinâmica [...path].js não estava sendo confiável para
// múltiplos segmentos aninhados neste tipo de projeto. O rewrite explícito
// no vercel.json é o mecanismo mais robusto e documentado para isso.
//
// Para o navegador, a URL continua sendo um caminho normal (não query string)
// — isso continua importante porque formulários GET substituem toda a query
// string ao enviar, e chunks JS carregados por caminho relativo dependem de
// uma estrutura de pastas real. O rewrite acontece só no lado do servidor,
// então o navegador nunca vê a versão com "?path=".

export function createProxyHandler({ targetOrigin, proxyPrefix }) {
  return async function handler(req, res) {
    const proxyOrigin = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;

    const rawQuery = req.query || {};
    const pathParam = rawQuery.path;
    const pathStr = Array.isArray(pathParam) ? pathParam.join('/') : (pathParam || '');

    const extraParams = new URLSearchParams();
    for (const [key, value] of Object.entries(rawQuery)) {
      if (key === 'path') continue;
      if (Array.isArray(value)) value.forEach((v) => extraParams.append(key, v));
      else extraParams.append(key, value);
    }
    const qs = extraParams.toString();

    const pathname = pathStr.startsWith('/') ? pathStr : '/' + pathStr;
    const targetUrl = targetOrigin + pathname + (qs ? `?${qs}` : '');

    try {
      const upstream = await fetch(targetUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          Accept: '*/*',
          'Accept-Language': 'es-ES,es;q=0.9',
        },
        redirect: 'follow',
      });

      res.setHeader('X-Debug-Target-Url', targetUrl);
      res.setHeader('X-Debug-Upstream-Status', String(upstream.status));

      const contentType = upstream.headers.get('content-type') || '';

      if (contentType.includes('text/css')) {
        const css = await upstream.text();
        const rewritten = rewriteCss(css, targetUrl, proxyOrigin, proxyPrefix, targetOrigin);
        res.setHeader('Content-Type', 'text/css; charset=utf-8');
        res.status(upstream.status).send(rewritten);
        return;
      }

      if (!contentType.includes('text/html')) {
        const buffer = await upstream.arrayBuffer();
        res.setHeader('Content-Type', contentType || 'application/octet-stream');
        res.status(upstream.status).send(Buffer.from(buffer));
        return;
      }

      let html = await upstream.text();

      let resolveBase = targetUrl;
      const baseMatch = html.match(/<base[^>]+href=["']([^"']+)["']/i);
      if (baseMatch) {
        try {
          resolveBase = new URL(baseMatch[1], targetUrl).href;
        } catch {
          // mantém o fallback (targetUrl) se a base do site vier malformada
        }
      }

      html = rewriteHtml(html, resolveBase, proxyOrigin, proxyPrefix, targetOrigin);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(200).send(html);
    } catch (err) {
      res.setHeader('X-Debug-Target-Url', targetUrl);
      res.setHeader('X-Debug-Error', String((err && err.message) || err));
      res.status(502).send(
        `<html><body style="font-family:sans-serif;padding:40px;text-align:center;">
          <p>No se pudo cargar el contenido.</p>
          <a href="${targetUrl}" target="_blank" rel="noopener noreferrer">Abrir en pestaña nueva ↗</a>
        </body></html>`
      );
    }
  };
}

function toProxied(rawUrl, base, proxyOrigin, proxyPrefix, targetOrigin) {
  try {
    const abs = new URL(rawUrl, base);
    if (abs.origin === targetOrigin) {
      return `${proxyOrigin}${proxyPrefix}${abs.pathname}${abs.search}`;
    }
    return rawUrl;
  } catch {
    return rawUrl;
  }
}

function rewriteHtml(html, resolveBase, proxyOrigin, proxyPrefix, targetOrigin) {
  html = html.replace(/<meta[^>]+http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi, '');
  html = html.replace(/<base[^>]*>/i, '');

  html = html.replace(/\b(href|src|action)=(["'])(.*?)\2/gi, (match, attr, quote, url) => {
    if (!url || url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('javascript:') || url.startsWith('data:')) {
      return match;
    }
    return `${attr}=${quote}${toProxied(url, resolveBase, proxyOrigin, proxyPrefix, targetOrigin)}${quote}`;
  });

  const shim = `
<script>
(function(){
  var PROXY_ORIGIN = ${JSON.stringify(proxyOrigin)};
  var PROXY_PREFIX = ${JSON.stringify(proxyPrefix)};
  var TARGET_ORIGIN = ${JSON.stringify(targetOrigin)};
  var RESOLVE_BASE = ${JSON.stringify(resolveBase)};
  function toProxied(url) {
    try {
      var abs = new URL(url, RESOLVE_BASE);
      if (abs.origin === TARGET_ORIGIN) {
        return PROXY_ORIGIN + PROXY_PREFIX + abs.pathname + abs.search;
      }
      // Apps Angular frequentemente montam URLs de API usando
      // location.origin em tempo de execução — que agora é o NOSSO domínio
      // (é assim que o proxy funciona), não o domínio real do parceiro.
      // Se a chamada cair no nosso domínio mas fora do prefixo do proxy,
      // assumimos que era destinada ao site real e corrigimos.
      if (abs.origin === PROXY_ORIGIN && abs.pathname.indexOf(PROXY_PREFIX) !== 0) {
        return PROXY_ORIGIN + PROXY_PREFIX + abs.pathname + abs.search;
      }
    } catch (e) {}
    return url;
  }
  var origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function(input, init) {
      try {
        if (typeof input === 'string') {
          input = toProxied(input);
        } else if (input && typeof input.url === 'string') {
          input = new Request(toProxied(input.url), input);
        }
      } catch (e) {}
      return origFetch.call(this, input, init);
    };
  }
  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    try { arguments[1] = toProxied(url); } catch (e) {}
    return origOpen.apply(this, arguments);
  };
})();
</script>`;

  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head([^>]*)>/i, `<head$1>${shim}`);
  } else {
    html = shim + html;
  }

  const baseP = new URL(resolveBase);
  const baseDir = baseP.pathname.endsWith('/') ? baseP.pathname : baseP.pathname.substring(0, baseP.pathname.lastIndexOf('/') + 1);
  const baseHref = `${proxyOrigin}${proxyPrefix}${baseDir}`;
  html = html.replace(/<head([^>]*)>/i, `<head$1><base href="${baseHref}">`);

  return html;
}

function rewriteCss(css, cssFileUrl, proxyOrigin, proxyPrefix, targetOrigin) {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (match, quote, url) => {
    if (!url || url.startsWith('data:')) return match;
    const proxied = toProxied(url, cssFileUrl, proxyOrigin, proxyPrefix, targetOrigin);
    if (proxied === url) return match;
    return `url("${proxied}")`;
  });
}
