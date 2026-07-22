// Proxy server-side de páginas parceiras (Solvia, Hipoges) para permitir
// exibição navegável em iframe.
//
// O que faz:
// 1. Busca o HTML/CSS/JS no servidor (contorna X-Frame-Options do navegador).
// 2. Reescreve href/src/action no HTML, e url() em CSS, para URLs ABSOLUTAS
//    apontando de volta pro nosso próprio domínio via /api/proxy — assim
//    scripts, fontes e navegação continuam same-origin (sem bloqueio de CORS).
// 3. Injeta um script que intercepta fetch()/XMLHttpRequest feitos pelo JS da
//    própria página (buscas/filtros dinâmicos) e os redireciona pelo proxy.
//
// Importante: como o documento recebe <base href="https://dominio-real/...">,
// qualquer URL relativa que eu gere aqui (ex: "/api/proxy?url=...") resolveria
// erradamente contra o domínio REAL, não o nosso. Por isso todo link gerado
// por este proxy é absoluto, incluindo explicitamente o nosso próprio domínio.

const ALLOWED_SUFFIXES = ['solvia.es', 'hipoges.com'];

function isAllowedHost(hostname) {
  return ALLOWED_SUFFIXES.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`));
}

function proxyUrlFor(absUrl, proxyOrigin) {
  return `${proxyOrigin}/api/proxy?url=${encodeURIComponent(absUrl)}`;
}

function rewriteHtml(html, targetOrigin, proxyOrigin) {
  const toProxyUrl = (rawUrl, base) => {
    try {
      const abs = new URL(rawUrl, base);
      if (isAllowedHost(abs.hostname)) {
        return proxyUrlFor(abs.href, proxyOrigin);
      }
      return rawUrl;
    } catch {
      return rawUrl;
    }
  };

  // Remove meta CSP (algumas páginas definem via <meta> em vez de header)
  html = html.replace(/<meta[^>]+http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi, '');

  // Reescreve href / src / action (links, scripts, imagens, formulários)
  html = html.replace(/\b(href|src|action)=(["'])(.*?)\2/gi, (match, attr, quote, url) => {
    if (!url || url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('javascript:') || url.startsWith('data:')) {
      return match;
    }
    return `${attr}=${quote}${toProxyUrl(url, targetOrigin)}${quote}`;
  });

  const shim = `
<script>
(function(){
  var PROXY_ORIGIN = ${JSON.stringify(proxyOrigin)};
  var TARGET_ORIGIN = ${JSON.stringify(targetOrigin)};
  var ALLOWED_SUFFIXES = ${JSON.stringify(ALLOWED_SUFFIXES)};
  function isAllowedHost(hostname) {
    for (var i = 0; i < ALLOWED_SUFFIXES.length; i++) {
      var s = ALLOWED_SUFFIXES[i];
      if (hostname === s || hostname.slice(-(s.length + 1)) === '.' + s) return true;
    }
    return false;
  }
  function toProxied(url) {
    try {
      var abs = new URL(url, TARGET_ORIGIN);
      if (isAllowedHost(abs.hostname)) {
        return PROXY_ORIGIN + '/api/proxy?url=' + encodeURIComponent(abs.href);
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
    try {
      arguments[1] = toProxied(url);
    } catch (e) {}
    return origOpen.apply(this, arguments);
  };
})();
</script>`;

  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head([^>]*)>/i, `<head$1>${shim}`);
  } else {
    html = shim + html;
  }

  return html;
}

function rewriteCss(css, cssFileUrl, proxyOrigin) {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (match, quote, url) => {
    if (!url || url.startsWith('data:')) return match;
    try {
      const abs = new URL(url, cssFileUrl);
      if (isAllowedHost(abs.hostname)) {
        return `url("${proxyUrlFor(abs.href, proxyOrigin)}")`;
      }
    } catch {
      // ignore malformed url()
    }
    return match;
  });
}

export default async function handler(req, res) {
  const target = req.query.url;

  if (!target) {
    res.status(400).send('Falta el parámetro url');
    return;
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    res.status(400).send('URL inválida');
    return;
  }

  if (!isAllowedHost(parsed.hostname)) {
    res.status(403).send('Dominio no permitido');
    return;
  }

  const proxyOrigin = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;

  try {
    const upstream = await fetch(parsed.toString(), {
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
      const rewritten = rewriteCss(css, parsed.href, proxyOrigin);
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      res.status(upstream.status).send(rewritten);
      return;
    }

    if (!contentType.includes('text/html')) {
      // JS, imagens, fontes, JSON, etc.: repassa como está (já same-origin
      // graças à reescrita de src= feita no HTML, então CORS não se aplica).
      const buffer = await upstream.arrayBuffer();
      res.setHeader('Content-Type', contentType || 'application/octet-stream');
      res.status(upstream.status).send(Buffer.from(buffer));
      return;
    }

    let html = await upstream.text();
    html = rewriteHtml(html, parsed.origin, proxyOrigin);

    // <base> resolve assets/relativos que porventura não tenham sido
    // capturados pela reescrita de atributos acima.
    const baseHref = `${parsed.origin}${parsed.pathname.substring(0, parsed.pathname.lastIndexOf('/') + 1)}`;
    html = html.replace(/<head([^>]*)>/i, `<head$1><base href="${baseHref}">`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (err) {
    res.status(502).send(
      `<html><body style="font-family:sans-serif;padding:40px;text-align:center;">
        <p>No se pudo cargar el contenido.</p>
        <a href="${parsed.toString()}" target="_blank" rel="noopener noreferrer">Abrir en pestaña nueva ↗</a>
      </body></html>`
    );
  }
}
