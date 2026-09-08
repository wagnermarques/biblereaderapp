// Highlight palette for marked text excerpts. `text` is fixed rather than
// theme-dependent: every background here is a light pastel, so the dark-theme
// on-surface color (near white) would be unreadable on top of them.
export const MARK_COLORS = [
  { id: 'yellow', label: 'Amarelo', background: '#fff59d' },
  { id: 'green', label: 'Verde', background: '#c8e6c9' },
  { id: 'blue', label: 'Azul', background: '#bbdefb' },
  { id: 'pink', label: 'Rosa', background: '#f8bbd0' },
  { id: 'orange', label: 'Laranja', background: '#ffe0b2' },
]

export const MARK_TEXT_COLOR = '#1c1b1f'

const byId = new Map(MARK_COLORS.map((c) => [c.id, c]))

export function markColor(colorId) {
  return byId.get(colorId) ?? MARK_COLORS[0]
}
