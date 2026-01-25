import os
import json
import re
import requests

# ===== Airtable =====
AIRTABLE_TOKEN = os.environ.get("AIRTABLE_TOKEN", "")
AIRTABLE_BASE_ID = os.environ.get("AIRTABLE_BASE_ID", "")
AIRTABLE_TABLE = os.environ.get("AIRTABLE_TABLE", "Articles")
AIRTABLE_VIEW = os.environ.get("AIRTABLE_VIEW", "")

FIELD_TITLE = os.environ.get("FIELD_TITLE", "title")
FIELD_SHORT = os.environ.get("FIELD_SHORT", "description")
FIELD_LONG  = os.environ.get("FIELD_LONG", "description_long")
FIELD_URL   = os.environ.get("FIELD_URL", "url")
FIELD_SLUG  = os.environ.get("FIELD_SLUG", "slug")  # 念のため残す

SITE_BASE_URL = os.environ.get("SITE_BASE_URL", "https://www.finde.space/article/")
MAX_LONG_CHARS = int(os.environ.get("MAX_LONG_CHARS", "8000"))
OUTPUT_PATH = os.environ.get("OUTPUT_PATH", "search-index.json")

# ===== Webflow =====
WEBFLOW_TOKEN = os.environ.get("WEBFLOW_TOKEN", "")
WEBFLOW_COLLECTION_ID = os.environ.get("WEBFLOW_COLLECTION_ID", "")
WEBFLOW_IMAGE_FIELD = os.environ.get("WEBFLOW_IMAGE_FIELD", "mainimage")

# ★ ここがポイント：結合キーを Airtable Record ID にする
WEBFLOW_JOIN_FIELD = os.environ.get("WEBFLOW_JOIN_FIELD", "airtable-record-id")

def clean_text(s: str) -> str:
    if s is None:
        return ""
    s = str(s)
    s = re.sub(r"<[^>]+>", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s

def stringify(v) -> str:
    if v is None:
        return ""
    if isinstance(v, list):
        return " ".join([str(x) for x in v])
    return str(v)

def fetch_all_airtable_records():
    if not (AIRTABLE_TOKEN and AIRTABLE_BASE_ID and AIRTABLE_TABLE):
        raise RuntimeError("Missing AIRTABLE_TOKEN / AIRTABLE_BASE_ID / AIRTABLE_TABLE")

    base_url = f"https://api.airtable.com/v0/{AIRTABLE_BASE_ID}/{requests.utils.quote(AIRTABLE_TABLE, safe='')}"
    headers = {"Authorization": f"Bearer {AIRTABLE_TOKEN}"}

    params = {"pageSize": 100}
    if AIRTABLE_VIEW:
        params["view"] = AIRTABLE_VIEW

    all_records = []
    offset = None
    while True:
        if offset:
            params["offset"] = offset
        r = requests.get(base_url, headers=headers, params=params, timeout=30)
        r.raise_for_status()
        data = r.json()
        all_records.extend(data.get("records", []))
        offset = data.get("offset")
        if not offset:
            break
    return all_records

def normalize_webflow_image(value):
    # Webflow image field が dict / list / 文字列でもURLを抜く
    if not value:
        return ""
    if isinstance(value, dict):
        return stringify(value.get("url", "")).strip()
    if isinstance(value, list) and len(value) > 0:
        first = value[0]
        if isinstance(first, dict):
            return stringify(first.get("url", "")).strip()
        return stringify(first).strip()
    return stringify(value).strip()

def fetch_webflow_join_to_image():
    if not (WEBFLOW_TOKEN and WEBFLOW_COLLECTION_ID):
        print("[webflow] SKIP: missing token or collection id")
        return {}

    headers = {
        "Authorization": f"Bearer {WEBFLOW_TOKEN}",
        "Accept": "application/json",
    }

    join_to_img = {}

    limit = 100
    offset = 0

    while True:
        url = f"https://api-cdn.webflow.com/v2/collections/{WEBFLOW_COLLECTION_ID}/items/live"
        params = {"limit": limit, "offset": offset}

        r = requests.get(url, headers=headers, params=params, timeout=30)
        r.raise_for_status()
        data = r.json()

        items = data.get("items", []) or []

        for it in items:
            field_data = it.get("fieldData", {}) or {}

            join_key = stringify(field_data.get(WEBFLOW_JOIN_FIELD, "")).strip()
            img_val = field_data.get(WEBFLOW_IMAGE_FIELD)
            img_url = normalize_webflow_image(img_val)

            if join_key:
                join_to_img[join_key] = img_url

        pagination = data.get("pagination") or {}
        total = pagination.get("total")
        got = len(items)

        if total is not None:
            offset += got
            if offset >= int(total) or got == 0:
                break
        else:
            offset += got
            if got < limit:
                break

    with_url = sum(1 for v in join_to_img.values() if v)
    print(f"[webflow] mapped: {len(join_to_img)} join_keys, with image_url: {with_url}")
    return join_to_img

def main():
    airtable_records = fetch_all_airtable_records()
    join_to_img = fetch_webflow_join_to_image()

    items = []
    matched = 0

    for rec in airtable_records:
        fields = rec.get("fields", {}) or {}

        title = clean_text(stringify(fields.get(FIELD_TITLE, "")))
        short = clean_text(stringify(fields.get(FIELD_SHORT, "")))
        long  = clean_text(stringify(fields.get(FIELD_LONG, "")))

        url = stringify(fields.get(FIELD_URL, "")).strip()
        slug = stringify(fields.get(FIELD_SLUG, "")).strip()

        if not url and slug:
            url = SITE_BASE_URL.rstrip("/") + "/" + slug.lstrip("/")

        if MAX_LONG_CHARS and len(long) > MAX_LONG_CHARS:
            long = long[:MAX_LONG_CHARS]

        # ★ AirtableのレコードIDで結合
        airtable_rec_id = rec.get("id", "")
        image_url = join_to_img.get(airtable_rec_id, "")

        if image_url:
            matched += 1

        if not (title or short or long or url):
            continue

        items.append({
            "title": title,
            "description": short,
            "description_long": long,
            "url": url,
            "slug": slug,                 # デバッグ用（不要なら消してOK）
            "airtable_record_id": airtable_rec_id,  # デバッグ用（不要なら消してOK）
            "image_url": image_url
        })

    print(f"[join] matched images: {matched} / {len(items)}")
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
    print(f"[done] wrote {len(items)} items -> {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
