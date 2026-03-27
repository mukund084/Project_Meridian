import requests

for ep in [
    "/bids?limit=20&year=2026",
    "/signals?limit=10&min_score=0.5&year=2026",
    "/signals/stats?year=2026",
    "/meetings?limit=5&year=2026",
    "/pdf-documents?limit=200",
    "/signals/pipeline?year=2026",
    "/accounts?year=2026",
    "/cities?year=2026"
]:
    r = requests.get(f"http://localhost:8000{ep}")
    print(ep, r.status_code)
