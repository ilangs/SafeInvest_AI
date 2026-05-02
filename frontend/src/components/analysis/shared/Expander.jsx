import { useState } from 'react'

export default function Expander({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="an-expander">
      <button className="an-expander-header" onClick={() => setOpen(o => !o)}>
        <span>{title}</span>
        <span style={{ fontSize: 18 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="an-expander-body">{children}</div>}
    </div>
  )
}
