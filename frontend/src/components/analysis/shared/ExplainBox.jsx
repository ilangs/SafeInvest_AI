export default function ExplainBox({ title, body, type = 'info', style }) {
  const cls = {
    info:    'an-info-box',
    good:    'an-good-box',
    warning: 'an-warning-box',
    warn:    'an-warning-box',
    danger:  'an-warning-box',
  }[type] ?? 'an-easy-box'

  return (
    <div className={cls} style={style}>
      <b>{title}</b>
      {body && <><br /><span dangerouslySetInnerHTML={{ __html: body }} /></>}
    </div>
  )
}
