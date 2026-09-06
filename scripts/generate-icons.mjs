#!/usr/bin/env node
// Regenerates public/icons/*.png from public/favicon.svg (the app's brand mark).
// Run again whenever the logo changes: `node scripts/generate-icons.mjs`
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'

const SVG = fileURLToPath(new URL('../public/favicon.svg', import.meta.url))
const OUT_DIR = fileURLToPath(new URL('../public/icons/', import.meta.url))
const BG = '#fffbfe' // matches manifest.background_color in vite.config.js

// "any"-purpose icons: sizes covering Android/Chrome, Apple touch icon (180)
// and Windows tiles, flattened onto the app's surface color so launchers
// never show a transparent hole behind the mark.
const SIZES = [48, 72, 96, 128, 144, 152, 180, 192, 384, 512]

async function renderOnBg(size, markRatio, fileName) {
  const mark = await sharp(SVG, { density: 384 })
    .resize(Math.round(size * markRatio), Math.round(size * markRatio), {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer()

  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toFile(`${OUT_DIR}${fileName}`)
}

await Promise.all(SIZES.map((size) => renderOnBg(size, 0.72, `icon-${size}.png`)))

// Maskable icon: OS masks (circle/squircle) can crop up to ~10% per edge, so
// the mark must stay inside the inner ~60% safe zone.
await renderOnBg(512, 0.6, 'icon-512-maskable.png')

console.log(`Icons written to ${OUT_DIR}`)
