import os
import json
import re
import requests

AIRTABLE_TOKEN = os.environ.get("AIRTABLE_TOKEN", "")
AIRTABLE_BASE_ID = os.environ.get("AIRTABLE_BASE_ID", "")
AIRTABLE_TABLE = os.environ.get("AIRTABLE_TABLE", "Articles")
AIRTABLE_VIEW = os.environ.get("AIRTABLE_VIEW", "")  # 任意: view名
OUTPUT_PATH = os.environ.get("OUTPUT_PATH", "search-index.json")
SITE_BASE_URL = os.environ.get("SITE_BASE_URL", "https://www.finde.space/article/")

# Airtableのフィールド名（あなたの実フィールドに合わせて後で調整）
FIELD_TITLE = os.environ.get("FIELD_TITLE", "title")
FIELD_SHORT = os.environ.get("FIELD_SHORT", "descriotion")  # typoのままでもOK
FIELD_LONG = os.environ.get("FIELD_LONG", "description_long")
FIELD_URL = os.environ.get("FIELD_URL", "url")
FIELD_SLUG = os.environ.get("FIELD_SLUG", "slug")

MAX_LONG_CHARS = int(os.environ.get("MAX_LONG_CHARS", "8000"))

def clean_text(s: str) -> str:
    if s is None:
        return ""
    s = str(s)
    s = re.sub(r"<[^>]+>", " ", s)        # 雑にHTML除去
    s = re.sub(r"\s+", " ", s).strip()    # 空白圧縮
    return s

def get_field(fields: dict, name: str) -> str:
    # Airtableは空だとキー自体が無いことがある
    v = fields.get(name, "")
    if isinstance(v, list):
        # multi-select等はlistになることがある
        return " ".join([str(x) for x in v])
    return str(v) if v is not None else ""

def fetch_all_records():
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

        recs = data.get("records", [])
        all_records.extend(recs)

        offset = data.get("offset")
        if not offset:
            break

    return all_records

def main():
    records = fetch_all_records()

    items = []
    for rec in records:
        fields = rec.get("fields", {})

        title = clean_text(get_field(fields, FIELD_TITLE))
        short = clean_text(get_field(fields, FIELD_SHORT))
        long = clean_text(get_field(fields, FIELD_LONG))
        url = get_field(fields, FIELD_URL).strip()
        slug = get_field(fields, FIELD_SLUG).strip()

        if not url and slug:
            url = SITE_BASE_URL.rstrip("/") + "/" + slug.lstrip("/")

        if MAX_LONG_CHARS and len(long) > MAX_LONG_CHARS:
            long = long[:MAX_LONG_CHARS]

        # 空レコード除外
        if not (title or short or long or url):
            continue

        items.append({
            "title": title,
            # 現状のJSONに合わせてtypoキーでも出す（JS側も対応済み）
            "descriotion": short,
            "description_long": long,
            "url": url
        })

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)

    print(f"Wrote {len(items)} items -> {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
