// Chart colours. Recharts needs concrete values, so these mirror the CSS
// tokens in index.css. Series pairs were checked with the dataviz palette
// validator (CVD + contrast) against the white card surface.

export const chart = {
  forecast: '#2a78d6', // blue: the forecast the buyer had at the gate
  actual: '#eb6834', // orange: metered outturn
  adjusted: '#1baf7a', // aqua: our bias-adjusted forecast (2.8:1 on white, so it is always in the table too)
  over: '#e34948', // forecast above actual (buyer short)
  under: '#2a78d6', // forecast below actual (buyer long)
  neutral: '#a9a8a1', // diverging midpoint: "about right"
  bandOpacity: 0.12,
  grid: '#ecebe6',
  axis: '#c3c2b7',
  tick: '#898781',
  surface: '#ffffff',
}

export const axisTick = { fill: chart.tick, fontSize: 12 }
