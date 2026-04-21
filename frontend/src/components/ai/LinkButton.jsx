export default function LinkButton({ url, label = '자세히 알아보기' }) {
  if (!url) return null
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="link-button">
      {label} →
    </a>
  )
}
