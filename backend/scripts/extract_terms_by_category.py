"""
scripts/extract_terms_by_category.py
─────────────────────────────────────
카테고리 타깃 기반 LLM 큐레이션 (Track B).

기존 95개 → 약 235개로 확장. 카테고리별로 LLM(gpt-4o, temperature=0.3)에
"이 영역의 핵심 용어 N개를 채우라"고 요청, 기존 용어 명단을 prompt에 주입해
중복을 차단한다. FSS RAG 미사용.

실행:
  cd backend
  python scripts/extract_terms_by_category.py

산출:
  backend/scripts/new_terms_dryrun.json   (DB 미반영, 사람 검수용)
"""

import sys
import os
import re
import json
import time
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from openai import OpenAI
from app.core.config import settings
from app.core.supabase import supabase_admin

openai_client = OpenAI(api_key=settings.openai_api_key)

# ── 카테고리 정의 + 목표 수량 ─────────────────────────────────────────
CATEGORY_PLAN = [
    # (카테고리,    목표 총수, 정의, 추천 용어 힌트)
    ('가치평가',      15, '기업 가치를 평가하는 비율·지표',
     '예: EV/EBITDA, FCF, 잔여이익, 배당할인모형, 토빈Q'),
    ('재무분석',      18, '회계·재무제표 구성 항목과 비율',
     '예: 유동비율, 자산회전율, 매출총이익, GP마진, 유보율, 영업현금흐름, 무형자산, 영업권'),
    ('시장기초',      15, '주식시장 구성 요소와 기본 개념',
     '예: 시가총액, 액면가, 우선주, 보통주, 자사주, 무상증자, 유상증자'),
    ('시장흐름',      12, '시장 동향·국면 관련 개념',
     '예: 횡보장, 박스권, 패닉셀, 패닉바잉, 산타랠리, 1월효과'),
    ('거시경제',      18, '금리·환율·물가 등 거시 변수와 정책',
     '예: 기준금리, 장단기금리차, 명목금리, 실질금리, PPI, PCE, 양적완화, 테이퍼링, GDP갭'),
    ('실적뉴스',      12, '실적 발표·공시·뉴스 관련 용어',
     '예: 잠정실적, 정정공시, 자율공시, 사외이사, 주총, 컨퍼런스콜'),
    ('투자전략',      18, '투자 방식·전략·자산배분 개념',
     '예: 적립식, 거치식, 가치투자, 모멘텀투자, 코스트애버리징, 바이앤홀드, 듀얼모멘텀'),
    ('위험관리',      15, '리스크·헤지·체계적 위험 관련',
     '예: 시스템리스크, 베타, 변동성위험, VaR, 헤지비율, 환헤지, 신용리스크'),
    ('투자심리',      12, '행동재무학·심리 편향',
     '예: 군중심리, 앵커링, 휴리스틱, 가용성편향, 후회회피, 매몰비용오류'),
    ('매매기초',      14, '주문 방식과 매매 메커니즘',
     '예: 시간외단일가, 정정주문, 취소주문, 호가단위, 상한가, 하한가, IOC, FOK'),
    ('차트분석',      14, '기술적 지표와 차트 패턴',
     '예: RSI, MACD, 볼린저밴드, 스토캐스틱, 거래량지표, 헤드앤숄더, 더블탑, 갭, 추세선'),
    ('계좌기초',      10, '증권계좌·세금·수수료 등',
     '예: 거래수수료, 양도소득세, 배당소득세, 종합과세, ISA, 일임형, CMA'),
    ('투자유의',      10, '투자 사기·불공정거래·경보',
     '예: 시세조종, 작전주, 미공개정보이용, 단주매매, 유사수신, 가두리펌핑'),
    ('펀드/ETF',     18, '펀드·ETF 상품과 운용',
     '예: 액티브ETF, 패시브ETF, 인덱스펀드, 채권형펀드, MMF, TDF, 추종지수, 괴리율, 운용보수, 판매보수, 환매수수료, 기준가격'),
    ('채권/금리상품', 12, '채권·예금·기타 금리상품',
     '예: 국채, 회사채, 표면금리, 만기수익률, 듀레이션, 신용등급, CD, RP, 정기예금'),
    ('파생상품',     12, '선물·옵션·스왑',
     '예: 선물, 옵션, 콜옵션, 풋옵션, 행사가격, 만기일, 내재가치, 시간가치, 델타, 감마, 스왑, 헤지'),
    ('연금/은퇴',    10, '개인연금·퇴직연금·노후',
     '예: IRP, 퇴직연금, DC형, DB형, 연금저축, TDF, 노후자금, 4%룰'),
]

