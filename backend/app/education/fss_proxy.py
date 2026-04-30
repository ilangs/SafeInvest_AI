"""
금감원 fileDown.do 프록시

금감원 e-금융교육센터의 파일 다운로드 URL은 확장자가 없어서
프론트엔드에서 PDF/이미지/영상 여부를 판별할 수 없다.
이 모듈은 서버에서 먼저 Content-Type을 확인 후 인라인 렌더링이 가능한 형태로
프록시해서 스트리밍한다.

주요 엔드포인트:
- GET /api/proxy/fss-file/meta?atchFileId=...&fileSn=1
    → {"content_type": "application/pdf", "filename": "xxx.pdf", "size": 12345}
- GET /api/proxy/fss-file?atchFileId=...&fileSn=1
    → 실제 파일 스트리밍 (inline disposition, CORS 허용)

설계 포인트:
- fss.or.kr 도메인에만 붙음 (SSRF 방지)
- 메타데이터는 메모리 캐시 (TTL 1시간)
- 파일 크기 상한 (50MB)
- 표준 라이브러리만 사용 (urllib)
"""
from __future__ import annotations

import re
import time
import urllib.parse
import urllib.request
import urllib.error
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse, JSONResponse


# ============================================================
# 설정
# ============================================================
FSS_FILE_DOWN_URL = "https://www.fss.or.kr/edu/cmmn/file/fileDown.do"
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
CACHE_TTL_SECONDS = 3600  # 1시간
REQUEST_TIMEOUT = 15  # 초
CHUNK_SIZE = 64 * 1024  # 64KB 스트리밍 청크

# 허용 mime 계열 → 우리 UI에서 어떻게 다룰지 분류
MIME_CATEGORY = {
    # 인라인 렌더 가능 (iframe/video/img/audio 태그로 바로 띄움)
    "application/pdf": "pdf",
    "image/jpeg": "image",
    "image/jpg": "image",
    "image/png": "image",
    "image/gif": "image",
    "image/webp": "image",
    "video/mp4": "video",
    "video/webm": "video",
    "video/quicktime": "video",
    "audio/mpeg": "audio",
    "audio/mp3": "audio",
    "audio/wav": "audio",
    "audio/ogg": "audio",
    # 인라인 불가 - 다운로드 안내
    "application/haansofthwp": "hwp",
    "application/x-hwp": "hwp",
    "application/vnd.hancom.hwp": "hwp",
    "application/x-hwpml": "hwp",
    "application/msword": "office",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "office",
    "application/vnd.ms-powerpoint": "office",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "office",
    "application/vnd.ms-excel": "office",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "office",
    "application/zip": "archive",
    "application/x-zip-compressed": "archive",
    "application/octet-stream": "unknown",  # 확장자로 추정 시도
}


# ============================================================
# 메타데이터 캐시 (간단한 인메모리)
# ============================================================
_meta_cache: dict[str, tuple[float, dict]] = {}


def _cache_get(key: str) -> Optional[dict]:
    entry = _meta_cache.get(key)
    if not entry:
        return None
    cached_at, value = entry
    if time.time() - cached_at > CACHE_TTL_SECONDS:
        _meta_cache.pop(key, None)
        return None
    return value


def _cache_set(key: str, value: dict) -> None:
    _meta_cache[key] = (time.time(), value)


# ============================================================
# 헬퍼 함수
# ============================================================
def _build_fss_url(atch_file_id: str, file_sn: str = "1") -> str:
    qs = urllib.parse.urlencode({"atchFileId": atch_file_id, "fileSn": file_sn})
    return f"{FSS_FILE_DOWN_URL}?{qs}"


_FILENAME_STAR_RE = re.compile(r"filename\*\s*=\s*([^;]+)", re.IGNORECASE)
_FILENAME_RE = re.compile(r'filename\s*=\s*"?([^";]+)"?', re.IGNORECASE)


