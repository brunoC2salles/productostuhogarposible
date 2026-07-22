# Tu Hogar Posible - Landing de Productos (productostuhogarposible.com)

## Stack
React + TypeScript + Vite + react-router-dom + 1 Vercel Serverless Function (`api/proxy.js`). Deploy no Vercel.

## Rotas
- `/` — Home: apenas a hero (imagem de fundo, logo no canto, headline em 1 linha maiúscula, e os 2 CTAs "Productos Bancarios" / "Productos Fuera de Cartera"). Sem header.
- `/productos-bancarios` — sem header; logo ao lado do título; abas "Colaboración Solvia" / "Colaboración Hipoges"; iframe real via proxy
- `/productos-fuera-de-cartera` — sem header; logo ao lado do título; iframe real via proxy (Idealista)

## Como o iframe passou a funcionar (`api/proxy.js`)
Solvia, Hipoges e Idealista bloqueiam ser exibidos em iframe via cabeçalhos HTTP (`X-Frame-Options` / CSP `frame-ancestors`) — isso é enviado pelo servidor deles, não é algo visível/editável no HTML.

A solução: `api/proxy.js` roda no nosso servidor (Vercel), busca o HTML da página de destino, e devolve essa mesma página **sem repassar** os cabeçalhos de bloqueio. O iframe no navegador aponta para `/api/proxy?url=...` (nosso próprio domínio) — como quem está bloqueando é o site original e não nós, o navegador permite exibir a resposta do nosso proxy dentro do iframe. Imagens, CSS e JS que a página carrega com caminho relativo continuam vindo direto do domínio original (usei uma tag `<base>` para isso), então a maior parte do visual deve carregar normalmente.

**Limitações reais que preciso deixar claras (não testei ao vivo — sem acesso de rede a esses domínios neste ambiente):**
- Se o site de destino tiver JS de "frame-busting" (script que detecta estar dentro de um iframe e força a navegação para fora dele), o proxy não neutraliza isso — a página pode "escapar" do iframe.
- Buscas/filtros que dependem de chamadas JavaScript (fetch/XHR) podem falhar se usarem cookies de sessão, CORS restrito, ou captchas anti-bot (comum em portais grandes, especialmente Idealista).
- Se o site de destino tiver proteção anti-scraping (Cloudflare challenge, rate limiting), o proxy pode ser bloqueado.
- **Risco de Termos de Uso:** reexibir o site de um terceiro via proxy é diferente de simplesmente linkar para ele. Para Solvia/Hipoges (parceiros formais) provavelmente está alinhado com a colaboração; para Idealista (não é parceiro) recomendo confirmar que isso está OK antes de publicar em produção — portais grandes costumam ter cláusulas explícitas contra isso.

Se algum desses três sites não carregar corretamente dentro do iframe mesmo com o proxy, o link discreto "Abrir en pestaña nueva" no canto superior do painel continua funcionando como alternativa.

## Logo
Fundo real do `esta.png` é preto (não branco) — reprocessado corretamente removendo pixels próximos do preto, confirmado visualmente antes de aplicar.

## H1 da hero
Uma linha, maiúsculo, com `font-size` em `vw` (não em px fixo) para nunca quebrar linha em nenhuma largura de tela — calculado matematicamente para caber, mas não visualizado ao vivo (sem ferramenta de screenshot neste ambiente).

## O que ainda não testei
- Sem capacidade de screenshot/browser neste ambiente. Validei com `npm run build` (sem erros de TypeScript) e `node --check api/proxy.js` (sintaxe ok). Recomendo testar visualmente no celular de verdade após o deploy, e abrir as 3 páginas de produto para confirmar se o proxy realmente carrega Solvia/Hipoges/Idealista.

## Deploy
```
npm install
npm run build
```
O `api/proxy.js` é detectado automaticamente pelo Vercel como Serverless Function.
