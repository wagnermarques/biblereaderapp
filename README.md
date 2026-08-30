# Bíblia PWA

Leitor de Bíblia offline, instalável, feito com Web Components (Lit + Material Web Components) e Vite. Aplicação 100% estática, sem backend, pronta para deploy no GitHub Pages.

## Stack

- **Web Components**: [`@material/web`](https://github.com/material-components/material-web) (Material 3) para os componentes de UI, [Lit](https://lit.dev) para os componentes da aplicação.
- **Build**: [Vite](https://vitejs.dev) + [`vite-plugin-pwa`](https://vite-pwa-org.netlify.app/) (manifest + service worker via Workbox).
- **Roteamento**: hash router simples (`#/joão/3`) — funciona em GitHub Pages sem configuração de servidor.
- **Estado**: `localStorage` para tema, tamanho de fonte, favoritos e destaques; nenhum backend.

## Texto bíblico

O texto incluído é a tradução de **João Ferreira de Almeida (1911)**, em **domínio público**, obtida do projeto open source [BibliaJFAAL/JFAAL](https://github.com/BibliaJFAAL/JFAAL) (MIT license — pasta `original/`, explicitamente descrita ali como domínio público). Por ser a edição de 1911, o texto usa ortografia antiga (ex.: "creou", "fórma", "abysmo") — é autêntico, mas vai parecer arcaico para um leitor de português atual.

Os dados ficam em `public/data/`:

- `books-index.json` — lista leve dos 66 livros (id, nome, testamento, nº de capítulos).
- `books/<id>.json` — texto completo de um livro (carregado sob demanda).

Para regenerar os dados (ou trocar de tradução/fonte):

```bash
curl -L -o source.json \
  https://raw.githubusercontent.com/BibliaJFAAL/JFAAL/main/original/1911-JFAAtualizada.json
node scripts/import-bible-data.mjs source.json
```

Se quiser usar outra tradução, **verifique a licença antes de publicar** — muitas revisões modernas (NVI, ARA, NAA etc.) são protegidas por direitos autorais e não podem ser redistribuídas livremente num site público. `scripts/import-bible-data.mjs` espera o formato `books[].chapters[].verses[].text` usado pela JFAAL; adapte o script se a fonte tiver outro formato.

## Desenvolvimento

```bash
npm install
npm run dev       # servidor de desenvolvimento
npm run build     # build de produção em dist/
npm run preview   # pré-visualiza o build de produção
```

## Deploy no GitHub Pages

1. No GitHub, em **Settings → Pages**, defina **Source: GitHub Actions**.
2. `vite.config.js` já define `base: '/biblereaderapp/'` — atualize `REPO_NAME` nesse arquivo se o repositório tiver outro nome.
3. `main` é a branch de trabalho do dia a dia; `production` é a branch de deploy. Dê push/merge em `production` — o workflow em `.github/workflows/deploy.yml` builda e publica automaticamente a partir dela.

## Estrutura

```
src/
  components/     # <app-shell>, <bible-nav>, <chapter-view>, <search-view>
  services/       # bible-data-service, search-service, storage-service
  styles/         # tokens de cor Material 3 (tema claro/escuro)
  router.js       # hash router
  main.js
public/
  data/           # books-index.json + books/*.json (texto bíblico)
  icons/          # ícones do PWA (placeholders — troque pelos definitivos)
scripts/
  import-bible-data.mjs   # converte uma fonte JSON externa para o formato usado aqui
.github/workflows/deploy.yml
```

## Funcionalidades atuais

- Navegação por livros (Antigo/Novo Testamento) em menu lateral
- Leitura por capítulo com navegação anterior/próximo
- Busca em texto completo (ignora acentos)
- Favoritos e destaque de versículos (clique no versículo)
- Tema claro/escuro/sistema
- Ajuste de tamanho de fonte
- Funciona offline após o primeiro carregamento (todo o texto bíblico é cacheado)
- Instalável como app (PWA)

## Próximos passos sugeridos

- Ícones definitivos (os de `public/icons/` são placeholders gerados por script)
- Suporte a múltiplas traduções (o formato de dados já permite adicionar outras)
- Versículo do dia / aleatório
- Compartilhar/copiar versículo
- Planos de leitura
