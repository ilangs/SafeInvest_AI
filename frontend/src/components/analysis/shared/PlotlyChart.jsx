import { useEffect, useRef } from 'react'

export default function PlotlyChart({ data, layout, style }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current || !window.Plotly) return
    window.Plotly.newPlot(ref.current, data, layout, {
      responsive: true,
      displayModeBar: false,
    })
    return () => { if (ref.current) window.Plotly.purge(ref.current) }
  }, [data, layout])

  return <div ref={ref} style={{ width: '100%', ...style }} />
}
