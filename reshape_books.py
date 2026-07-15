# Reshaper: Best Books Ever (raw) -> CAP seed CSVs
#
# Produces two linked CSVs matching the Library schema:
#   db/data/smart.library-Authors.csv
#   db/data/smart.library-Books.csv
#
# Handles the real dataset's quirks:
#   - author strings with "(Illustrator)" noise + whitespace
#   - genres as list-like strings  "['Fantasy', 'Fiction']"
#   - missing price (73% complete)  -> sensible default
#   - publishDate mm/dd/yyyy         -> CAP Date  YYYY-MM-DD
#   - missing cover / description    -> blank (optional fields)
#   - duplicate author names         -> deduped to one Author row + shared FK
# ─────────────────────────────────────────────────────────────
import pandas as pd, uuid, re, random, sys

RAW = sys.argv[1] if len(sys.argv) > 1 else "synthetic_bbe.csv"
TOP_N = int(sys.argv[2]) if len(sys.argv) > 2 else 1000

df = pd.read_csv(RAW)

# 1) Slice to top-N by bbeScore (most famous books first)
df = df.sort_values("bbeScore", ascending=False).head(TOP_N).reset_index(drop=True)

# ── helpers ──
def clean_author(a):
    if not isinstance(a, str) or not a.strip():
        return "Unknown Author"
    # take part before first comma (drops ", Mary GrandPré (Illustrator)")
    name = a.split(",")[0]
    # strip any "(...)" noise + whitespace
    name = re.sub(r"\(.*?\)", "", name).strip()
    return name or "Unknown Author"

def first_genre(g):
    if not isinstance(g, str):
        return "General"
    m = re.findall(r"'([^']+)'", g)   # pull first quoted token from list-like string
    return m[0] if m else "General"

def to_iso_date(d):
    if not isinstance(d, str) or not d.strip():
        return ""              # leave blank -> CAP stores null
    try:
        return pd.to_datetime(d, format="%m/%d/%Y").strftime("%Y-%m-%d")
    except Exception:
        try:
            return pd.to_datetime(d).strftime("%Y-%m-%d")
        except Exception:
            return ""

def clean_price(p):
    try:
        v = float(p)
        if v > 0: return round(v, 2)
    except Exception:
        pass
    return round(random.uniform(4.99, 39.99), 2)   # default for missing (73% complete)

# 2) Build unique Authors table with UUIDs
df["author_name"] = df["author"].apply(clean_author)
unique_authors = sorted(df["author_name"].unique())
author_id = {name: str(uuid.uuid4()) for name in unique_authors}

authors_rows = []
for i, name in enumerate(unique_authors, start=1):
    authors_rows.append({
        "ID": author_id[name],
        "name": name,
        "country": "",                        # unknown -> blank
        "businessId": f"BIZ-BBE-{i:04d}",     # unique, satisfies @unique constraint
    })
authors_df = pd.DataFrame(authors_rows)

# 3) Build Books table with FK to author + cleaned fields
books_rows = []
for _, r in df.iterrows():
    books_rows.append({
        "ID": str(uuid.uuid4()),
        "title": str(r["title"])[:150],                       # respect String(150)
        "author_ID": author_id[r["author_name"]],             # the FK linkage
        "price": clean_price(r.get("price")),
        "stock": random.randint(0, 60),                       # synthetic stock
        "genre": first_genre(r.get("genres"))[:50],
        "status": "AVAILABLE",
        "description": ("" if pd.isna(r.get("description")) else str(r.get("description")))[:5000],
        "publishedAt": to_iso_date(r.get("publishDate")),
        "coverImageUrl": ("" if pd.isna(r.get("coverImg")) else str(r.get("coverImg")))[:500],
        "isActive": "true",
    })
books_df = pd.DataFrame(books_rows)

authors_df.to_csv("out_smart.library-Authors.csv", index=False)
books_df.to_csv("out_smart.library-Books.csv", index=False)

print(f"✅ Authors: {len(authors_df)} unique")
print(f"✅ Books:   {len(books_df)}")
print("\n── Authors sample ──")
print(authors_df.head(4).to_string())
print("\n── Books sample (key cols) ──")
print(books_df[["title","author_ID","price","genre","publishedAt","coverImageUrl"]].head(5).to_string())
# integrity check: every book's author_ID exists in authors table
missing = set(books_df["author_ID"]) - set(authors_df["ID"])
print("\nFK integrity — orphan author_IDs:", len(missing), "(must be 0)")
