// Proxy server-side de páginas parceiras (Solvia, Hipoges) para permitir
// exibição navegável em iframe.
//
// O que faz:
// 1. Busca o HTML no servidor (contorna X-Frame-Options do navegador).
// 2. Reescreve links (<a href>), formulários (<form action>) e <img>/<link>/<script src>
//    que apontem para o mesmo domínio, para que continuem passando pelo proxy
//    (mantendo a navegação dentro do iframe em vez de tentar carregar o site
//    real direto, o que seria bloqueado de novo).
// 3. Injeta um script que intercepta fetch()/XMLHttpRequest feitos pelo JS da
//    própria página (comum em buscas/filtros dinâmicos) e os redireciona pelo
//    proxy também — sem isso, essas chamadas seriam bloqueadas por CORS.
//
// Limitação honesta: isto é engenharia reversa de sites que não controlamos.
// Funciona bem para navegação por link/formulário e para fetch/XHR simples.
// Não cobre 100% dos casos possíveis (ex: WebSockets, Service Workers,
// navegação via window.location feita diretamente por JS).

const ALLOWED_SUFFIXES = ['solvia.es', 'hipoges.com'];

function isAllowedHost(hostname) {
  return ALLOWED_SUFFIXES.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`));
}

function rewriteHtml(html, targetOrigin, proxyOrigin) {
  const toProxyUrl = (rawUrl) => {
    try {
      const abs = new URL(rawUrl, targetOrigin);
      if (isAllowedHost(abs.hostname)) {
        return `/api/proxy?url=${encodeURIComponent(abs.href)}`;
      }
      return rawUrl;
    } catch {
      return rawUrl;
    }
  };

  // Remove meta CSP (algumas páginas definem via <meta> em vez de header)
  html = html.replace(/<meta[^>]+http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi, '');

  // Reescreve href="" e action="" (links e formulários) que sejam relativos
  // ou apontem para o mesmo domínio, para continuarem passando pelo proxy
  html = html.replace(/\b(href|action)=(["'])(.*?)\2/gi, (match, attr, quote, url) => {
    if (!url || url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('javascript:')) {
      return match;
    }
    return `${attr}=${quote}${toProxyUrl(url)}${quote}`;
  });

  const shim = `
<script>
(function(){
  var PROXY_ORIGIN = ${JSON.stringify(proxyOrigin)};
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
      var abs = new URL(url, ${JSON.stringify(targetOrigin)});
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

  try {
    const upstream = await fetch(parsed.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9',
      },
      redirect: 'follow',
    });

    const contentType = upstream.headers.get('content-type') || 'text/html';

    if (!contentType.includes('text/html')) {
      const buffer = await upstream.arrayBuffer();
      res.setHeader('Content-Type', contentType);
      res.status(upstream.status).send(Buffer.from(buffer));
      return;
    }

    let html = await upstream.text();

    const proxyOrigin = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
    html = rewriteHtml(html, parsed.origin, proxyOrigin);

    // Injeta <base> depois do shim para resolver assets relativos (imagens, CSS, JS)
    // diretamente no domínio original — esses não são bloqueados por X-Frame-Options.
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
