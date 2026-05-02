/**
 * analysisApi.js
 * Analysis 모듈 전용 API + 포맷 유틸.
 * 기존 axios api 인스턴스(JWT 자동 주입)를 재사용.
 */
import axiosApi from './api'

const BASE = '/api/v1'

async function get(path) {
  const res = await axiosApi.get(`${BASE}${path}`)
  return res.data
}

async function post(path) {
  const res = await axiosApi.post(`${BASE}${path}`)
  return res.data
}

async function del(path) {
  const res = await axiosApi.delete(`${BASE}${path}`)
  return res.data
}

export const api = {
  marketStats:    ()  => get('/market/stats'),
  stocks:         ()  => get('/stocks'),
  stockInfo:      (t) => get(`/stocks/${t}`),
  stockScore:     (t) => get(`/stocks/${t}/score`),
  stockFinancials:(t) => get(`/stocks/${t}/financials`),
  stockPrices:    (t) => get(`/stocks/${t}/prices`),
  stockWarnings:  (t) => get(`/stocks/${t}/warnings`),
  latestPrice:    (t) => get(`/stocks/${t}/latest-price`),
  recentSearches: ()  => get('/recent-searches'),
  addRecent:      (t) => post(`/recent-searches/${t}`),
  deleteRecent:   (t) => del(`/recent-searches/${t}`),
  clearRecent:    ()  => del('/recent-searches'),
  aiAnalysis:     (t) => post(`/stocks/${t}/ai`),
}

// ── 포맷 유틸 ────────────────────────────────────────
export function fmtMoney(v) {
  if (v == null || isNaN(v)) return '-'
  const sign = v < 0 ? '-' : ''
  const n = Math.abs(v)
  if (n >= 1e13) return `${sign}${(n/1e13).toFixed(1)}조원`
  if (n >= 1e8)  return `${sign}${(n/1e8).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,',')}억원`
  return `${sign}${n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,',')}원`
}

export function fmtPrice(v) {
  if (v == null || isNaN(v)) return '-'
  return `${Number(v).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,',')}원`
}

export function fmtRatio(v) {
  if (v == null || isNaN(v)) return '-'
  return `${Number(v).toFixed(1)}%`
}

export function fmtPercent(v) {
  if (v == null || isNaN(v)) return '-'
  const sign = v >= 0 ? '+' : ''
  return `${sign}${Number(v).toFixed(2)}%`
}

export function fmtVolume(v) {
  if (v == null || isNaN(v)) return '-'
  return `${Math.round(v).toLocaleString()}주`
}

export function getGrade(score) {
  if (score >= 80) return { label: '우수', color: '#22c55e', cls: 'an-badge-excellent' }
  if (score >= 65) return { label: '양호', color: '#3b82f6', cls: 'an-badge-good' }
  if (score >= 45) return { label: '보통', color: '#eab308', cls: 'an-badge-normal' }
  if (score >= 25) return { label: '주의', color: '#f97316', cls: 'an-badge-caution' }
  return               { label: '위험', color: '#ef4444', cls: 'an-badge-danger' }
}

export function gradeMessage(score, name) {
  if (score >= 80) return `<b>${name}</b>: 현재 데이터 기준 재무 안정성·수익성·거래 활성도가 전반적으로 우수합니다. 초보 투자자가 특히 조심해야 할 중대한 위험 신호가 적습니다.`
  if (score >= 65) return `<b>${name}</b>: 대체로 양호한 투자 요건입니다. 일부 지표는 추가 확인이 필요하지만 즉각적인 고위험 신호는 크지 않습니다.`
  if (score >= 45) return `<b>${name}</b>: 위험하다고 단정할 단계는 아니지만 재무 흐름과 최근 주가 변동을 함께 확인하는 것이 좋습니다.`
  if (score >= 25) return `<b>${name}</b>: 몇 가지 위험 신호가 확인됩니다. 매수 전 적자 지속 여부·부채비율·거래량·최근 공시를 반드시 확인하세요.`
  return `<b>${name}</b>: 현재 데이터 기준 위험 신호가 강하게 나타납니다. 자본잠식·장기 적자·고부채·낮은 매출·거래 부진 여부를 반드시 확인해야 합니다.`
}

export function warnKorean(t) {
  return { CAPITAL_IMPAIRMENT:'자본잠식', CONTINUOUS_LOSS:'3년 연속 적자', HIGH_DEBT:'고부채', LOW_REVENUE:'매출 부족' }[t] ?? t
}

export function warnDesc(t) {
  return {
    CAPITAL_IMPAIRMENT: '누적 손실이 커서 자기자본이 마이너스인 상태입니다.',
    CONTINUOUS_LOSS:    '최근 3년 동안 계속 순손실이 발생했습니다.',
    HIGH_DEBT:          '자본 대비 빚이 매우 큰 상태입니다.',
    LOW_REVENUE:        '연간 매출이 작아 사업 안정성이 낮을 수 있습니다.',
  }[t] ?? '추가 공시 확인이 필요합니다.'
}

export function priceChangeColor(v) {
  if (v == null || isNaN(v)) return '#94a3b8'
  return v > 0 ? '#ef4444' : v < 0 ? '#3b82f6' : '#94a3b8'
}

export function darkLayout(title, height = 420, extra = {}) {
  return {
    title: { text: title, font: { size: 20, color: '#dbeafe' } },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor:  'rgba(18,24,41,0.55)',
    font:   { color: '#dbeafe', size: 13 },
    height,
    margin: { l: 44, r: 20, t: 56, b: 40 },
    legend: { bgcolor: 'rgba(0,0,0,0)' },
    xaxis: { gridcolor: 'rgba(255,255,255,0.07)' },
    yaxis: { gridcolor: 'rgba(255,255,255,0.07)' },
    ...extra,
  }
}
