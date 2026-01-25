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

# ===== Webflow =====
WEBFLOW_TOKEN = os.environ.get("WEBFLOW_TOKEN", "")
WEBFLOW_COLLECTION_ID = os.environ.get("WEBFLOW_COLLECTION_ID", "")
WEBFLOW_SLUG_FIELD = os.environ.get("WEBFLOW_SLUG_FIELD", "slug")
WEBFLOW_IMAGE_FIELD = os.environ.get("WEBFLOW_IMAGE_FIELD", "mainimage")

OUTPUT_PATH = os.environ.get("OUTPUT_PATH", "search-index.json")
SITE_BASE_URL = os.environ.get("SITE_BASE_URL", "https://www.finde.space/article/")
MAX_LONG_CHARS = int(os.environ.get("MAX_LONG_CHARS", "8000"))

def clean_text(s: str) -> str:
    if s is None:
        return ""
    s = str(s)
    s = re.sub(r"<[^>]+>", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s

def get_field(fields: dict, name: str):
    v = fields.get(name, "")
    return v

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
    """
    Webflow image field が
      - {"url": "..."} のdict
      - [{"url":"..."}] のlist
    どちらでもURLを取る
    """
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
    """
    Webflowの公開（live）アイテムから slug->image_url を作る。
    Content Delivery API: api-cdn.webflow.com
    ページングは、レスポンス内の pagination/total 等が環境で違うことがあるので両対応。
    """
    if not (WEBFLOW_TOKEN and WEBFLOW_COLLECTION_ID):
        return {}

    headers = {
        "Authorization": f"Bearer {WEBFLOW_TOKEN}",
        "Accept": "application/json",
    }

    slug_to_img = {}

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
            slug = stringify(field_data.get(WEBFLOW_SLUG_FIELD, "")).strip()
            img_val = field_data.get(WEBFLOW_IMAGE_FIELD)
            img_url = normalize_webflow_image(img_val)

            if slug:
                slug_to_img[slug] = img_url

        # ページング判定（いろんな形に対応）
        pagination = data.get("pagination") or {}
        total = pagination.get("total")
        got = len(items)

        if total is not None:
            # pagination.total がある場合
            offset += got
            if offset >= int(total) or got == 0:
                break
        else:
            # totalが無い場合は「itemsがlimit未満なら最後」とみなす
            offset += got
            if got < limit:
                break

    return slug_to_img

def main():
    airtable_records = fetch_all_airtable_records()
    slug_to_img = fetch_webflow_slug_to_image()

    items = []
    for rec in airtable_records:
        fields = rec.get("fields", {}) or {}

        title = clean_text(stringify(get_field(fields, FIELD_TITLE)))
        short = clean_text(stringify(get_field(fields, FIELD_SHORT)))
        long  = clean_text(stringify(get_field(fields, FIELD_LONG)))

        url = stringify(get_field(fields, FIELD_URL)).strip()
        slug = stringify(get_field(fields, FIELD_SLUG)).strip()

        if not url and slug:
            url = SITE_BASE_URL.rstrip("/") + "/" + slug.lstrip("/")

        if MAX_LONG_CHARS and len(long) > MAX_LONG_CHARS:
            long = long[:MAX_LONG_CHARS]

        image_url = slug_to_img.get(slug, "") if slug else ""

        if not (title or short or long or url):
            continue

        # description を正にしつつ、既存JS互換で descriotion も残す（任意）
        items.append({
            "title": title,
            "description": short,
            "descriotion": short,  # 互換用：不要なら消してOK
            "description_long": long,
            "url": url,
            "image_url": image_url
        })

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)

    print(f"Wrote {len(items)} items -> {OUTPUT_PATH}")
    print(f"Webflow images mapped: {len([k for k,v in slug_to_img.items() if v])} with URL")

if __name__ == "__main__":
    main()
