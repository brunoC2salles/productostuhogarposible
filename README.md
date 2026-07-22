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

## Update — causa raiz real dos scripts/fontes quebrados (com evidência de DevTools)
Com os prints reais de Console/Network, achei 2 bugs concretos (não mais suposição):
1. Só reescrevia `href`/`action`, não `src` — os JS de Solvia são ES modules, que exigem CORS por padrão do navegador mesmo sem X-Frame-Options envolvido. Sem isso, o app JS deles nunca inicializava.
2. Os links que eu gerava eram relativos (`/api/proxy?url=...`), mas como a página tem `<base href>` apontando pro domínio real, isso resolvia errado (voltava pro domínio deles, não pro nosso). Corrigido para URLs absolutas.

Também passei a reescrever `url()` dentro de CSS (fontes via `@font-face` também precisam ser same-origin).

**Resíduo observado nos prints, sem solução no nosso lado:** o Cookiebot (banner de cookies) de Solvia/Hipoges recusa renderizar porque o domínio `productostuhogarposible.vercel.app` não está autorizado no projeto deles do Cookiebot — isso é configuração do lado deles, não corrigível via proxy. Provavelmente inofensivo, mas se algo ficar condicionado ao consentimento de cookies, pode ser a causa.

Preciso do mesmo teste de DevTools (Console + Network) depois deste deploy para confirmar se os scripts agora carregam.

## Reestruturação: proxy por caminho espelhado (não mais query-string)
Motivo: você reportou "falta el parámetro url" ao pesquisar dentro do Solvia embutido. Causa raiz: formulários HTML com método GET substituem TODA a query string ao enviar — isso apagava o `?url=...` de onde o proxy antigo dependia. Isso, junto com os chunks 404 da Hipoges (scripts carregando outros arquivos por caminho relativo, que resolviam errado contra `/api/proxy?url=...`), me convenceu que o esquema por query-string tinha um problema estrutural, não pontual.

**Nova estrutura:**
- `/api/proxy-solvia/[...path].js` → espelha `https://www.solvia.es/<path>`
- `/api/proxy-hipoges/[...path].js` → espelha `https://realestate.hipoges.com/<path>`
- `lib/proxyCore.js` → lógica compartilhada (busca, reescrita de HTML/CSS, injeção do shim de fetch/XHR)

Como isso é diferente: `/api/proxy-solvia/es/comprar-casa` em vez de `/api/proxy?url=https://www.solvia.es/es/comprar-casa`. Isso faz com que:
- Formulários GET continuem funcionando (a query string do formulário substitui só os parâmetros de busca, o caminho — que é o que identifica qual site estamos espelhando — permanece intacto)
- Caminhos relativos usados por scripts (comum em code-splitting de apps modernas) resolvam corretamente, porque agora a URL do proxy tem a mesma estrutura de diretórios do site real

**Limitação consciente desta versão:** só cobre o domínio principal de cada parceiro (`www.solvia.es`, `realestate.hipoges.com`). Se alguma parte do site carregar recursos de um subdomínio diferente (ex: `cdn.solvia.es`), esse recurso específico não passa pelo proxy — carrega direto, o que funciona para imagens simples mas pode falhar para scripts/fontes que exigem CORS. Não tenho como saber se isso acontece sem testar ao vivo.

Precisa de outro round de DevTools (Console + Network) depois deste deploy para confirmar se resolveu.

## Update 2 — arquitetura de proxy por prefixo (mais robusta)
Trocado o esquema `/api/proxy?url=...` por `/api/proxy-solvia/<caminho>` e `/api/proxy-hipoges/<caminho>`, que espelham a estrutura de pastas do site real. Lógica compartilhada em `lib/proxyCore.js`.

Motivo: o esquema por query-string tinha 2 problemas descobertos com evidência real de DevTools:
1. Chunks JS carregados por caminho relativo (code-splitting) resolviam contra a própria URL do script — que na query-string não tinha estrutura de caminho real, gerando 404 em massa (visto no Hipoges).
2. Formulários GET (comuns em buscas) substituem toda a query string ao enviar — apagaria o `?url=` de quem dependíamos.

Com o path espelhado, `<base>` aponta pro próprio prefixo do proxy (não pro domínio real), então qualquer referência relativa que escape da reescrita ainda resolve corretamente.

**Limitação que ainda não descartei:** se Hipoges carregar algum recurso (fonte, chunk) de um subdomínio diferente de `realestate.hipoges.com` (ex: um CDN separado), esse recurso específico não seria proxied por este esquema ainda — só saberemos se isso é o caso com um novo teste de DevTools.

## Update 3 — respeitar a <base> real do site + header de diagnóstico
Os 404s de fontes/i18n/config/csrf-token vinham de reconstruirmos a URL real errada — resolvíamos caminhos relativos contra a URL da página, mas apps Angular (que é o que Solvia/Hipoges parecem ser) definem sua própria `<base href="...">`, que dita como isso deveria ser feito. Agora leio essa tag do HTML real antes de reescrever qualquer coisa.

Toda resposta do proxy agora inclui os headers `X-Debug-Target-Url` (URL exata que buscamos no servidor real) e `X-Debug-Upstream-Status` (o status que esse servidor respondeu). Se algo ainda 404, dá pra ver na aba Network → clicar no request → Headers → Response Headers, e eu já sei exatamente qual URL errada estamos montando, sem precisar de mais uma rodada de suposição.

**Resíduo não investigado:** um erro "productos-bancarios:1 404" aparece nos prints, na página raiz (não dentro do iframe). Não achei nenhuma referência no código que explique isso — pode ser cosmético (erro de script sem stack trace, que o Chrome atribui à página por padrão). Não é prioridade a menos que volte a aparecer de forma consistente e bloqueante.

## Update 4 — causa raiz DEFINITIVA confirmada: roteamento do Vercel, não lógica do proxy
Com o header de diagnóstico, veio a prova definitiva: o corpo da resposta 404 era `{"error":{"code":"404","message":"The page could not be found"}}` — esse é o formato de erro do PRÓPRIO VERCEL (confirmado pelo header `Server: Vercel`), não algo que nosso código gera. Isso provou que essas requisições nunca chegavam na nossa função — o roteamento do Vercel rejeitava antes.

Padrão identificado: caminhos com 1 segmento (`/api/proxy-hipoges/es`) funcionavam; caminhos com múltiplos níveis (`/api/proxy-hipoges/api/security/csrf-token`) não. A rota dinâmica por nome de arquivo entre colchetes (`api/proxy-hipoges/[...path].js`) não estava sendo confiável para múltiplos segmentos aninhados neste tipo de projeto (Vite/zero-config, não Next.js).

**Correção:** troquei para arquivos de função simples (`api/proxy-solvia.js`, `api/proxy-hipoges.js`, sem colchetes) + `rewrites` explícitos no `vercel.json`, que é o mecanismo de roteamento mais robusto e documentado do Vercel para este tipo de captura de caminho. Do lado do navegador nada muda (a URL continua parecendo um caminho normal, não query string) — o rewrite acontece só no servidor.
