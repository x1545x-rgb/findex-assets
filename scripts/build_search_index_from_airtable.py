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
FIELD_SLUG  = os.environ.get("FIELD_SLUG", "slug")

SITE_BASE_URL = os.environ.get("SITE_BASE_URL", "https://www.finde.space/article/")
MAX_LONG_CHARS = int(os.environ.get("MAX_LONG_CHARS", "8000"))
OUTPUT_PATH = os.environ.get("OUTPUT_PATH", "search-index.json")

# ===== Webflow =====
WEBFLOW_TOKEN = os.environ.get("WEBFLOW_TOKEN", "")
WEBFLOW_COLLECTION_ID = os.environ.get("WEBFLOW_COLLECTION_ID", "")
WEBFLOW_SLUG_FIELD = os.environ.get("WEBFLOW_SLUG_FIELD", "slug")
WEBFLOW_IMAGE_FIELD = os.environ.get("WEBFLOW_IMAGE_FIELD", "mainimage")

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
    # 画像フィールドが dict / list / 文字列 どれでもURLを抜く
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

def fetch_webflow_slug_to_image():
    # Webflow設定が来てなければスキップ（=ここが原因1の典型）
    if not (WEBFLOW_TOKEN and WEBFLOW_COLLECTION_ID):
        print("[webflow] SKIP: WEBFLOW_TOKEN or WEBFLOW_COLLECTION_ID missing")
        return {}, {}

    headers = {
        "Authorization": f"Bearer {WEBFLOW_TOKEN}",
        "Accept": "application/json",
    }

    slug_to_img = {}
    sample_field_keys = {}

    limit = 100
    offset = 0

    while True:
        url = f"https://api-cdn.webflow.com/v2/collections/{WEBFLOW_COLLECTION_ID}/items/live"
        params = {"limit": limit, "offset": offset}

        r = requests.get(url, headers=headers, params=params, timeout=30)
        r.raise_for_status()
        data = r.json()

        items = data.get("items", []) or []
        if items and not sample_field_keys:
            fd = (items[0].get("fieldData") or {})
            sample_field_keys = {k: type(v).__name__ for k, v in fd.items()}
            print("[webflow] sample fieldData keys:", list(fd.keys())[:30])
            print("[webflow] expecting slug key:", WEBFLOW_SLUG_FIELD, "image key:", WEBFLOW_IMAGE_FIELD)

        for it in items:
            field_data = it.get("fieldData", {}) or {}
            slug = stringify(field_data.get(WEBFLOW_SLUG_FIELD, "")).strip()
            img_val = field_data.get(WEBFLOW_IMAGE_FIELD)
            img_url = normalize_webflow_image(img_val)
            if slug:
                slug_to_img[slug] = img_url

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

    with_url = sum(1 for v in slug_to_img.values() if v)
    print(f"[webflow] items mapped: {len(slug_to_img)} slugs, with image_url: {with_url}")
    return slug_to_img, sample_field_keys

def main():
    airtable_records = fetch_all_airtable_records()
    slug_to_img, webflow_keys = fetch_webflow_slug_to_image()

    airtable_slugs = []
    items = []

    for rec in airtable_records:
        fields = rec.get("fields", {}) or {}

        title = clean_text(stringify(fields.get(FIELD_TITLE, "")))
        short = clean_text(stringify(fields.get(FIELD_SHORT, "")))
        long  = clean_text(stringify(fields.get(FIELD_LONG, "")))

        url = stringify(fields.get(FIELD_URL, "")).strip()
        slug = stringify(fields.get(FIELD_SLUG, "")).strip()

        if slug:
            airtable_slugs.append(slug)

        # Airtableのurlが外部URLでも、検索結果の遷移先はそれでOK
        # もし記事ページへ飛ばしたいならここを切り替える
        if not url and slug:
            url = SITE_BASE_URL.rstrip("/") + "/" + slug.lstrip("/")

        if MAX_LONG_CHARS and len(long) > MAX_LONG_CHARS:
            long = long[:MAX_LONG_CHARS]

        image_url = slug_to_img.get(slug, "") if slug else ""

        if not (title or short or long or url):
            continue

        items.append({
            "title": title,
            "description": short,
            "description_long": long,
            "url": url,
            "slug": slug,               # ★デバッグ用に出す
            "image_url": image_url      # ★ここにWebflow画像が入る想定
        })

    if slug_to_img:
        matched = sum(1 for s in airtable_slugs if s in slug_to_img)
        print(f"[join] airtable slugs: {len(airtable_slugs)} / matched with webflow: {matched}")
        if airtable_slugs[:5]:
            print("[join] sample airtable slugs:", airtable_slugs[:5])
        wf_samples = list(slug_to_img.keys())[:5]
        if wf_samples:
            print("[join] sample webflow slugs:", wf_samples)

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)

    print(f"[done] wrote {len(items)} items -> {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
