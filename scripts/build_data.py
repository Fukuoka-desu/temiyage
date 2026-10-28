#!/usr/bin/env python3
"""temiyage_master.csv -> src/data/items.json (値は変えずに型だけ整える)"""
import csv, json, os, re, sys
SRC = sys.argv[1] if len(sys.argv) > 1 else "/workspace/temiyage/temiyage_master.csv"
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "data", "items.json")
rows = list(csv.DictReader(open(SRC, encoding="utf-8-sig")))
items = []
for i, r in enumerate(rows):
    price = r["税込価格(円)"].strip()
    days = r["日持ち(日)"].strip()
    store = r["要冷蔵/冷凍"].strip()
    s = ""
    if re.match(r"^(要)?冷凍", store):
        s = "冷凍"
    elif re.match(r"^(要)?冷蔵|^そば:冷蔵", store):
        s = "要冷蔵"
    elif re.search(r"クール便|冷蔵便|冷蔵配送|暑い地域は冷蔵", store):
        s = "夏季クール便"
    tags = [t for t in r["好みタグ"].split(",") if t]
    items.append({
        "id": i + 1,
        "r": r["地方"], "p": r["都道府県"], "n": r["品名"], "q": r["内容量"], "m": r["メーカー"],
        "y": int(price) if price else None,
        "d": int(float(days)) if days else None,
        "dr": r["日持ち(原文)"],
        "st": s, "sr": store,
        "ko": r["個包装"] == "有" or "個包装" in tags,
        "g": r["ジャンル"], "t": tags,
        "u": r["出典URL"], "src": r["出典の種類"], "c": r["確認日"],
        "v": r["判定"] == "確認済み", "vr": r["検査結果"],
    })
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(items, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
print(len(items), "items,", sum(x["v"] for x in items), "verified ->", OUT)
