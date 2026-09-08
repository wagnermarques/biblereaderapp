import { LitElement, html, css } from 'lit'
import { registerSW } from 'virtual:pwa-register'
import './chapter-view.js'
import './chapter-grid-view.js'
import './search-view.js'
import './book-list-view.js'
import './purpose-view.js'
import './account-view.js'
import './nav-accordion.js'
import './sync-status.js'
import {
  createRouter,
  navigateToSearch,
  navigateHome,
  navigateToBooks,
  navigateToPurpose,
  navigateToAccount,
} from '../router.js'
import { storageService } from '../services/storage-service.js'
import { searchService } from '../services/search-service.js'
import { authService } from '../services/auth-service.js'
import { syncService } from '../services/sync-service.js'

export class AppShell extends LitElement {
  static properties = {
    _route: { state: true },
    _drawerOpen: { state: true },
    _theme: { state: true },
    _fontScale: { state: true },
    _updateAvailable: { state: true },
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
    md-navigation-drawer-modal {
      --md-navigation-drawer-modal-scrim-color: #000;
      --md-navigation-drawer-modal-scrim-opacity: 0.32;
    }
    .drawer-content {
      padding-top: 8px;
    }
    .drawer-content nav-accordion md-list {
      padding-left: 16px;
    }
    .update-toast {
      position: fixed;
      left: 50%;
      bottom: 16px;
      transform: translateX(-50%);
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 8px;
      max-width: calc(100% - 32px);
      padding: 8px 8px 8px 16px;
      border-radius: 4px;
      background: var(--md-sys-color-inverse-surface);
      color: var(--md-sys-color-inverse-on-surface);
      box-shadow: 0 3px 5px rgba(0, 0, 0, 0.2), 0 1px 10px rgba(0, 0, 0, 0.12);
    }
    .update-toast span {
      font-size: 0.875rem;
    }
    .update-toast md-text-button {
      --md-text-button-label-text-color: var(--md-sys-color-inverse-primary);
      flex-shrink: 0;
    }
  `

  constructor() {
    super()
    this._route = { name: 'home' }
    this._drawerOpen = false
    this._theme = storageService.getTheme()
    this._fontScale = storageService.getFontScale()
    this._updateAvailable = false
    this._swRegistration = null
    this._updateSW = registerSW({
      onNeedRefresh: () => {
        this._updateAvailable = true
      },
      onRegisteredSW: (_url, registration) => {
        this._swRegistration = registration
        registration?.update()
      },
    })
  }

  connectedCallback() {
    super.connectedCallback()
    this._unsubscribe = createRouter((route) => {
      this._route = route
      this._drawerOpen = false
    })

    // Android PWAs are usually resumed from memory rather than restarted, so
    // the browser's own update check may never run again after the first
    // launch — check explicitly every time the app comes back to the front.
    this._onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        this._swRegistration?.update()
      }
    }
    document.addEventListener('visibilitychange', this._onVisibilityChange)
    this._applyTheme()
    searchService.warmUp()

    // Pull the signed-in user's bookmarks/reading-progress into local storage
    // whenever a session appears — both right after sign-in and when a
    // persisted session is restored on page load.
    let syncedUserId = null
    this._authUnsubscribe = authService.subscribe((session) => {
      const userId = session?.user?.id ?? null
      if (userId && userId !== syncedUserId) {
        syncedUserId = userId
        syncService.syncAll(userId)
      } else if (!userId) {
        syncedUserId = null
      }
    })
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._unsubscribe?.()
    this._authUnsubscribe?.()
    document.removeEventListener('visibilitychange', this._onVisibilityChange)
  }

  firstUpdated() {
    // md-navigation-drawer-modal's own panel/scrim have no positioned
    // ancestor of their own, so their containing block escapes all the way
    // to the viewport — and in that situation, any relatively positioned
    // descendant deep inside <main> (e.g. md-list-item's internal ripple
    // layer) paints above them despite DOM order suggesting otherwise.
    // There's no exposed CSS custom property for this, so patch it directly
    // — both elements are already position: absolute, so adding a z-index
    // doesn't change their layout or containing-block behavior.
    const drawer = this.shadowRoot.querySelector('md-navigation-drawer-modal')
    const style = document.createElement('style')
    style.textContent = `
      .md3-navigation-drawer-modal,
      .md3-navigation-drawer-modal__scrim {
        z-index: 1;
      }
    `
    drawer.shadowRoot.appendChild(style)
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

  _selectDrawerItem(navigate) {
    // Route changes already close the drawer via createRouter's callback,
    // but that relies on the hash actually changing — clicking a menu item
    // for the page the user is already on leaves it open otherwise.
    navigate()
    this._drawerOpen = false
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
        <sync-status></sync-status>
        <md-icon-button @click=${() => this._toggleTheme()} aria-label="Alternar tema">
          <md-icon>${this._themeIcon()}</md-icon>
        </md-icon-button>
      </div>

      <md-navigation-drawer-modal
        .opened=${this._drawerOpen}
        @navigation-drawer-changed=${(e) => (this._drawerOpen = e.detail.opened)}
      >
        <div class="drawer-content">
          <nav-accordion label="Livros" expanded>
            <md-list>
              <md-list-item type="button" @click=${() => this._selectDrawerItem(navigateToBooks)}>
                Listar livros
              </md-list-item>
            </md-list>
          </nav-accordion>
          <nav-accordion label="Sobre">
            <md-list>
              <md-list-item type="button" @click=${() => this._selectDrawerItem(navigateToPurpose)}>
                Objetivo
              </md-list-item>
            </md-list>
          </nav-accordion>
          <nav-accordion label="Conta">
            <md-list>
              <md-list-item type="button" @click=${() => this._selectDrawerItem(navigateToAccount)}>
                Minha conta
              </md-list-item>
            </md-list>
          </nav-accordion>
        </div>
      </md-navigation-drawer-modal>

      <main>${this._renderRoute()}</main>

      ${this._updateAvailable
        ? html`
            <div class="update-toast" role="status">
              <span>Uma nova versão está disponível.</span>
              <md-text-button @click=${() => this._updateSW(true)}>Atualizar</md-text-button>
            </div>
          `
        : ''}
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
      case 'book-chapters':
        return html`<chapter-grid-view book-id=${this._route.book}></chapter-grid-view>`
      case 'search':
        return html`<search-view .query=${this._route.query.q ?? ''}></search-view>`
      case 'books':
        return html`<book-list-view></book-list-view>`
      case 'about-purpose':
        return html`<purpose-view></purpose-view>`
      case 'account':
        return html`<account-view></account-view>`
      default:
        return html`
          <div class="home">
            <p>Abra o menu e toque em "Livros → Listar livros" para começar a leitura.</p>
          </div>
        `
    }
  }
}

customElements.define('app-shell', AppShell)
