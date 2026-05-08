"""
scripts/seed_fss_contents.py
─────────────────────────────
금감원(FSS) real_contents.json 을 RAG 적재용으로 전처리·청킹·임베딩하여 Supabase 에 적재한다. 

흐름:
  1. JSON 로드 → fss_contents 업서트 (raw_html / plain_text 보관)
  2. HTML 정제 (BeautifulSoup + html.unescape, 동영상 자막 잡음 제거)
  3. RecursiveCharacterTextSplitter 로 한국어 청크 분할 (~700자 / overlap 100)
  4. knowledge_chunks 에 source='FSS' 로 청크 저장 (기존 RAG 인터페이스 재사용)
  5. text-embedding-3-small (1536d) 임베딩 → knowledge_embeddings
  6. fss_contents.embedded_at / chunk_count 갱신

실행:
  cd backend
  python scripts/seed_fss_contents.py \
      --json-path "C:/workAI/TeamProject3/safeInvest_education/data/real_contents.json"

옵션:
  --dry-run          : DB 쓰기 없이 통계만 출력
  --limit N          : 상위 N개 콘텐츠만 처리 (디버그)
  --only-categories  : 'AAAA,BBBB' 형식으로 카테고리 필터
  --resume           : embedded_at 이 NULL 인 항목만 재처리
  --batch 64         : 임베딩 배치 크기

요구 패키지: openai, beautifulsoup4, langchain-text-splitters, supabase, tqdm
"""

from __future__ import annotations

import argparse, html, json, os, re, sys, time, uuid
from typing import Iterable

# backend/ 를 import path 에 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from bs4 import BeautifulSoup
from langchain_text_splitters import RecursiveCharacterTextSplitter
from openai import OpenAI
from tqdm import tqdm

from app.core.config import settings
from app.core.supabase import supabase_admin

EMBED_MODEL = "text-embedding-3-small"   # 1536d, 저렴
CHUNK_SIZE = 700
CHUNK_OVERLAP = 100
SOURCE_TAG = "FSS"
SOURCE_BASE_URL = "https://www.fss.or.kr/edu"

openai_client = OpenAI(api_key=settings.openai_api_key)


# ── 1. HTML → plain text ─────────────────────────────────────────────────────

# real_contents.json 에는 'rn' (\r\n 의 escape 잔존), 다중 nbsp, 인라인 style 이 많음
_RE_RN = re.compile(r"\brn\b")
_RE_MULTI_WS = re.compile(r"[ \t]+")
_RE_MULTI_NL = re.compile(r"\n{3,}")
_RE_VIDEO_HEADER = re.compile(r"\[?\s*동영상\s*자막\s*\]?", re.IGNORECASE)


def clean_html(raw: str) -> str:
    """FSS HTML 본문을 학습용 plain text 로 정제."""
    if not raw:
        return ""

    # 1) HTML entity 디코드 + 'rn' 토큰 제거
    text = html.unescape(raw)
    text = _RE_RN.sub("\n", text)

    # 2) BeautifulSoup 으로 태그 제거 (한국어 안전)
    soup = BeautifulSoup(text, "html.parser")
    for tag in soup(["script", "style"]):
        tag.decompose()
    text = soup.get_text(separator="\n")

    # 3) 정규화
    text = _RE_VIDEO_HEADER.sub("", text)
    text = text.replace("\xa0", " ")
    text = _RE_MULTI_WS.sub(" ", text)
    text = _RE_MULTI_NL.sub("\n\n", text)
    return text.strip()


# ── 2. 청킹 ───────────────────────────────────────────────────────────────────

_splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP,
    separators=["\n\n", "\n", "。", ". ", "! ", "? ", " ", ""],
    length_function=len,
)


def chunk_text(text: str) -> list[str]:
    if not text or len(text) < 50:
        return []
    return [c.strip() for c in _splitter.split_text(text) if c.strip()]