def _parse_filename(content_disposition: str) -> Optional[str]:
    """Content-Disposition 헤더에서 filename 추출 (RFC 5987 포함)"""
    if not content_disposition:
        return None

    # RFC 5987 형식: filename*=UTF-8''encoded-name
    m = _FILENAME_STAR_RE.search(content_disposition)
    if m:
        raw = m.group(1).strip()
        # UTF-8''xxx 형태
        if "''" in raw:
            _, _, encoded = raw.partition("''")
            try:
                return urllib.parse.unquote(encoded)
            except Exception:
                pass

    # 일반 filename="xxx"
    m = _FILENAME_RE.search(content_disposition)
    if m:
        name = m.group(1).strip()

        # case 1: URL 인코딩된 상태 ("%EC%98%88..." 같은 형태) - 금감원에서 흔함
        if "%" in name:
            try:
                decoded = urllib.parse.unquote(name, errors="strict")
                # 디코딩 결과가 원본과 다르고, 유효한 한글이면 채택
                if decoded != name:
                    return decoded
            except Exception:
                pass

        # case 2: latin-1로 받은 UTF-8 바이트 재해석
        try:
            return name.encode("latin-1").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            # case 3: EUC-KR로 재해석
            try:
                return name.encode("latin-1").decode("euc-kr")
            except (UnicodeEncodeError, UnicodeDecodeError):
                return name
    return None


def _guess_category_from_filename(filename: str) -> str:
    """파일명 확장자로 카테고리 추정 (Content-Type이 octet-stream일 때 fallback)"""
    if not filename:
        return "unknown"
    lower = filename.lower()
    if lower.endswith(".pdf"):
        return "pdf"
    if lower.endswith((".jpg", ".jpeg", ".png", ".gif", ".webp")):
        return "image"
    if lower.endswith((".mp4", ".webm", ".mov", ".m4v")):
        return "video"
    if lower.endswith((".mp3", ".wav", ".ogg", ".m4a")):
        return "audio"
    if lower.endswith((".hwp", ".hwpx")):
        return "hwp"
    if lower.endswith((".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx")):
        return "office"
    if lower.endswith((".zip", ".rar", ".7z")):
        return "archive"
    return "unknown"


# 확장자 → 정확한 MIME 매핑 (브라우저가 미디어로 인식하도록)
_EXT_TO_MIME = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".gif": "image/gif", ".webp": "image/webp",
    ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".m4v": "video/mp4",
    ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".m4a": "audio/mp4",
    ".pdf": "application/pdf",
}


def _normalize_content_type(upstream_ct: str, category: str, filename: str) -> str:
    """
    금감원이 보낸 Content-Type을 카테고리 + 파일명 기반으로 정규화.

    예: 'application/octet-stream' + 'xxx.mp3' → 'audio/mpeg'

    이게 정확해야:
    - 브라우저가 <audio>/<video> source를 인식해서 실제 요청 보냄
    - PDF가 자동 다운로드되지 않고 인라인 표시됨
    """
    # PDF는 카테고리만으로 결정 가능
    if category == "pdf":
        return "application/pdf"

    # 이미지/영상/오디오는 파일명 확장자로 세분화
    if filename and category in ("image", "video", "audio"):
        fname_lower = filename.lower()
        for ext, mime in _EXT_TO_MIME.items():
            if fname_lower.endswith(ext):
                return mime

    # 정규화 안 되는 경우 원본 또는 octet-stream
    return upstream_ct or "application/octet-stream"


_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "*/*",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": "https://www.fss.or.kr/edu/main/main.do",
}


