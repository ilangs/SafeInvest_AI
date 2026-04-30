/**
 * 금액 포맷 (원화)
 * 1조 이상 → "X.X조"
 * 100억 이상 → "X,XXX억"
 * 1억 이상 → "X.X억"
 * 그 외 → "X,XXX원"
 */
export function formatKRW(amount) {
  if (amount == null) return '-'
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  if (abs >= 1_000_000_000_000)
    return `${sign}${(abs / 1_000_000_000_000).toFixed(1)}조`
  if (abs >= 100_000_000)
    return `${sign}${Math.round(abs / 100_000_000).toLocaleString()}억`
  if (abs >= 10_000_000)
    return `${sign}${(abs / 100_000_000).toFixed(1)}억`
  return `${sign}${abs.toLocaleString()}원`
}

/**
 * 거래량 포맷
 * 100만 이상 → "X.XM"
 * 1만 이상 → "XXk"
 */
export function formatVolume(vol) {
  if (vol == null) return '-'
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`
  if (vol >= 1_000) return `${Math.round(vol / 1_000)}k`
  return vol.toString()
}

/**
 * 등락률 포맷 (+2.10% / -1.34%)
 */
export function formatChange(rate) {
  if (rate == null) return '-'
  const sign = rate >= 0 ? '+' : ''
  return `${sign}${rate.toFixed(2)}%`
}

/**
 * 날짜 포맷 (YYYY-MM-DD → MM/DD)
 */
export function formatChartDate(dateStr) {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length < 3) return dateStr
  return `${parts[1]}/${parts[2]}`
}
