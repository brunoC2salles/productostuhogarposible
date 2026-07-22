# Tu Hogar Posible - Landing de Productos (productostuhogarposible.com)

## Stack
React + TypeScript + Vite + react-router-dom + Vercel Serverless Function (`api/proxy.js`) + `vercel.json`.

## Rotas
- `/` — Home: hero em tela cheia, headline "Encuentra Tu Hogar Posible" (1 linha, centralizada), 2 CTAs
- `/productos-bancarios` — abas Solvia / Hipoges, iframe navegável via proxy
- `/productos-fuera-de-cartera` — Idealista: card "Abrir en pestaña nueva" (não usa proxy — ver motivo abaixo)

## Correção crítica: `vercel.json`
Faltava esse arquivo. Sem ele, dar F5 em qualquer rota que não seja `/` retornava 404 (o Vercel tentava achar um arquivo físico `productos-bancarios`, que não existe — é uma rota do React Router, só existe em memória no navegador). O rewrite manda tudo que não é `/api/*` para `index.html`, deixando o React Router assumir o roteamento.

## Proxy (`api/proxy.js`) — versão aprofundada, só Solvia e Hipoges
A primeira versão só entregava a página inicial. Buscas e navegação continuavam quebradas porque sites modernos fazem isso via JavaScript (`fetch`/`XMLHttpRequest`), não por link HTML simples — e essas chamadas, feitas a partir do nosso domínio, eram bloqueadas por CORS.

O que mudei:
- Reescrevo `href`/`action` de links e formulários no HTML para continuarem passando pelo proxy (navegação sem sair do iframe)
- Injeto um script que intercepta `fetch()` e `XMLHttpRequest` feitos pela própria página e redireciona para o proxy também (cobre buscas/filtros dinâmicos)
- Domínio permitido por sufixo (`solvia.es`, `hipoges.com`), cobrindo qualquer subdomínio que eles usem (ex: `api.solvia.es`)

**Limitação honesta — não tenho como testar isso ao vivo neste ambiente (sem acesso de rede a esses domínios).** Essa é a melhor tentativa de engenharia razoável, não uma garantia. Não cobre: WebSockets, Service Workers, ou navegação feita via `window.location` diretamente por JS (sem passar por fetch/XHR/link). Se algo específico continuar quebrado depois do deploy, preciso de prints do erro exato pra continuar ajustando — não dá pra prever todos os casos sem ver o site rodando de verdade.

## Idealista — fora do proxy, por decisão consciente
A tela de "Verificación del dispositivo" em loop infinito é proteção anti-bot ativa (tipo Cloudflare/CAPTCHA) — sistema de segurança real deles, não um bloqueio simples de cabeçalho. Não tentei contornar isso. Idealista usa o card "Abrir en pestaña nueva".

## O que ainda não testei
Sem capacidade de screenshot/browser neste ambiente. Validei com `npm run build` (sem erros de TypeScript) e `node --check api/proxy.js` (sintaxe ok).

## Deploy
```
npm install
npm run build
```
