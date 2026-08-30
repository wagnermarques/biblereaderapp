import { LitElement, html, css } from 'lit'
import './bible-nav.js'
import './chapter-view.js'
import './search-view.js'
import { createRouter, navigateToSearch, navigateHome } from '../router.js'
import { storageService } from '../services/storage-service.js'
import { searchService } from '../services/search-service.js'

export class AppShell extends LitElement {
  static properties = {
    _route: { state: true },
    _drawerOpen: { state: true },
    _theme: { state: true },
    _fontScale: { state: true },
  }

  static styles = css`
    :host {
      display: block;
      height: 100%;
    }
    .top-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 56px;
      padding: 0 8px;
      background: var(--md-sys-color-surface);
      color: var(--md-sys-color-on-surface);
      border-bottom: 1px solid var(--md-sys-color-outline);
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .top-bar h1 {
      font-size: 1.1rem;
      margin: 0;
      flex: 1;
      cursor: pointer;
    }
    main {
      height: calc(100% - 56px);
      overflow-y: auto;
    }
    .home {
      max-width: 640px;
      margin: 48px auto;
      padding: 0 24px;
      text-align: center;
      color: var(--md-sys-color-on-surface-variant);
    }
    .drawer-content {
      padding-top: 8px;
    }
  `

  constructor() {
    super()
    this._route = { name: 'home' }
    this._drawerOpen = false
    this._theme = storageService.getTheme()
    this._fontScale = storageService.getFontScale()
  }

  connectedCallback() {
    super.connectedCallback()
    this._unsubscribe = createRouter((route) => {
      this._route = route
      this._drawerOpen = false
    })
    this._applyTheme()
    searchService.warmUp()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._unsubscribe?.()
  }

  _applyTheme() {
    const root = document.documentElement
    if (this._theme === 'system') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', this._theme)
    }
  }

  _toggleTheme() {
    const order = ['system', 'light', 'dark']
    this._theme = order[(order.indexOf(this._theme) + 1) % order.length]
    storageService.setTheme(this._theme)
    this._applyTheme()
  }

  _adjustFont(delta) {
    this._fontScale = Math.min(1.6, Math.max(0.8, this._fontScale + delta))
    storageService.setFontScale(this._fontScale)
  }

  _themeIcon() {
    return { system: 'brightness_auto', light: 'light_mode', dark: 'dark_mode' }[this._theme]
  }

  render() {
    return html`
      <div class="top-bar">
        <md-icon-button @click=${() => (this._drawerOpen = !this._drawerOpen)} aria-label="Menu">
          <md-icon>menu</md-icon>
        </md-icon-button>
        <h1 @click=${navigateHome}>Bíblia</h1>
        <md-icon-button @click=${() => navigateToSearch('')} aria-label="Buscar">
          <md-icon>search</md-icon>
        </md-icon-button>
        <md-icon-button @click=${() => this._adjustFont(-0.1)} aria-label="Diminuir fonte">
          <md-icon>text_decrease</md-icon>
        </md-icon-button>
        <md-icon-button @click=${() => this._adjustFont(0.1)} aria-label="Aumentar fonte">
          <md-icon>text_increase</md-icon>
        </md-icon-button>
        <md-icon-button @click=${() => this._toggleTheme()} aria-label="Alternar tema">
          <md-icon>${this._themeIcon()}</md-icon>
        </md-icon-button>
      </div>

      <md-navigation-drawer-modal
        .opened=${this._drawerOpen}
        @navigation-drawer-changed=${(e) => (this._drawerOpen = e.detail.opened)}
      >
        <div class="drawer-content">
          <bible-nav
            active-book-id=${this._route.book ?? ''}
            @book-selected=${(e) => {
              location.hash = `#/${e.detail.bookId}`
            }}
          ></bible-nav>
        </div>
      </md-navigation-drawer-modal>

      <main>${this._renderRoute()}</main>
    `
  }

  _renderRoute() {
    switch (this._route.name) {
      case 'chapter':
        return html`
          <chapter-view
            book-id=${this._route.book}
            chapter=${this._route.chapter}
            font-scale=${this._fontScale}
          ></chapter-view>
        `
      case 'search':
        return html`<search-view .query=${this._route.query.q ?? ''}></search-view>`
      default:
        return html`
          <div class="home">
            <p>Selecione um livro no menu para começar a leitura.</p>
          </div>
        `
    }
  }
}

customElements.define('app-shell', AppShell)
