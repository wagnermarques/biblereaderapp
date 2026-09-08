import { LitElement, html, css } from 'lit'
import { syncService } from '../services/sync-service.js'
import { authService } from '../services/auth-service.js'
import { navigateToAccount } from '../router.js'

// Long enough to read a short sentence, short enough not to sit over the text
// the user is trying to read.
const TOAST_MS = 4000

/**
 * The single place the app talks about sync. An always-present icon carries
 * the current state without interrupting reading; transient messages appear
 * only on the transitions that change what the user should expect — going
 * offline, a drain finishing, a failure. Never one per save.
 */
export class SyncStatus extends LitElement {
  static properties = {
    _status: { state: true },
    _user: { state: true },
    _detailOpen: { state: true },
    _toast: { state: true },
  }

  static styles = css`
    :host {
      display: contents;
    }
    .badge-wrap {
      position: relative;
      display: inline-flex;
    }
    .badge {
      position: absolute;
      top: 2px;
      right: 2px;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      border-radius: 8px;
      /* Pending work is normal, not a problem — the alarming colour is kept
         for changes the server actually refused. */
      background: var(--md-sys-color-primary, #6750a4);
      color: var(--md-sys-color-on-primary, #fff);
      font-size: 10px;
      line-height: 16px;
      text-align: center;
      pointer-events: none;
    }
    .badge.failed {
      background: var(--md-sys-color-error, #b3261e);
      color: var(--md-sys-color-on-error, #fff);
    }
    .spin {
      animation: spin 1.2s linear infinite;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .spin {
        animation: none;
      }
    }
    .toast {
      position: fixed;
      left: 50%;
      bottom: 24px;
      transform: translateX(-50%);
      z-index: 10;
      max-width: min(90vw, 420px);
      padding: 12px 16px;
      border-radius: 8px;
      background: var(--md-sys-color-inverse-surface, #313033);
      color: var(--md-sys-color-inverse-on-surface, #f4eff4);
      box-shadow: 0 2px 8px rgb(0 0 0 / 0.3);
      font-size: 0.875rem;
    }
    dl {
      margin: 0;
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 4px 16px;
      font-size: 0.875rem;
    }
    dt {
      color: var(--md-sys-color-on-surface-variant);
    }
    dd {
      margin: 0;
    }
  `

  constructor() {
    super()
    this._status = syncService.getStatus()
    this._user = authService.getCurrentUser()
    this._detailOpen = false
    this._toast = null
  }

  connectedCallback() {
    super.connectedCallback()
    this._unsubscribeAuth = authService.subscribe((session) => {
      this._user = session?.user ?? null
    })
    let previous = this._status
    this._unsubscribeStatus = syncService.subscribeStatus((status) => {
      this._announce(previous, status)
      previous = status
      this._status = status
    })
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._unsubscribeAuth?.()
    this._unsubscribeStatus?.()
    clearTimeout(this._toastTimer)
  }

  /** Transitions worth a word; everything else is left to the icon. */
  _announce(previous, next) {
    if (!this._user) return
    if (next.state === previous.state) return
    if (next.state === 'offline') {
      this._showToast('Você está offline. Suas alterações ficam salvas neste aparelho.')
    } else if (next.state === 'syncing' && previous.pending > 0) {
      this._showToast('Sincronizando suas alterações…')
    } else if (next.state === 'synced' && previous.state === 'syncing' && previous.pending > 0) {
      const n = previous.pending
      this._showToast(`${n} ${n === 1 ? 'alteração enviada' : 'alterações enviadas'}.`)
    } else if (next.state === 'error') {
      this._showToast('Não foi possível enviar algumas alterações.')
    }
  }

  _showToast(text) {
    this._toast = text
    clearTimeout(this._toastTimer)
    this._toastTimer = setTimeout(() => (this._toast = null), TOAST_MS)
  }

  /**
   * Signed out is not a sync state — nothing is pending because nothing has a
   * destination — so it gets its own presentation rather than being folded
   * into the queue states.
   */
  _view() {
    if (!this._user) {
      return {
        icon: 'phone_android',
        label: 'Salvo somente neste aparelho',
        detail: 'Entre na sua conta para sincronizar suas marcações entre aparelhos.',
      }
    }
    const { state, pending, failed } = this._status
    switch (state) {
      case 'offline':
        return {
          icon: 'cloud_off',
          label: 'Offline',
          detail: 'Suas alterações estão salvas neste aparelho e serão enviadas ao reconectar.',
        }
      case 'syncing':
        return { icon: 'sync', spin: true, label: 'Sincronizando…', detail: 'Enviando suas alterações.' }
      case 'pending':
        return {
          icon: 'cloud_upload',
          label: `${pending} para enviar`,
          detail: 'Alterações aguardando envio.',
        }
      case 'error':
        return {
          icon: 'sync_problem',
          label: 'Falha ao sincronizar',
          detail: `${failed} ${failed === 1 ? 'alteração foi recusada' : 'alterações foram recusadas'} pelo servidor. Tentar de novo não costuma resolver — conte ao suporte se persistir.`,
        }
      default:
        return { icon: 'cloud_done', label: 'Tudo sincronizado', detail: 'Nada aguardando envio.' }
    }
  }

  _lastSynced() {
    const iso = this._status.lastSyncedAt
    return iso ? new Date(iso).toLocaleString('pt-BR') : 'Nunca'
  }

  render() {
    // No Supabase project configured means there is no sync layer to report on.
    if (!authService.isConfigured()) return null
    const view = this._view()
    const badge = this._status.failed || this._status.pending
    return html`
      <span class="badge-wrap">
        <md-icon-button
          @click=${() => (this._detailOpen = true)}
          aria-label=${`Sincronização: ${view.label}`}
          title=${view.label}
        >
          <md-icon class=${view.spin ? 'spin' : ''}>${view.icon}</md-icon>
        </md-icon-button>
        ${this._user && badge
          ? html`<span class="badge ${this._status.failed ? 'failed' : ''}"
              >${badge > 99 ? '99+' : badge}</span
            >`
          : ''}
      </span>

      ${this._toast ? html`<div class="toast" role="status">${this._toast}</div>` : ''}

      <md-dialog ?open=${this._detailOpen} @closed=${() => (this._detailOpen = false)}>
        <div slot="headline">${view.label}</div>
        <div slot="content">
          <p>${view.detail}</p>
          ${this._user
            ? html`
                <dl>
                  <dt>Aguardando envio</dt>
                  <dd>${this._status.pending}</dd>
                  ${this._status.failed
                    ? html`<dt>Recusadas</dt>
                        <dd>${this._status.failed}</dd>`
                    : ''}
                  <dt>Última sincronização</dt>
                  <dd>${this._lastSynced()}</dd>
                </dl>
              `
            : ''}
        </div>
        <div slot="actions">
          ${this._user
            ? html`<md-text-button
                ?disabled=${this._status.state === 'syncing'}
                @click=${() => syncService.flush()}
                >Tentar agora</md-text-button
              >`
            : html`<md-text-button
                @click=${() => {
                  this._detailOpen = false
                  navigateToAccount()
                }}
                >Entrar</md-text-button
              >`}
          <md-filled-button @click=${() => (this._detailOpen = false)}>Fechar</md-filled-button>
        </div>
      </md-dialog>
    `
  }
}

customElements.define('sync-status', SyncStatus)
