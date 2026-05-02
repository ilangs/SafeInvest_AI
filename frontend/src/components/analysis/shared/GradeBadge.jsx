import { getGrade } from '../../../services/analysisApi'

export default function GradeBadge({ score, label, style }) {
  const g = label ? { label, cls: _labelToCls(label) } : getGrade(score ?? 0)
  return (
    <span className={`an-grade-badge ${g.cls}`} style={style}>
      {g.label}
    </span>
  )
}

function _labelToCls(l) {
  return {
    '우수': 'an-badge-excellent',
    '양호': 'an-badge-good',
    '보통': 'an-badge-normal',
    '주의': 'an-badge-caution',
    '위험': 'an-badge-danger',
  }[l] ?? 'an-badge-normal'
}
