// Proxy server-side de páginas de parceiros para permitir exibição em iframe.
// Busca o HTML no servidor (sem as restrições de X-Frame-Options do navegador),
// remove cabeçalhos/meta tags que bloqueiam frame, e injeta <base> para que
// imagens/CSS/JS relativos continuem carregando do domínio original.

const ALLOWED_HOSTS = [
  'www.solvia.es',
  'solvia.es',
  'realestate.hipoges.com',
  'hipoges.com',
  'www.idealista.com',
  'idealista.com',
];

module.exports = async (req, res) => {
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

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
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
      // Recurso não-HTML pedido através do proxy: repassa como está.
      const buffer = await upstream.arrayBuffer();
      res.setHeader('Content-Type', contentType);
      res.status(upstream.status).send(Buffer.from(buffer));
      return;
    }

    let html = await upstream.text();

    const baseHref = `${parsed.origin}${parsed.pathname.substring(0, parsed.pathname.lastIndexOf('/') + 1)}`;

    // Remove meta tags de CSP com frame-ancestors (algumas páginas definem via <meta>)
    html = html.replace(/<meta[^>]+http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi, '');

    // Injeta <base> logo após a abertura do <head> para resolver caminhos relativos
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head([^>]*)>/i, `<head$1><base href="${baseHref}">`);
    } else {
      html = `<base href="${baseHref}">` + html;
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Não repassamos X-Frame-Options nem CSP do site original — sem eles,
    // o navegador permite exibir esta resposta (que vem do nosso domínio) em iframe.
    res.status(200).send(html);
  } catch (err) {
    res.status(502).send(
      `<html><body style="font-family:sans-serif;padding:40px;text-align:center;">
        <p>No se pudo cargar el contenido.</p>
        <a href="${parsed.toString()}" target="_blank" rel="noopener noreferrer">Abrir en pestaña nueva ↗</a>
      </body></html>`
    );
  }
};
