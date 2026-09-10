// The Bible translations bundled with the app. Every one here has to be free to
// redistribute — this app is published openly, and most modern Portuguese
// revisions (ARA, ARC, NVI, NAA, NTLH, NVT, ACF...) are under copyright and
// cannot be shipped. `license` and `licenseUrl` are shown to the reader rather
// than buried in the README, because attribution is a condition of some of them.
//
// `id` is also the folder name under public/data/, and the value stored on a
// highlight — renaming one orphans the highlights made in it.
export const TRANSLATIONS = [
  {
    id: 'alm1911',
    name: 'Almeida 1911',
    fullName: 'João Ferreira de Almeida (1911)',
    year: 1911,
    license: 'Domínio público',
    licenseUrl: 'https://pt.wikipedia.org/wiki/Dom%C3%ADnio_p%C3%BAblico',
    sourceName: 'BibliaJFAAL/JFAAL',
    sourceUrl: 'https://github.com/BibliaJFAAL/JFAAL',
    description:
      'A tradução clássica de Almeida na edição de 1911. Por ser anterior às reformas ' +
      'ortográficas, o texto escreve "unigenito", "n\'elle", "fórma" — é autêntico, mas ' +
      'soa arcaico para quem lê português de hoje.',
  },
  {
    id: 'blivre',
    name: 'Bíblia Livre',
    fullName: 'Bíblia Livre (2018)',
    year: 2018,
    license: 'Creative Commons Atribuição 4.0 Brasil (CC BY 4.0)',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/deed.pt_BR',
    attribution: 'Copyright © 2018 Diego Santos, Mario Sérgio e Marco Teles',
    sourceName: 'eBible.org — Bíblia Livre',
    sourceUrl: 'https://ebible.org/find/show.php?id=porbr2018',
    description:
      'Uma revisão do texto de Almeida feita sobre o Textus Receptus e publicada em ' +
      'ortografia atual. Mantém as palavras que quem conhece Almeida já espera, sem a ' +
      'grafia antiga.',
  },
]

// What a reader who never opened the Bibles page is reading, and what a
// highlight saved before translations existed was made in.
export const DEFAULT_TRANSLATION_ID = 'alm1911'

const byId = new Map(TRANSLATIONS.map((t) => [t.id, t]))

/** The translation with this id, falling back to the default for unknown ids. */
export function translation(id) {
  return byId.get(id) ?? byId.get(DEFAULT_TRANSLATION_ID)
}
