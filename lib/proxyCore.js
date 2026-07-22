// Núcleo compartilhado do proxy de páginas parceiras (Solvia, Hipoges).
//
// Diferença chave em relação à primeira versão: em vez de um único endpoint
// "/api/proxy?url=<url real>", cada parceiro tem seu próprio prefixo que
// ESPELHA a estrutura de caminhos do site real:
//   /api/proxy-solvia/es/comprar-casa  ->  https://www.solvia.es/es/comprar-casa
//
// Isso existe porque descobrimos (com evidência real de DevTools) dois
// problemas do esquema por query-string:
// 1. Formulários GET substituem toda a query string ao enviar, apagando
//    o parâmetro "url=" de onde dependíamos.
// 2. Scripts que carregam outros arquivos por caminho relativo (comum em
//    apps modernas com code-splitting) resolvem relativo à própria URL do
//    script — que, no esquema antigo, não tinha estrutura de caminho real.
// Espelhar o caminho resolve os dois, porque passa a se comportar como o
// site original se comportaria.

export function createProxyHandler({ targetOrigin, proxyPrefix }) {
  return async function handler(req, res) {
    const proxyOrigin = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
    const incoming = new URL(req.url, 'http://localhost');

    let pathname = incoming.pathname;
    if (pathname.startsWith(proxyPrefix)) {
      pathname = pathname.slice(proxyPrefix.length);
    }
    if (!pathname.startsWith('/')) pathname = '/' + pathname;

    const targetUrl = targetOrigin + pathname + incoming.search;

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
      html = rewriteHtml(html, targetUrl, proxyOrigin, proxyPrefix, targetOrigin);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(200).send(html);
    } catch (err) {
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
    return rawUrl; // Subdomínio/origem diferente: deixa como está (fora do escopo desta versão)
  } catch {
    return rawUrl;
  }
}

function rewriteHtml(html, pageUrl, proxyOrigin, proxyPrefix, targetOrigin) {
  html = html.replace(/<meta[^>]+http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi, '');

  html = html.replace(/\b(href|src|action)=(["'])(.*?)\2/gi, (match, attr, quote, url) => {
    if (!url || url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('javascript:') || url.startsWith('data:')) {
      return match;
    }
    return `${attr}=${quote}${toProxied(url, pageUrl, proxyOrigin, proxyPrefix, targetOrigin)}${quote}`;
  });

  const shim = `
<script>
(function(){
  var PROXY_ORIGIN = ${JSON.stringify(proxyOrigin)};
  var PROXY_PREFIX = ${JSON.stringify(proxyPrefix)};
  var TARGET_ORIGIN = ${JSON.stringify(targetOrigin)};
  function toProxied(url) {
    try {
      var abs = new URL(url, TARGET_ORIGIN);
      if (abs.origin === TARGET_ORIGIN) {
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

  // <base> aponta pro nosso próprio prefixo espelhado (não pro domínio real).
  // Qualquer referência relativa que escapar da reescrita acima (ex: import()
  // dinâmico de um chunk JS) ainda resolve corretamente através do proxy,
  // porque a estrutura de caminhos é a mesma do site original.
  const pageP = new URL(pageUrl);
  const baseDir = pageP.pathname.substring(0, pageP.pathname.lastIndexOf('/') + 1);
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
