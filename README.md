# Bíblia PWA

Leitor de Bíblia offline, instalável, feito com Web Components (Lit + Material Web Components) e Vite. Aplicação 100% estática, sem backend, pronta para deploy no GitHub Pages.

## Stack

- **Web Components**: [`@material/web`](https://github.com/material-components/material-web) (Material 3) para os componentes de UI, [Lit](https://lit.dev) para os componentes da aplicação.
- **Build**: [Vite](https://vitejs.dev) + [`vite-plugin-pwa`](https://vite-pwa-org.netlify.app/) (manifest + service worker via Workbox).
- **Roteamento**: hash router simples (`#/joão/3`) — funciona em GitHub Pages sem configuração de servidor.
- **Estado**: `localStorage` para tema, tamanho de fonte e favoritos — funciona 100% offline sem nenhuma conta.
- **Login (opcional)**: [Supabase](https://supabase.com) (Postgres + Auth) só para sincronizar favoritos entre dispositivos de quem opta por criar conta. Sem configurar, o app funciona exatamente como antes — sem login, sem coleta de dados.

## Texto bíblico

O app traz **duas traduções**, ambas livres para redistribuição, e o leitor escolhe qual usar em **Bíblias → Listar Bíblicas** no menu lateral:

| id | Tradução | Licença | Fonte |
| --- | --- | --- | --- |
| `alm1911` | João Ferreira de Almeida (1911) | Domínio público | [BibliaJFAAL/JFAAL](https://github.com/BibliaJFAAL/JFAAL) (MIT — pasta `original/`, descrita ali como domínio público) |
| `blivre` | Bíblia Livre (2018) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.pt_BR) — © 2018 Diego Santos, Mario Sérgio e Marco Teles | [eBible.org](https://ebible.org/find/show.php?id=porbr2018), JSON via [damarals/biblias](https://github.com/damarals/biblias) |

A edição de Almeida de 1911 usa ortografia anterior às reformas ("creou", "fórma", "abysmo") — é autêntica, mas soa arcaica hoje; a Bíblia Livre é uma revisão do mesmo texto em ortografia atual. O catálogo mostrado na interface fica em `src/translations.js`.

**Destaques são por tradução.** Uma marcação guarda posições de letras dentro de uma redação específica, então ela só aparece na Bíblia em que foi feita (marcações antigas, salvas antes desta divisão, contam como `alm1911`). Favoritos e capítulos lidos continuam valendo para todas — a versificação das duas é praticamente idêntica (diferem só em Salmos 46 e Apocalipse 12).

Os dados ficam em `public/data/<id>/`:

- `books-index.json` — lista leve dos 66 livros (id, nome, testamento, nº de capítulos).
- `books/<id>.json` — texto completo de um livro (carregado sob demanda).

Só a tradução padrão (`alm1911`, definida em `DEFAULT_TRANSLATION_ID`) entra no precache do service worker (~4 MB na instalação). As outras são baixadas na primeira leitura e ficam em cache a partir daí — veja a regra `/data/` em `vite.config.js`.

Para regenerar os dados:

```bash
curl -L -o alm1911.json \
  https://raw.githubusercontent.com/BibliaJFAAL/JFAAL/main/original/1911-JFAAtualizada.json
node scripts/import-bible-data.mjs alm1911 alm1911.json

curl -L -o blivre.json \
  https://github.com/damarals/biblias/releases/download/v1.0.0/BLIVRE.json
node scripts/import-bible-data.mjs blivre blivre.json
```

Para acrescentar uma tradução: importe os dados com um novo id, acrescente a entrada correspondente em `src/translations.js` (nome, licença, link oficial) e confira que o id novo não é o do precache. `scripts/import-bible-data.mjs` reconhece dois formatos de origem (`books[].chapters[].verses[].text` e `[{ abbrev, chapters: [[texto]] }]`), ambos com os 66 livros em ordem canônica.

**Verifique a licença antes de publicar qualquer outra tradução** — NVI, ARA, ARC, NAA, NTLH, NVT, ACF e a maioria das revisões modernas são protegidas por direitos autorais e não podem ser redistribuídas num site público. Opções livres além das duas já incluídas: Tradução Brasileira de 1917 (domínio público) e Open Nova Bíblia Viva (CC BY-SA 4.0).

## Login e sincronização (opcional)

O login existe só para sincronizar favoritos entre dispositivos — nada no app exige conta. Para habilitar:

1. Crie um projeto grátis em [supabase.com](https://supabase.com).
2. No painel do projeto, abra **SQL Editor** e rode o conteúdo de `supabase/migrations/0001_init.sql` (cria as tabelas `profiles`/`bookmarks` e as políticas de Row Level Security — cada usuário só acessa os próprios dados).
3. Em **Project Settings → API**, copie a **Project URL** e a **anon public key**.
4. Para desenvolvimento local, crie um `.env.local` (veja `.env.example`) com:
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
5. Para o deploy, adicione as mesmas duas chaves em **Settings → Secrets and variables → Actions**, na aba **Variables** (não "Secrets" — esses valores não são sensíveis) do repositório GitHub (`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`) — o workflow em `.github/workflows/deploy.yml` já as injeta no build.

A chave anon é pública por design (o controle de acesso é feito pelas políticas RLS no banco, não por manter a chave em segredo), então não há problema em ela ir para o bundle final.

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
  components/     # <app-shell>, <bible-nav>, <chapter-view>, <search-view>,
                  # <book-list-view>, <purpose-view>, <account-view>, <nav-accordion>
  services/       # bible-data-service, search-service, storage-service,
                  # supabase-client, auth-service, sync-service
  styles/         # tokens de cor Material 3 (tema claro/escuro)
  router.js       # hash router
  main.js
public/
  data/<tradução>/   # books-index.json + books/*.json (texto bíblico de cada tradução)
  icons/          # ícones do PWA (gerados a partir de favicon.svg — veja "Ícone do PWA")
scripts/
  import-bible-data.mjs   # converte uma fonte JSON externa para o formato usado aqui
  generate-icons.mjs      # gera public/icons/*.png a partir de public/favicon.svg
supabase/
  migrations/0001_init.sql   # schema + RLS para login/favoritos sincronizados
.github/workflows/deploy.yml
```

## Funcionalidades atuais

- Navegação por livros (Antigo/Novo Testamento) em menu lateral
- Leitura por capítulo com navegação anterior/próximo
- Busca em texto completo (ignora acentos)
- Favoritos de versículos (clique no versículo)
- Escolha da tradução em "Bíblias → Listar Bíblicas", com licença e link oficial de cada uma
- Tema claro/escuro/sistema
- Ajuste de tamanho de fonte
- Funciona offline após o primeiro carregamento (todo o texto bíblico é cacheado)
- Instalável como app (PWA), com aviso na tela ("Uma nova versão está disponível") quando uma atualização já foi baixada — o usuário decide quando recarregar, em vez de trocar a versão em uso sem avisar
- Login opcional (e-mail/senha via Supabase) para sincronizar favoritos entre dispositivos

## Ícone do PWA

O logo (`public/favicon.svg`) é o glyph `menu_book` do [Material Symbols](https://fonts.google.com/icons) (Apache 2.0, mesma licença já usada nos ícones de UI — veja [Ícones da interface](#ícones-da-interface)), na cor primária do tema. `public/icons/*.png` são renderizações dele em todos os tamanhos usados por `manifest.webmanifest` (Android/Chrome, Apple touch icon, Windows) e por um ícone maskable (com margem de segurança para as máscaras circulares/squircle do Android).

Para regenerar depois de alterar o logo:

```bash
node scripts/generate-icons.mjs
```

## Ícones da interface

Os ícones de UI vêm do [Material Symbols](https://fonts.google.com/icons) (Google, licença Apache 2.0), usado pelos componentes `@material/web` (`<md-icon>`). A fonte fica **auto-hospedada** em `public/fonts/material-symbols-outlined.woff2` (pacote npm [`@material-symbols/font-400`](https://www.npmjs.com/package/@material-symbols/font-400), também Apache 2.0) em vez de carregada via Google Fonts — mantém o catálogo completo de ícones disponível offline, sem depender de um domínio externo, e sem precisar regenerar nada ao usar um ícone novo. Para ícones adicionais fora do catálogo do Material Symbols, boas fontes gratuitas e de código aberto:

- [Material Symbols](https://fonts.google.com/icons) — Apache 2.0, já é o padrão deste projeto.
- [Iconify](https://icon-sets.iconify.design) — agrega dezenas de bibliotecas open source (Tabler, Lucide, Phosphor, Heroicons etc.), todas com a licença indicada em cada ícone.
- [Lucide](https://lucide.dev) — ISC.
- [Tabler Icons](https://tabler.io/icons) — MIT.
- [Phosphor Icons](https://phosphoricons.com) — MIT.

## Próximos passos sugeridos

- Suporte a múltiplas traduções (o formato de dados já permite adicionar outras)
- Versículo do dia / aleatório
- Compartilhar/copiar versículo
- Planos de leitura

## Licença

Este projeto é distribuído sob a **GNU Affero General Public License v3.0 (AGPL-3.0)** — veja [`LICENSE`](./LICENSE). Em resumo: você pode usar, estudar, modificar e redistribuir o código livremente, mas qualquer versão modificada — inclusive uma hospedada como serviço web, sem redistribuir o binário — deve disponibilizar seu código-fonte aos usuários que interagem com ela pela rede (é essa cláusula de uso em rede que diferencia a AGPL da GPL comum, e por isso ela foi escolhida aqui, já que o app tem um recurso opcional de sincronização via Supabase).

O texto bíblico (JFAAL, domínio público) e os componentes do Material Web (Apache 2.0) mantêm suas próprias licenças de origem — veja a seção [Texto bíblico](#texto-bíblico).
