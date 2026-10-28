// Chart colours. Recharts writes these straight into SVG attributes, and SVG
// attributes accept var(), so each one points at a CSS token in index.css
// (section "1. Tokens"). The light and dark values live there, which means
// charts switch theme with the rest of the page and nothing re-renders.
//
// Series pairs were checked with the dataviz palette validator (CVD +
// contrast) against the card surface in both themes. The aqua "adjusted" line
// is under 3:1 on white, so its values are also always in the table

export const chart = {
  forecast: 'var(--forecast)', // blue: the forecast the buyer had at the gate
  actual: 'var(--actual)', // orange: metered outturn
  adjusted: 'var(--adjusted)', // aqua: our bias-adjusted forecast
  over: 'var(--over)', // forecast above actual (buyer short)
  under: 'var(--under)', // forecast below actual (buyer long)
  neutral: 'var(--neutral)', // diverging midpoint: "about right"
  bandOpacity: 0.12, // likely-range fill; a number, so it can't be a token
  grid: 'var(--grid)',
  axis: 'var(--axis)',
  tick: 'var(--ink-3)',
  surface: 'var(--surface)', // ring around hovered dots
}

export const axisTick = { fill: chart.tick, fontSize: 12 }
