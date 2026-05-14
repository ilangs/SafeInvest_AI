export default function ExplainBox({
  title,
  body,
  type = 'info',
  style,
  className = '',
}) {
  const cls = {
    info: 'an-info-box',
    good: 'an-good-box',
    warning: 'an-warning-box',
    warn: 'an-warning-box',
    danger: 'an-warning-box',
  }[type] ?? 'an-easy-box'

  return (
    <div className={`${cls} ${className}`} style={style}>

      <div className="an-explain-title">
        <span className="line"></span>
        <span>{title}</span>
        <span className="line"></span>
      </div>

      {body && (
        <div className="an-explain-body">
          <span dangerouslySetInnerHTML={{ __html: body }} />
        </div>
      )}

    </div>
  )
}