# ── 3. JSON 로드 → fss_contents 행 변환 ───────────────────────────────────────

def iter_items(json_path: str) -> Iterable[tuple[str, dict]]:
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    for category_code, items in data.items():
        for item in items:
            yield category_code, item


def to_fss_row(category_code: str, item: dict) -> dict:
    raw_html = item.get("cntnt", "") or ""
    plain = clean_html(raw_html)
    return {
        "contents_slno":       str(item.get("contentsSlno") or "").strip(),
        "category_code":       category_code,
        "title":               item.get("title"),
        "edu_trgt_cntnt":      item.get("eduTrgtCntnt"),
        "play_second":         _safe_int(item.get("playSecond")),
        "fnc_engn_code":       item.get("fncEngnCode"),
        "make_type_code":      item.get("makeTypeCode"),
        "xtrnl_contents_url":  item.get("xtrnlContentsUrl"),
        "file_down_url":       item.get("fileDownUrl"),
        "book_reg_qnty":       _safe_int(item.get("bookRegQnty")),
        "book_aply_avlbl_yn":  item.get("bookAplyAvlblYn"),
        "cpyrht_perm_code":    item.get("cpyrhtPermCode"),
        "cpyrht_perm_code_etc": item.get("cpyrhtPermCodeEtc"),
        "producing_yr":        item.get("producingYr"),
        "raw_html":            raw_html,
        "plain_text":          plain,
        "char_count":          len(plain),
    }


def _safe_int(v) -> int | None:
    try:
        return int(v) if v not in (None, "", "null") else None
    except (TypeError, ValueError):
        return None


# ── 4. Supabase 적재 ─────────────────────────────────────────────────────────

def upsert_fss_contents(rows: list[dict], dry_run: bool) -> None:
    if dry_run or not rows:
        return
    # contents_slno PK 기준 upsert
    BATCH = 200
    for i in range(0, len(rows), BATCH):
        supabase_admin.table("fss_contents").upsert(
            rows[i : i + BATCH],
            on_conflict="contents_slno",
        ).execute()


def delete_existing_chunks(contents_slno: str, dry_run: bool) -> None:
    """동일 contents_slno 의 기존 FSS 청크/임베딩 삭제 (재처리 안전성)."""
    if dry_run:
        return
    # knowledge_embeddings 는 chunk_id ON DELETE CASCADE 이므로 chunks 만 지우면 됨
    supabase_admin.table("knowledge_chunks") \
        .delete() \
        .eq("source", SOURCE_TAG) \
        .filter("metadata->>contents_slno", "eq", contents_slno) \
        .execute()


def insert_chunks_with_embeddings(
    fss_row: dict,
    chunks: list[str],
    batch_size: int,
    dry_run: bool,
) -> int:
    """청크 → knowledge_chunks insert → 임베딩 → knowledge_embeddings insert."""
    if not chunks:
        return 0

    # 4-1. chunks insert (id 받아옴)
    chunk_records = [
        {
            "id":         str(uuid.uuid4()),
            "category":   fss_row["category_code"],
            "title":      fss_row["title"],
            "content":    c,
            "source":     SOURCE_TAG,
            "source_url": fss_row.get("xtrnl_contents_url") or fss_row.get("file_down_url") or SOURCE_BASE_URL,
            "tags":       ["FSS", "금감원", fss_row["category_code"]],
            "metadata": {
                "contents_slno": fss_row["contents_slno"],
                "category_code": fss_row["category_code"],
                "chunk_idx":     idx,
                "producing_yr":  fss_row.get("producing_yr"),
            },
        }
        for idx, c in enumerate(chunks)
    ]

    if not dry_run:
        supabase_admin.table("knowledge_chunks").insert(chunk_records).execute()

    # 4-2. 임베딩 (batch)
    for start in range(0, len(chunk_records), batch_size):
        batch = chunk_records[start : start + batch_size]
        texts = [c["content"] for c in batch]
        if dry_run:
            continue

        # 재시도 (네트워크/429 안전망)
        for attempt in range(3):
            try:
                resp = openai_client.embeddings.create(model=EMBED_MODEL, input=texts)
                break
            except Exception as e:
                if attempt == 2:
                    raise
                wait = 2 ** attempt
                print(f"  [embed retry {attempt+1}] {e} — {wait}s 대기")
                time.sleep(wait)

        emb_records = [
            {
                "chunk_id":  batch[i]["id"],
                "embedding": d.embedding,
            }
            for i, d in enumerate(resp.data)
        ]
        supabase_admin.table("knowledge_embeddings").insert(emb_records).execute()

    return len(chunk_records)


