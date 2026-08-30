import { LitElement, html, css } from 'lit'

export class PurposeView extends LitElement {
  static styles = css`
    :host {
      display: block;
      max-width: 720px;
      margin: 0 auto;
      padding: 16px 24px 64px;
    }
    h1 {
      font-size: 1.5rem;
      margin: 0 0 16px;
    }
    p {
      line-height: 1.6;
      color: var(--md-sys-color-on-surface);
    }
  `

  render() {
    return html`
      <h1>Objetivo</h1>
      <p>
        Este aplicativo é um leitor de Bíblia gratuito, offline e instalável, criado para
        oferecer acesso simples e sem barreiras às Escrituras em português.
      </p>
      <p>
        O texto utilizado é a tradução de João Ferreira de Almeida (edição de 1911), em
        domínio público, o que permite distribuir o aplicativo livremente, sem custos de
        licenciamento.
      </p>
      <p>
        Por ser uma aplicação web progressiva (PWA), funciona inteiramente no navegador,
        pode ser instalada como um app e continua funcionando offline depois do primeiro
        carregamento — sem exigir cadastro, anúncios ou coleta de dados pessoais.
      </p>
    `
  }
}

customElements.define('purpose-view', PurposeView)