def _fetch_head(atch_file_id: str, file_sn: str, raise_on_404: bool = True) -> Optional[dict]:
    """
    금감원 파일의 헤더 정보를 먼저 가져와서 Content-Type / Content-Length / 파일명 확보.

    금감원 서버가 HEAD 요청을 거부할 수 있으므로, GET으로 짧게 읽고 바로 끊는 방식.

    Args:
        raise_on_404: True면 404도 HTTPException, False면 None 리턴 (파일 목록 순회용)
    """
    url = _build_fss_url(atch_file_id, file_sn)
    req = urllib.request.Request(url, headers=_BROWSER_HEADERS)

    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            headers = resp.headers
            content_type = (headers.get("Content-Type") or "").split(";")[0].strip().lower()
            content_length = headers.get("Content-Length")
            content_disposition = headers.get("Content-Disposition") or ""
            filename = _parse_filename(content_disposition)

            # 금감원이 파일 없을 때 HTML 오류 페이지를 200으로 반환하는 경우 방어
            # (Content-Disposition이 없으면 다운로드 파일이 아님)
            if not content_disposition and content_type.startswith("text/html"):
                if raise_on_404:
                    raise HTTPException(404, "파일을 찾을 수 없습니다")
                return None

            # 카테고리 결정
            category = MIME_CATEGORY.get(content_type, "unknown")
            if category == "unknown" and filename:
                category = _guess_category_from_filename(filename)

            try:
                size = int(content_length) if content_length else None
            except (TypeError, ValueError):
                size = None

            # content_type 정규화: 금감원이 octet-stream으로 보내도 카테고리 + 파일명 기반으로 실제 MIME으로 보정
            # 프론트의 <source type="...">에 들어가는 값이라 정확해야 브라우저가 미디어 요청을 보냄
            normalized_content_type = _normalize_content_type(content_type, category, filename)

            return {
                "file_sn": file_sn,
                "content_type": normalized_content_type,
                "filename": filename,
                "size": size,
                "category": category,
                "inline_renderable": category in ("pdf", "image", "video", "audio"),
            }
    except urllib.error.HTTPError as e:
        # 404는 "파일 없음"으로 취급 (목록 순회 시 stop signal)
        if e.code == 404 and not raise_on_404:
            return None
        raise HTTPException(502, f"금감원 서버 응답 오류: HTTP {e.code}")
    except urllib.error.URLError as e:
        raise HTTPException(502, f"금감원 서버 연결 실패: {e.reason}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"파일 정보 조회 실패: {e}")


def _fetch_file_list(atch_file_id: str, max_files: int = 10) -> list[dict]:
    """
    atchFileId에 연결된 모든 파일(fileSn=1,2,3...)의 메타를 순회해서 수집.

    stop 조건:
    - 404 응답 (파일 없음)
    - HTML 응답 (에러 페이지)
    - 연속 2건 실패
    - max_files 도달

    Returns: 파일 메타 리스트 (없으면 빈 리스트)
    """
    files = []
    consecutive_fails = 0

    for sn in range(1, max_files + 1):
        try:
            meta = _fetch_head(atch_file_id, str(sn), raise_on_404=False)
        except HTTPException as e:
            # 502 같은 상위 에러: 이미 하나라도 찾은 상태면 그만, 아니면 그대로 올림
            if files:
                break
            raise

        if meta is None:
            # 404 혹은 HTML 응답 = 파일 없음
            consecutive_fails += 1
            if consecutive_fails >= 2:
                break
            continue

        consecutive_fails = 0
        files.append(meta)

    return files


# ============================================================
# 라우터
# ============================================================
router = APIRouter(prefix="/api/proxy", tags=["fss-proxy"])


@router.get("/fss-file/meta")
async def get_fss_file_meta(
    atchFileId: str = Query(..., min_length=1, max_length=64),
    fileSn: str = Query("1", max_length=8),
):
    """
    금감원 파일 메타데이터 조회 (Content-Type, 파일명, 크기, 렌더 카테고리).

    프론트가 이걸 먼저 호출해서 PDF/이미지/영상/HWP 판별 후
    적절한 인라인 UI를 선택한다.
    """
    # 입력 검증: 영숫자+하이픈만 허용
    if not re.match(r"^[a-zA-Z0-9_-]+$", atchFileId):
        raise HTTPException(400, "잘못된 atchFileId")
    if not re.match(r"^\d+$", fileSn):
        raise HTTPException(400, "잘못된 fileSn")

    cache_key = f"{atchFileId}:{fileSn}"
    cached = _cache_get(cache_key)
    if cached:
        return JSONResponse(cached)

    meta = _fetch_head(atchFileId, fileSn)
    _cache_set(cache_key, meta)
    return JSONResponse(meta)


@router.get("/fss-file/list")
async def list_fss_files(
    atchFileId: str = Query(..., min_length=1, max_length=64),
    max_files: int = Query(10, ge=1, le=20),
):
    """
    atchFileId에 연결된 모든 파일 목록 조회 (fileSn=1,2,3... 순회).

    금감원 e-금융교육센터는 하나의 atchFileId에 여러 파일(영상+썸네일+자료집 등)이
    묶여 있는 경우가 많은데, API 메타데이터는 첫 파일만 반환함.
    이 엔드포인트가 존재하는 모든 파일을 스캔해서 프론트가 유형별로 렌더링할 수
    있도록 파일 목록을 제공한다.

    Returns:
        {
          "atch_file_id": "xxx",
          "count": 3,
          "files": [
            {"file_sn":"1", "category":"image", "content_type":"image/jpeg", ...},
            {"file_sn":"2", "category":"video", "content_type":"video/mp4", ...},
            ...
          ],
          "has_video": true,
          "has_pdf": false,
          "has_image": true
        }
    """
    if not re.match(r"^[a-zA-Z0-9_-]+$", atchFileId):
        raise HTTPException(400, "잘못된 atchFileId")

    cache_key = f"list:{atchFileId}:{max_files}"
    cached = _cache_get(cache_key)
    if cached:
        return JSONResponse(cached)

    files = _fetch_file_list(atchFileId, max_files=max_files)

    # 개별 파일 메타도 함께 캐시
    for f in files:
        _cache_set(f"{atchFileId}:{f['file_sn']}", f)

    result = {
        "atch_file_id": atchFileId,
        "count": len(files),
        "files": files,
        "has_video": any(f["category"] == "video" for f in files),
        "has_pdf": any(f["category"] == "pdf" for f in files),
        "has_image": any(f["category"] == "image" for f in files),
        "has_audio": any(f["category"] == "audio" for f in files),
    }
    _cache_set(cache_key, result)
    return JSONResponse(result)


@router.get("/fss-file")
async def stream_fss_file(
    request: Request,
    atchFileId: str = Query(..., min_length=1, max_length=64),
    fileSn: str = Query("1", max_length=8),
    disposition: str = Query("inline", pattern="^(inline|attachment)$"),
):
    """
    금감원 파일을 서버 경유로 스트리밍.

    - disposition=inline: 브라우저에서 바로 띄우기 (PDF/이미지/영상)
    - disposition=attachment: 다운로드 (HWP/Office 등)
    - HTTP Range 요청 지원: 오디오/비디오의 시킹 및 메타데이터 로딩 필수
    """
    if not re.match(r"^[a-zA-Z0-9_-]+$", atchFileId):
        raise HTTPException(400, "잘못된 atchFileId")
    if not re.match(r"^\d+$", fileSn):
        raise HTTPException(400, "잘못된 fileSn")

    url = _build_fss_url(atchFileId, fileSn)

    # 클라이언트에서 보낸 Range 헤더를 upstream에 그대로 전달
    upstream_request_headers = dict(_BROWSER_HEADERS)
    range_header = request.headers.get("Range")
    if range_header:
        upstream_request_headers["Range"] = range_header

    req = urllib.request.Request(url, headers=upstream_request_headers)

    try:
        upstream = urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT)
    except urllib.error.HTTPError as e:
        raise HTTPException(502, f"금감원 서버 응답 오류: HTTP {e.code}")
    except urllib.error.URLError as e:
        raise HTTPException(502, f"금감원 서버 연결 실패: {e.reason}")

    # upstream이 Range 응답을 줬는지 확인 (status 206)
    upstream_status = upstream.status
    is_partial = upstream_status == 206

    upstream_headers = upstream.headers
    upstream_content_type = (upstream_headers.get("Content-Type") or "application/octet-stream").split(";")[0].strip().lower()
    content_length = upstream_headers.get("Content-Length")
    filename = _parse_filename(upstream_headers.get("Content-Disposition") or "") or f"fss-{atchFileId}"

    # === Content-Type 재작성 ===
    # 금감원은 application/octet-stream으로 보내는 경우가 많아서
    # Chrome이 PDF를 다운로드로 처리해버림. 파일명 확장자 기반으로 실제 타입을 덮어씀.
    category = MIME_CATEGORY.get(upstream_content_type, "unknown")
    if category == "unknown":
        category = _guess_category_from_filename(filename)

    category_to_mime = {
        "pdf": "application/pdf",
        "image": None,       # 이미지는 확장자별로 다르므로 아래에서 처리
        "video": None,       # 마찬가지
        "audio": None,
    }
    # 이미지/영상/오디오는 파일명 확장자로 세분화
    ext_to_mime = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
        ".gif": "image/gif", ".webp": "image/webp",
        ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".m4v": "video/mp4",
        ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".m4a": "audio/mp4",
        ".pdf": "application/pdf",
    }

    final_content_type = None
    if category in category_to_mime and category_to_mime[category]:
        final_content_type = category_to_mime[category]
    else:
        # 파일명 확장자로 결정
        fname_lower = filename.lower()
        for ext, mime in ext_to_mime.items():
            if fname_lower.endswith(ext):
                final_content_type = mime
                break

    # 모두 실패하면 원본 그대로
    if not final_content_type:
        final_content_type = upstream_content_type or "application/octet-stream"

    # === Disposition 결정 ===
    # disposition=inline 요청이어도 HWP/Office처럼 브라우저가 못 여는 형식은 attachment로
    effective_disposition = disposition
    if disposition == "inline" and category in ("hwp", "office", "archive", "unknown"):
        effective_disposition = "attachment"

    # 사이즈 제한 (Range 요청은 일부만 받으므로 검사 우회 - 전체 파일은 어차피 같은 크기)
    if content_length and not is_partial:
        try:
            if int(content_length) > MAX_FILE_SIZE:
                upstream.close()
                raise HTTPException(413, "파일이 너무 큽니다 (50MB 제한)")
        except ValueError:
            pass

    def iter_chunks():
        try:
            total = 0
            while True:
                chunk = upstream.read(CHUNK_SIZE)
                if not chunk:
                    break
                total += len(chunk)
                # Range 응답이면 사이즈 검사 안 함 (이미 일부분만 요청됨)
                if not is_partial and total > MAX_FILE_SIZE:
                    break
                yield chunk
        finally:
            upstream.close()

    # 파일명에 확장자 없으면 카테고리 기반으로 추가 (브라우저 힌트)
    if "." not in filename:
        ext_default = {
            "pdf": ".pdf", "image": ".jpg", "video": ".mp4", "audio": ".mp3",
            "hwp": ".hwp",
        }.get(category, "")
        if ext_default:
            filename = filename + ext_default

    # 한글 파일명 안전하게 인코딩 (RFC 5987)
    safe_filename = urllib.parse.quote(filename, safe="")

    headers = {
        "Content-Disposition": f"{effective_disposition}; filename*=UTF-8''{safe_filename}",
        "X-Content-Type-Options": "nosniff",  # Chrome이 재추측 못 하도록
        "Cache-Control": "public, max-age=3600",
        # 이미지/영상은 cross-origin 태그에서도 쓸 수 있도록
        "Access-Control-Allow-Origin": "*",
        # Range 요청 지원 명시 (오디오/비디오 시킹 필수)
        "Accept-Ranges": "bytes",
    }
    # upstream에서 Content-Range 받았으면 그대로 전달 (Partial Content 응답 시)
    upstream_content_range = upstream_headers.get("Content-Range")
    if upstream_content_range:
        headers["Content-Range"] = upstream_content_range

    # Content-Length는 upstream 값이 정확할 때만 전달 (스트리밍 중 잘라먹는 경우 틀릴 수 있음)
    if content_length:
        try:
            n = int(content_length)
            if n <= MAX_FILE_SIZE:
                headers["Content-Length"] = str(n)
        except ValueError:
            pass

    # 206 Partial Content vs 200 OK
    status_code = 206 if is_partial else 200

    # media_type 파라미터가 Content-Type 헤더를 자동 세팅하므로 헤더 dict에는 넣지 않음
    return StreamingResponse(
        iter_chunks(),
        status_code=status_code,
        media_type=final_content_type,
        headers=headers,
    )


@router.delete("/fss-file/meta/cache")
async def clear_meta_cache():
    """메타 캐시 전체 초기화 (개발용)"""
    count = len(_meta_cache)
    _meta_cache.clear()
    return {"ok": True, "cleared": count}
