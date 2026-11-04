import { html } from 'lit'
import { createAppShell, pattern } from 'fzl-fund-appshell--lit'
import 'fzl-fund-appshell--lit/styles/theme.css'

import './components/md-imports.js'
import './components/chapter-view.js'
import './components/chapter-grid-view.js'
import './components/search-view.js'
import './components/book-list-view.js'
import './components/purpose-view.js'
import './components/marked-texts-view.js'
import './components/sermons-view.js'
import './components/bibles-view.js'
import './components/sync-status.js'

import { storageService } from './services/storage-service.js'
import { searchService } from './services/search-service.js'
import { syncService } from './services/sync-service.js'
import { supabaseAuthProvider } from './services/supabase-auth-provider.js'

// Warm up the search index on startup
searchService.warmUp()

// Listen for Bible translation changes from <bibles-view>
window.addEventListener('translation-change', (e) => {
  const id = e.detail?.id
  if (!id || id === storageService.getTranslationId()) return
  storageService.setTranslationId(id)
  searchService.reset()
  searchService.warmUp()
  // Trigger a soft refresh of the current view
  const currentHash = location.hash
  location.hash = '#/'
  setTimeout(() => {
    location.hash = currentHash
  }, 0)
})

createAppShell({
  mount: '#app',
  title: 'Bíblia',
  home: () => html`
    <div style="max-width: 640px; margin: 48px auto; padding: 0 24px; text-align: center; color: var(--md-sys-color-on-surface-variant);">
      <h2 style="font-size: 1.5rem; color: var(--md-sys-color-on-surface); margin-bottom: 16px;">Bíblia Sagrada</h2>
      <p style="line-height: 1.6; margin-bottom: 24px;">Abra o menu lateral ou toque abaixo para começar sua leitura.</p>
      <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
        <md-filled-button href="#/livros">
          <md-icon slot="icon">menu_book</md-icon>
          Listar livros
        </md-filled-button>
        <md-outlined-button href="#/search">
          <md-icon slot="icon">search</md-icon>
          Buscar
        </md-outlined-button>
      </div>
    </div>
  `,
  routes: [
    {
      name: 'books',
      match: pattern('livros'),
      title: 'Livros',
      crumb: [{ label: 'Livros' }],
      render: () => html`<book-list-view></book-list-view>`,
    },
    {
      name: 'bibles',
      match: pattern('biblias'),
      title: 'Bíblias',
      crumb: [{ label: 'Bíblias' }],
      render: () => html`<bibles-view></bibles-view>`,
    },
    {
      name: 'marked-texts',
      match: pattern('marcacoes'),
      title: 'Meus destaques',
      crumb: [{ label: 'Meus destaques' }],
      render: () => html`<marked-texts-view></marked-texts-view>`,
    },
    {
      name: 'sermons',
      match: (segments, query) => pattern('pregacoes/:id')(segments, query) ?? pattern('pregacoes')(segments, query),
      title: 'Pregações',
      crumb: [{ label: 'Pregações' }],
      render: ({ params }) => html`<sermons-view sermon-id=${params?.id ?? ''}></sermons-view>`,
    },
    {
      name: 'about-purpose',
      match: pattern('sobre/objetivo'),
      title: 'Objetivo',
      crumb: [{ label: 'Sobre' }, { label: 'Objetivo' }],
      render: () => html`<purpose-view></purpose-view>`,
    },
    {
      name: 'search',
      match: pattern('search'),
      title: 'Buscar',
      crumb: [{ label: 'Buscar' }],
      render: ({ query }) => html`<search-view .query=${query?.q ?? ''}></search-view>`,
    },
    {
      name: 'chapter',
      match: pattern(':book/:chapter'),
      title: ({ params }) => `${params.book} ${params.chapter}`,
      crumb: ({ params }) => [
        { label: 'Livros', href: '#/livros' },
        { label: params.book, href: `#/${params.book}` },
        { label: `${params.chapter}` },
      ],
      render: ({ params, query }) => html`
        <chapter-view
          book-id=${params.book}
          chapter=${Number(params.chapter) || 1}
          verse=${Number(query?.v) || 0}
        ></chapter-view>
      `,
    },
    {
      name: 'book-chapters',
      match: pattern(':book'),
      title: ({ params }) => params.book,
      crumb: ({ params }) => [
        { label: 'Livros', href: '#/livros' },
        { label: params.book },
      ],
      render: ({ params }) => html`<chapter-grid-view book-id=${params.book}></chapter-grid-view>`,
    },
  ],
  drawer: {
    sections: [
      {
        id: 'livros',
        label: 'Livros',
        items: [{ label: 'Listar livros', icon: 'list', href: '#/livros' }],
      },
      {
        id: 'biblias',
        label: 'Bíblias',
        items: [{ label: 'Listar Bíblias', icon: 'menu_book', href: '#/biblias' }],
      },
      {
        id: 'marcacoes',
        label: 'Marcações',
        items: [{ label: 'Meus destaques', icon: 'bookmarks', href: '#/marcacoes' }],
      },
      {
        id: 'pregacoes',
        label: 'Pregações',
        items: [{ label: 'Pregações', icon: 'record_voice_over', href: '#/pregacoes' }],
      },
      {
        id: 'sobre',
        label: 'Sobre',
        items: [{ label: 'Objetivo', icon: 'info', href: '#/sobre/objetivo' }],
      },
    ],
  },
  headerActions: () => html`
    <md-icon-button href="#/search" aria-label="Buscar">
      <md-icon>search</md-icon>
    </md-icon-button>
    <sync-status></sync-status>
  `,
  auth: supabaseAuthProvider.isConfigured() ? supabaseAuthProvider : null,
  on: {
    'auth:login': ({ user }) => {
      if (user?.id) {
        syncService.syncAll(user.id)
      }
    },
  },
})
