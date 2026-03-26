#!/usr/bin/env python3
"""Run process_all_pdfs directly on already-crawled PDFs."""
import json
from pathlib import Path

# Load crawled PDFs
pdfs_path = Path("storage/crawl_pdfs.json")
with open(pdfs_path) as f:
    pdfs = json.load(f)

print(f"Loaded {len(pdfs)} PDFs from {pdfs_path}")
cities = {}
for p in pdfs:
    c = p.get("city", "?")
    cities[c] = cities.get(c, 0) + 1
print(f"Cities: {cities}")

# Run the batch processor
from agents.signal_extractor import process_all_pdfs
result = process_all_pdfs(json.dumps(pdfs), year=2026)
print(result)