HANGUL_CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ',
              'ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ']

def get_initials(term: str):
    if not term:
        return None, None
    first = term[0]
    code = ord(first)
    if 0xAC00 <= code <= 0xD7A3:
        idx = (code - 0xAC00) // (21 * 28)
        return HANGUL_CHO[idx], None
    if 'A' <= first.upper() <= 'Z':
        return None, first.upper()
    return None, None

def norm(s):
    return re.sub(r'\s+', '', (s or '').lower())

# ── 기존 용어 로드 ──────────────────────────────────────────────────
def load_existing():
    res = supabase_admin.table('stock_terms').select('id,term,term_ko,category').execute()
    rows = res.data or []
    by_cat = {}
    norm_set = set()
    max_id_num = 0
    for r in rows:
        by_cat.setdefault(r['category'], []).append(r['term'])
        norm_set.add(norm(r['term']))
        if r.get('term_ko'):
            norm_set.add(norm(r['term_ko']))
        m = re.match(r'T(\d+)$', r['id'] or '')
        if m:
            max_id_num = max(max_id_num, int(m.group(1)))
    return by_cat, norm_set, max_id_num

# ── 카테고리별 LLM 생성 ─────────────────────────────────────────────
def generate_for_category(cat_name, target_count, definition, hint,
                          existing_in_cat, all_existing_norm,
                          already_generated_norm):
    existing_str = ', '.join(existing_in_cat) if existing_in_cat else '(없음)'
    avoid_str = ', '.join(sorted(already_generated_norm)) if already_generated_norm else '(없음)'

    prompt = f"""당신은 한국 주식·투자 백과사전의 도메인 편집자입니다.

[카테고리] {cat_name}
[정의] {definition}
[추천 용어 힌트] {hint}

[이 카테고리에 이미 있는 용어 — 절대 중복 금지]
{existing_str}

[다른 카테고리에서 이미 생성한 신규 용어 — 절대 중복 금지]
{avoid_str}

[작업]
이 카테고리에 추가할 한국 개인투자자가 알아둘 만한 핵심 용어를 **정확히 {target_count}개** 생성하세요.
- 위 기존 용어와 의미 중복 금지
- 너무 일반적인 단어(투자, 금융, 시장 등) 금지
- 영문 약어는 원형 그대로 (PER, ETF, IRP 등)
- 한국어 용어는 표준 표기 사용

[출력 JSON 객체 — items 키에 배열로 출력]
{{
  "items": [
    {{
      "term": "용어명 (영문 약어 또는 한국어)",
      "term_ko": "영문일 때 한국어 정식명, 한국어면 null",
      "importance": 1~5 정수 (5=핵심필수, 3=기본, 1=참고),
      "tags": ["태그1","태그2","태그3"],
      "description": "정의 (60~150자, 정확하고 사실 기반)",
      "easy_desc": "초보자용 비유 설명 (40~100자)",
      "formula": "계산식 (해당 시) 또는 null",
      "caution": "주의사항 (있을 시) 또는 null"
    }}
  ]
}}

JSON만 출력. 정확히 {target_count}개를 생성하세요."""

    resp = openai_client.chat.completions.create(
        model='gpt-4o',
        messages=[{'role':'user','content':prompt}],
        response_format={'type':'json_object'},
        temperature=0.3,
    )
    try:
        data = json.loads(resp.choices[0].message.content)
        items = data.get('items') if isinstance(data, dict) else None
        if not isinstance(items, list):
            # fallback: 객체 안 첫 배열 사용
            if isinstance(data, dict):
                for v in data.values():
                    if isinstance(v, list):
                        items = v
                        break
        return items or []
    except Exception as e:
        print(f"  ⚠️ JSON parse 실패 [{cat_name}]: {e}")
        return []

