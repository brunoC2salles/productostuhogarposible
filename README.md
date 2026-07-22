# Tu Hogar Posible - Landing de Productos (productostuhogarposible.com)

## Stack
React + TypeScript + Vite + react-router-dom. Pensado para deploy no Vercel (novo domínio).

## Rotas
- `/` — Home: hero (imagem anexada) + 2 CTAs (Productos Bancarios / Productos Fuera de Cartera)
- `/productos-bancarios` — abas "Colaboración Solvia" (iframe solvia.es) e "Colaboración Hipoges" (iframe hipoges.com)
- `/productos-fuera-de-cartera` — iframe idealista.com

## Decisão importante sobre os iframes (leia antes de testar)
Sites de terceiros podem bloquear serem exibidos em iframe via cabeçalho `X-Frame-Options` ou `Content-Security-Policy: frame-ancestors`, decisão do servidor deles — não há como o nosso código "destravar" isso, e o navegador não dispara sempre um evento de erro confiável quando isso acontece (às vezes só fica em branco).

Por isso, em vez de tentar detectar o bloqueio via JS (não confiável), coloquei um botão fixo "Abrir en pestaña nueva ↗" sempre visível acima de cada iframe, independente de o embed carregar ou não. É a solução mais robusta dada essa limitação técnica.

**Ainda não testei ao vivo se Solvia, Hipoges e Idealista permitem ser embutidos** (não tenho acesso de rede a esses domínios neste ambiente de build). Ao publicar, veja se os iframes carregam de fato — se algum vier em branco, o botão de nova aba já resolve o acesso do usuário, mas pode valer a pena revisar com a área jurídica/comercial se embutir o site de um parceiro é aceitável para eles.

## Assets
- `src/assets/logo.png` — logo oficial (esta.png) com fundo removido (transparência processada)
- `src/assets/hero-bg.jpg` — imagem enviada por você, comprimida (2.1MB → ~290KB) para performance

## O que ainda não testei
- Não tenho capacidade de screenshot/browser neste ambiente para fazer o QA visual completo. Rodei `npm run build` com sucesso (sem erros de TypeScript) mas recomendo rodar `npm run dev` localmente antes de publicar para conferir visualmente.

## Deploy
```
npm install
npm run build
```
Deploy da pasta gerada (`dist/`) ou via integração Git do Vercel apontando para este repositório, com o domínio productostuhogarposible.com.
