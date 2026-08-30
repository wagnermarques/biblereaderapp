import { LitElement, html, css } from 'lit'
import { authService } from '../services/auth-service.js'

export class AccountView extends LitElement {
  static properties = {
    _user: { state: true },
    _role: { state: true },
    _mode: { state: true },
    _email: { state: true },
    _password: { state: true },
    _error: { state: true },
    _busy: { state: true },
  }

  static styles = css`
    :host {
      display: block;
      max-width: 420px;
      margin: 0 auto;
      padding: 16px 24px 64px;
    }
    h1 {
      font-size: 1.5rem;
      margin: 0 0 16px;
    }
    md-outlined-text-field {
      width: 100%;
      margin-bottom: 12px;
    }
    .error {
      color: var(--md-sys-color-error);
      font-size: 0.875rem;
      margin-top: 8px;
    }
    .switch {
      margin-top: 16px;
      font-size: 0.875rem;
    }
    .profile p {
      line-height: 1.6;
    }
    .not-configured {
      color: var(--md-sys-color-on-surface-variant);
      line-height: 1.6;
    }
  `

  constructor() {
    super()
    this._mode = 'signin'
    this._email = ''
    this._password = ''
    this._error = null
    this._busy = false
    this._user = null
    this._role = null
  }

  connectedCallback() {
    super.connectedCallback()
    this._unsubscribe = authService.subscribe(async (session) => {
      this._user = session?.user ?? null
      this._role = this._user ? await authService.getRole(this._user.id) : null
    })
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._unsubscribe?.()
  }

  async _submit(e) {
    e.preventDefault()
    this._error = null
    this._busy = true
    try {
      if (this._mode === 'signin') {
        await authService.signIn(this._email, this._password)
      } else {
        await authService.signUp(this._email, this._password)
      }
    } catch (err) {
      this._error = err.message
    } finally {
      this._busy = false
    }
  }

  render() {
    if (!authService.isConfigured()) {
      return html`
        <h1>Minha conta</h1>
        <p class="not-configured">
          O login ainda não foi configurado neste app (faltam as chaves do Supabase).
        </p>
      `
    }

    if (this._user) {
      return html`
        <h1>Minha conta</h1>
        <div class="profile">
          <p><strong>E-mail:</strong> ${this._user.email}</p>
          <p><strong>Perfil:</strong> ${this._role ?? '—'}</p>
          <p>Seus favoritos são sincronizados automaticamente nesta conta.</p>
        </div>
        <md-text-button @click=${() => authService.signOut()}>Sair</md-text-button>
      `
    }

    return html`
      <h1>${this._mode === 'signin' ? 'Entrar' : 'Criar conta'}</h1>
      <form @submit=${this._submit}>
        <md-outlined-text-field
          label="E-mail"
          type="email"
          .value=${this._email}
          @input=${(e) => (this._email = e.target.value)}
          required
        ></md-outlined-text-field>
        <md-outlined-text-field
          label="Senha"
          type="password"
          .value=${this._password}
          @input=${(e) => (this._password = e.target.value)}
          required
        ></md-outlined-text-field>
        <md-filled-button type="submit" ?disabled=${this._busy}>
          ${this._mode === 'signin' ? 'Entrar' : 'Criar conta'}
        </md-filled-button>
        ${this._error ? html`<p class="error">${this._error}</p>` : null}
      </form>
      <p class="switch">
        ${this._mode === 'signin'
          ? html`Não tem conta?
              <md-text-button @click=${() => (this._mode = 'signup')}>Criar conta</md-text-button>`
          : html`Já tem conta?
              <md-text-button @click=${() => (this._mode = 'signin')}>Entrar</md-text-button>`}
      </p>
    `
  }
}

customElements.define('account-view', AccountView)
