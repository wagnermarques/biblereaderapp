import { LitElement, html, css } from 'lit'

/** Collapsible group for the nav drawer. Wraps native <details>/<summary> for
 *  built-in keyboard and screen-reader support instead of hand-rolling state. */
export class NavAccordion extends LitElement {
  static properties = {
    label: {},
    expanded: { type: Boolean },
  }

  static styles = css`
    :host {
      display: block;
    }
    details > summary {
      list-style: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      height: 48px;
      color: var(--md-sys-color-on-surface-variant);
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    summary::-webkit-details-marker {
      display: none;
    }
    .chevron {
      transition: transform 0.2s ease;
      --md-icon-size: 20px;
    }
    details[open] .chevron {
      transform: rotate(180deg);
    }
  `

  render() {
    return html`
      <details ?open=${this.expanded}>
        <summary>
          <span>${this.label}</span>
          <md-icon class="chevron">expand_more</md-icon>
        </summary>
        <slot></slot>
      </details>
    `
  }
}

customElements.define('nav-accordion', NavAccordion)