def validate(item, cat_name):
    if not item or not isinstance(item, dict):
        return False, 'invalid_obj'
    term = (item.get('term') or '').strip()
    if not term: return False, 'empty_term'
    if len(term) > 12: return False, 'long_term'
    desc = item.get('description') or ''
    if len(desc) < 25: return False, 'short_desc'
    return True, 'ok'

# ── 메인 ──────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("카테고리 타깃 기반 신규 용어 생성 (Track B)")
    print("=" * 60)

    by_cat, all_existing_norm, max_id = load_existing()
    print(f"기존 총 {sum(len(v) for v in by_cat.values())}개, 다음 ID = T{max_id+1:03d}")

    all_new = []
    generated_norm = set()
    next_id = max_id + 1
    total_target = 0

    for cat_name, target_total, definition, hint in CATEGORY_PLAN:
        existing_in_cat = by_cat.get(cat_name, [])
        need = max(0, target_total - len(existing_in_cat))
        total_target += need
        if need == 0:
            print(f"[{cat_name}] 이미 {len(existing_in_cat)}개 ≥ 목표 {target_total} → 생성 안함")
            continue

        print(f"\n[{cat_name}] 기존 {len(existing_in_cat)}개 → 신규 {need}개 생성 중...")
        items = generate_for_category(
            cat_name, need, definition, hint,
            existing_in_cat, all_existing_norm, generated_norm
        )
        kept = 0
        skipped_dup = 0
        skipped_inv = 0
        for it in items:
            term = (it.get('term') or '').strip()
            nk = norm(term)
            # term_ko 정규화: 문자열 "null"/"None" → None, term과 동일/공백차 → None
            tk = it.get('term_ko')
            if isinstance(tk, str):
                s = tk.strip()
                if s.lower() in ('null','none','') or norm(s) == nk:
                    it['term_ko'] = None
                else:
                    it['term_ko'] = s
            if nk in all_existing_norm or nk in generated_norm:
                skipped_dup += 1
                continue
            ok, reason = validate(it, cat_name)
            if not ok:
                skipped_inv += 1
                print(f"   ❌ {term} ({reason})")
                continue
            # formula/caution도 같은 정규화
            for k in ('formula','caution'):
                v = it.get(k)
                if isinstance(v, str) and v.strip().lower() in ('null','none',''):
                    it[k] = None
            it['category'] = cat_name
            it['id'] = f"T{next_id:03d}"
            ini_ko, ini_en = get_initials(term)
            it['initial_ko'] = ini_ko
            it['initial_en'] = ini_en
            it.setdefault('related_ids', [])
            it.setdefault('term_ko', None)
            it.setdefault('formula', None)
            it.setdefault('caution', None)
            it.setdefault('tags', [])
            it.setdefault('importance', 3)
            all_new.append(it)
            generated_norm.add(nk)
            next_id += 1
            kept += 1
        print(f"   ✅ 채택 {kept}/{need}  (중복스킵 {skipped_dup}, 무효 {skipped_inv})")
        time.sleep(0.3)

    out_path = Path(__file__).parent / 'new_terms_dryrun.json'
    out_path.write_text(json.dumps(all_new, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"\n🎉 완료. 신규 {len(all_new)}개 / 목표 {total_target}개 → {out_path}")
    print(f"   기존 95 + 신규 {len(all_new)} = 예상 총 {95 + len(all_new)}개")

if __name__ == '__main__':
    main()
