/**
 * Colour contrast against WCAG AA.
 *
 * The brief requires AA, and the design tokens were taken on trust until now.
 * These are the actual pairings the site renders — computed from the token
 * values in globals.css rather than eyeballed.
 *
 * AA is 4.5:1 for body text and 3:1 for large text (18.66px bold, or 24px).
 */
import { describe, expect, it } from 'vitest'

const TOKENS = {
  green: '#0B3D2E',
  green2: '#0F4A38',
  green3: '#175A45',
  leaf: '#1C7C54',
  leafDark: '#166944',
  gold: '#E9B44C',
  goldDark: '#8A6420',
  goldBg: '#FBF4E3',
  mist: '#F3F6F4',
  white: '#FFFFFF',
  ink: '#14201B',
  line: '#DCE4DF',
  line2: '#EDF2EF',
  muted: '#5C6B63',
  faint: '#68716B',
  // Literals used directly in the dark panels.
  heroBody: '#C9D9D0',
  heroMeta: '#B2C6BC',
  greenFaint: '#99B3A6',
  up: '#8FE0B3',
  down: '#F5A3A3',
  danger: '#A32D2D',
  okText: '#1C6B4A',
  okBg: '#E4F3EB',
  promoText: '#7A4EB8',
  promoBg: '#F1EAFB',
  goldTagText: '#4A3608',
  bubbleLabel: '#436B50',
  bubbleBg: '#DCF8C6',
  bubbleText: '#1E2B22',
}

function luminance(hex: string): number {
  const rgb = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100
}

/** Pairings the site actually renders, with the minimum each must clear. */
const BODY_TEXT: [string, string, string][] = [
  ['ink on mist (page body)', TOKENS.ink, TOKENS.mist],
  ['ink on white (panel body)', TOKENS.ink, TOKENS.white],
  ['muted on white (secondary text)', TOKENS.muted, TOKENS.white],
  ['muted on mist (meta bar)', TOKENS.muted, TOKENS.mist],
  ['hero body on green', TOKENS.heroBody, TOKENS.green],
  ['hero meta on green', TOKENS.heroMeta, TOKENS.green],
  ['white on leaf (primary button)', TOKENS.white, TOKENS.leaf],
  ['white on leaf-dark (button hover)', TOKENS.white, TOKENS.leafDark],
  ['white on ink (best-deal CTA)', TOKENS.white, TOKENS.ink],
  ['gold-dark on gold-bg (best-deal diff)', TOKENS.goldDark, TOKENS.goldBg],
  ['gold-tag text on gold (Best deal pill)', TOKENS.goldTagText, TOKENS.gold],
  ['ok text on ok bg (fast speed pill)', TOKENS.okText, TOKENS.okBg],
  ['promo text on promo bg', TOKENS.promoText, TOKENS.promoBg],
  ['danger on white (bank row diff)', TOKENS.danger, TOKENS.white],
  ['gold-tag text on gold (alert CTA)', TOKENS.goldTagText, TOKENS.gold],

  /**
   * These were missing from the first version of this file, and every one of
   * them failed — which is the whole lesson. A contrast suite that only lists
   * the pairings you expect to pass proves nothing. `faint` measured 3.04:1 on
   * white and 2.77:1 on the best-deal row; the dark-panel greys sat between
   * 3.57 and 4.26.
   */
  ['faint on white (captions, "per £")', TOKENS.faint, TOKENS.white],
  ['faint on mist', TOKENS.faint, TOKENS.mist],
  ['faint on gold-bg (best-deal row)', TOKENS.faint, TOKENS.goldBg],
  ['green-faint on green (footer headings)', TOKENS.greenFaint, TOKENS.green],
  ['green-faint on green-2 (ticker caption)', TOKENS.greenFaint, TOKENS.green2],
  ['hero meta on green', TOKENS.heroMeta, TOKENS.green],
  ['hero meta on green-2', TOKENS.heroMeta, TOKENS.green2],
  ['hero meta on green-3 (alert form labels)', TOKENS.heroMeta, TOKENS.green3],
  ['muted on line-2', TOKENS.muted, TOKENS.line2],

  // Found by Lighthouse, not by this file — the WhatsApp bubble mock was at
  // 4.29:1. Another pairing that existed on the page and not in the test.
  ['bubble label on bubble bg', TOKENS.bubbleLabel, TOKENS.bubbleBg],
  ['bubble body on bubble bg', TOKENS.bubbleText, TOKENS.bubbleBg],
]

/** Large text and non-text indicators only need 3:1. */
const LARGE_OR_UI: [string, string, string][] = [
  ['green on mist (big stat numbers)', TOKENS.green, TOKENS.mist],
  ['gold on green (alert heading figure)', TOKENS.gold, TOKENS.green],
  ['up on green-2 (ticker rise)', TOKENS.up, TOKENS.green2],
  ['down on green-2 (ticker fall)', TOKENS.down, TOKENS.green2],
  ['green-faint on green-2 (ticker caption)', TOKENS.greenFaint, TOKENS.green2],
]

describe('WCAG AA — body text needs 4.5:1', () => {
  for (const [label, fg, bg] of BODY_TEXT) {
    it(`${label}`, () => {
      const ratio = contrast(fg, bg)
      expect(ratio, `${label} is ${ratio}:1`).toBeGreaterThanOrEqual(4.5)
    })
  }
})

describe('WCAG AA — large text and UI need 3:1', () => {
  for (const [label, fg, bg] of LARGE_OR_UI) {
    it(`${label}`, () => {
      const ratio = contrast(fg, bg)
      expect(ratio, `${label} is ${ratio}:1`).toBeGreaterThanOrEqual(3)
    })
  }
})

describe('contrast helper', () => {
  it('is 21:1 for black on white', () => {
    expect(contrast('#000000', '#FFFFFF')).toBe(21)
  })
  it('is 1:1 for a colour against itself', () => {
    expect(contrast('#1C7C54', '#1C7C54')).toBe(1)
  })
})
