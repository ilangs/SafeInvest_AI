import { useEffect, useRef } from 'react'

export default function PlotlyChart({ data, layout, style, config = {} }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current || !window.Plotly) return

    window.Plotly.newPlot(ref.current, data, layout, {
      responsive: true,
      displayModeBar: false,
      scrollZoom: false,
      doubleClick: false,
      dragmode: false,
      ...config,
    })

    return () => {
      if (ref.current) window.Plotly.purge(ref.current)
    }
  }, [data, layout, config])

  return <div ref={ref} style={{ width: '100%', ...style }} />
}