def mark_embedded(contents_slno: str, chunk_count: int, dry_run: bool) -> None:
    if dry_run:
        return
    supabase_admin.table("fss_contents").update({
        "chunk_count": chunk_count,
        "embedded_at": "now()",
    }).eq("contents_slno", contents_slno).execute()


# ── 5. 메인 파이프라인 ───────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--json-path",
        default=r"C:/workAI/TeamProject3/safeInvest_education/data/real_contents.json",
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--only-categories", default="")
    parser.add_argument("--resume", action="store_true",
                        help="embedded_at IS NULL 인 항목만 처리")
    parser.add_argument("--batch", type=int, default=64,
                        help="임베딩 배치 크기")
    args = parser.parse_args()

    cat_filter = {c.strip() for c in args.only_categories.split(",") if c.strip()}

    # 1) 전체 로드 + 메타 업서트
    print(f"[1/3] JSON 로드: {args.json_path}")
    rows = []
    for cat, item in iter_items(args.json_path):
        if cat_filter and cat not in cat_filter:
            continue
        row = to_fss_row(cat, item)
        if not row["contents_slno"]:
            continue
        rows.append(row)
    if args.limit:
        rows = rows[: args.limit]

    # 중복 제거: 동일 contents_slno 가 여러 카테고리에 중복 등장하므로
    # 마지막에 본 row 를 유지 (PostgreSQL ON CONFLICT 단일문 제약 회피)
    before = len(rows)
    deduped: dict[str, dict] = {}
    for r in rows:
        deduped[r["contents_slno"]] = r
    rows = list(deduped.values())
    if before != len(rows):
        print(f"  → 중복 제거: {before} → {len(rows)} (동일 slno 다중 카테고리 등장)")

    print(f"  → {len(rows)}건 메타 적재")
    upsert_fss_contents(rows, args.dry_run)

    # 2) resume 모드: 미완료만 필터
    if args.resume and not args.dry_run:
        done = supabase_admin.table("fss_contents") \
            .select("contents_slno") \
            .not_.is_("embedded_at", "null") \
            .execute()
        done_ids = {r["contents_slno"] for r in (done.data or [])}
        before = len(rows)
        rows = [r for r in rows if r["contents_slno"] not in done_ids]
        print(f"  → resume: {before} → {len(rows)} (미완료만)")

    # 3) 청킹 + 임베딩
    print(f"[2/3] 청킹/임베딩 (model={EMBED_MODEL}, chunk={CHUNK_SIZE}/{CHUNK_OVERLAP})")
    total_chunks = 0
    skipped = 0
    for row in tqdm(rows, desc="FSS"):
        chunks = chunk_text(row["plain_text"])
        if not chunks:
            skipped += 1
            continue
        delete_existing_chunks(row["contents_slno"], args.dry_run)
        n = insert_chunks_with_embeddings(row, chunks, args.batch, args.dry_run)
        mark_embedded(row["contents_slno"], n, args.dry_run)
        total_chunks += n

    print(f"[3/3] 완료: {len(rows) - skipped}건 / 청크 {total_chunks}개 / 본문없음 스킵 {skipped}")
    if args.dry_run:
        print("  (dry-run: DB 변경 없음)")


if __name__ == "__main__":
    main()
