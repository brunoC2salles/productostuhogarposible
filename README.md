# Tu Hogar Posible - Landing de Productos (productostuhogarposible.com)

## Stack
React + TypeScript + Vite + react-router-dom. Deploy no Vercel.

## Rotas
- `/` — Home: apenas a hero (imagem de fundo, logo no canto, headline, e os 2 CTAs "Productos Bancarios" / "Productos Fuera de Cartera"). Sem header.
- `/productos-bancarios` — sem header; logo ao lado do título "Productos Bancarios"; abas "Colaboración Solvia" / "Colaboración Hipoges"
- `/productos-fuera-de-cartera` — sem header; logo ao lado do título

## Sobre os "iframes"
Removi a tentativa de embutir Solvia/Hipoges/Idealista via `<iframe>`. Esses sites, como a maioria dos grandes portais, enviam cabeçalhos HTTP (`X-Frame-Options` e/ou `Content-Security-Policy: frame-ancestors`) que bloqueiam a exibição em iframe de terceiros — isso é decisão do servidor deles, o navegador simplesmente recusa renderizar, e não existe ajuste de código no nosso lado que contorne isso.

Em vez de mostrar um iframe quebrado (o quadro cinza com ícone de "página não encontrada" que apareceu no teste), cada produto agora mostra um cartão limpo com um botão grande "Abrir en pestaña nueva ↗", que leva ao site do parceiro numa aba nova.

## Logo
Correção importante: o `esta.png` tem fundo **preto** (não branco). Reprocessei a transparência removendo pixels próximos do preto e confirmei visualmente (composição sobre fundo cinza) antes de aplicar.

## O que ainda não testei
- Sem capacidade de screenshot/browser neste ambiente para QA visual renderizado. Validei com `npm run build` (sem erros de TypeScript). Recomendo conferir visualmente após o deploy.

## Deploy
```
npm install
npm run build
```
