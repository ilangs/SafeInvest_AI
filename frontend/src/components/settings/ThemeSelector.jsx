import { useThemeMode } from '../../hooks/useThemeMode'

/**
 * 화면 스타일 3-카드 선택기
 *   라이트 모드 / 다크 모드 / 기기 설정
 * 각 카드는 작은 미리보기(가로 막대 3개)로 표현되며 선택 시 그린 보더 + 체크 마크.
 */
export default function ThemeSelector() {
  const { theme, setTheme } = useThemeMode()

  const options = [
    { key: 'light',  label: '라이트 모드', preview: 'light' },
    { key: 'dark',   label: '다크 모드',   preview: 'dark' },
    { key: 'system', label: '기기 설정',   preview: 'split' },
  ]

  return (
    <section className="theme-selector">
      <header className="theme-selector__header">
        <h3 className="theme-selector__title">화면 스타일</h3>
        <span className="theme-selector__hint" title="라이트/다크/기기 설정 중 선택할 수 있습니다.">
          ⓘ
        </span>
      </header>

      <div className="theme-selector__grid">
        {options.map(opt => (
          <button
            key={opt.key}
            type="button"
            className={`theme-card${theme === opt.key ? ' is-active' : ''}`}
            onClick={() => setTheme(opt.key)}
            aria-pressed={theme === opt.key}
            aria-label={opt.label}
          >
            <span className={`theme-card__preview theme-card__preview--${opt.preview}`}>
              <span className="theme-card__bar theme-card__bar--accent" />
              <span className="theme-card__bar theme-card__bar--text" />
              <span className="theme-card__bar theme-card__bar--muted" />
            </span>

            {theme === opt.key && (
              <span className="theme-card__check" aria-hidden="true">✓</span>
            )}

            <span className="theme-card__label">{opt.label}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
