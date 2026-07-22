// Núcleo compartilhado do proxy de páginas parceiras (Solvia, Hipoges).
//
// Cada parceiro tem seu próprio prefixo que ESPELHA a estrutura de caminhos
// do site real:  /api/proxy-solvia/es/comprar-casa -> https://www.solvia.es/es/comprar-casa
//
// Histórico de bugs encontrados e corrigidos (com evidência real de DevTools):
// 1. Esquema por query-string (?url=) quebrava com formulários GET (que
//    substituem toda a query string) e com chunks JS carregados por caminho
//    relativo. Resolvido espelhando o caminho real.
// 2. Resolução de URLs relativas usando a URL da própria página, ignorando
//    que apps Angular (como estas) definem sua PRÓPRIA tag <base href="...">
//    que dita como caminhos relativos devem ser resolvidos. Sem isso,
//    reconstruíamos URLs erradas para fontes/JSON/config, e o servidor real
//    respondia 404 porque esse caminho específico não existe lá.
//
// Header de diagnóstico: toda resposta inclui X-Debug-Target-Url com a URL
// exata que buscamos no servidor real — visível na aba Network do navegador
// (clique no request → Headers → Response Headers) para confirmar se a URL
// reconstruída está certa, sem precisar adivinhar.

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

      // Respeita a <base> real do site, se existir, em vez de assumir que
      // caminhos relativos resolvem contra a URL da própria página.
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
      res.setHeader('X-Debug-Error', String(err && err.message || err));
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

function rewriteHtml(html, resolveBase, proxyOrigin, proxyPrefix, targetOrigin) {
  html = html.replace(/<meta[^>]+http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi, '');

  // Remove a <base> original do site — vamos definir a nossa própria abaixo,
  // apontando pro nosso proxy. Manter as duas causaria conflito.
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

  // Nossa própria <base> aponta pro prefixo do proxy, usando o MESMO caminho
  // que a base real do site definia — assim qualquer referência relativa que
  // escapar da reescrita acima ainda resolve corretamente através do proxy.
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
