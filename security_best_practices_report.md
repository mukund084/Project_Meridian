# Security Best Practices Review

## Executive Summary

This codebase has a generally good baseline for secret hygiene in source control: `.env*` files are ignored, the frontend only uses a public API base URL, and I did not find obvious DOM XSS sinks such as `dangerouslySetInnerHTML`, `innerHTML`, `eval`, or client-side secret exposure.

The highest-risk issues are in the crawler/extractor pipeline. Untrusted document URLs scraped from third-party sites are accepted and fetched with redirect following, while TLS certificate verification is globally disabled. That combination creates a meaningful SSRF and document-integrity risk for any environment that runs the crawlers. On the API side, the service is read-only, but it still ships with production-hardening gaps: OpenAPI docs stay enabled by default, host-header validation is opt-in, and several public endpoints can trigger full-table reads with no visible rate limiting.

## High Severity

### 1. Arbitrary external PDF URLs can reach the downloader without host validation

- Rule ID: `CRAWLER-URL-001`
- Severity: High
- Location:
  - `crawlers/meetings.py:90-119`
  - `extractors/pdf_extractor.py:74-103`
- Evidence:
  - The meetings crawler collects any link matching `a.link[href*='FileStream.ashx']`.
  - If the scraped `href` is already absolute, it is stored unchanged: `pdf_url=... if not href.startswith("http") else href`.
  - The downloader later fetches whatever URL it receives with `httpx.AsyncClient(..., follow_redirects=True)`.
- Impact:
  - A compromised or poisoned source page can hand the crawler an arbitrary absolute URL.
  - Because redirects are followed and redirect targets are not revalidated, a nominally allowed municipal URL can bounce to an attacker-controlled host or an internal network target.
  - In a cloud or VPN-connected environment, this can become SSRF against internal services or metadata endpoints.
- Fix:
  - Parse and validate every scraped PDF URL before persisting or fetching it.
  - Require `https`.
  - Restrict hosts to an explicit allowlist such as known `*.escribemeetings.com`, approved municipal domains, and any other supported portals.
  - Revalidate each redirect target before following it, or disable cross-host redirects entirely.
  - Resolve DNS and reject private, loopback, link-local, and reserved IP destinations.
- Mitigation:
  - Run crawler workers in a network-restricted environment with no access to instance metadata or internal admin services.
- False positive notes:
  - If crawler infrastructure already blocks access to internal networks at the egress layer, the SSRF blast radius is reduced, but the application should still validate URLs itself.

### 2. TLS certificate validation is disabled for all PDF downloads

- Rule ID: `CRAWLER-TLS-001`
- Severity: High
- Location: `extractors/pdf_extractor.py:89-90`
- Evidence:
  - `httpx.AsyncClient(..., verify=False)`
- Impact:
  - Any attacker who can tamper with traffic between the crawler and the remote site can swap documents, inject malicious PDFs, or redirect the crawler to attacker-controlled content.
  - This is especially risky here because the pipeline treats downloaded documents as trusted enough to extract, analyze with an LLM, and persist back into Supabase.
- Fix:
  - Remove `verify=False` and use normal certificate verification.
  - If a small number of legacy hosts have broken TLS, handle them with explicit, per-host exceptions and clear logging rather than a global disable.
- Mitigation:
  - Pin trusted CA bundles or place a validating outbound proxy in front of crawler traffic.
- False positive notes:
  - None. This is an explicit insecure transport setting in code.

## Medium Severity

### 3. Public API docs are enabled by default in production

- Rule ID: `FASTAPI-OPENAPI-001`
- Severity: Medium
- Location: `api.py:17-21`
- Evidence:
  - The app is created with `FastAPI(...)` and does not override `docs_url`, `redoc_url`, or `openapi_url`.
  - Inference: FastAPI defaults mean `/docs`, `/redoc`, and `/openapi.json` remain exposed unless disabled elsewhere.
- Impact:
  - Public interactive docs make endpoint discovery and abuse automation easier.
  - This is not authentication bypass by itself, but it increases attacker reconnaissance value.
- Fix:
  - Gate docs behind an environment flag.
  - In production, set `docs_url=None`, `redoc_url=None`, and `openapi_url=None`, or protect them with auth / network restrictions.
- Mitigation:
  - If docs must stay on, keep them behind an internal-only route or reverse-proxy allowlist.
- False positive notes:
  - If production infrastructure already blocks these routes, verify and document that behavior.

### 4. Several unauthenticated endpoints can trigger full-table reads with no visible abuse controls

- Rule ID: `API-ABUSE-001`
- Severity: Medium
- Location:
  - `api.py:115-145`
  - `api.py:176-197`
  - `api.py:292-344`
  - `api.py:425-497`
  - `api.py:624-663`
- Evidence:
  - `fetch_all()` paginates until the whole result set is read into memory.
  - Public endpoints such as `/bids/stats`, `/signals/pipeline`, `/accounts`, and `/bids/closing-soon` call `fetch_all()` on entire tables.
  - I did not find any rate-limiting middleware or request-budget enforcement in the app code.
- Impact:
  - A public client can repeatedly force large DB reads and server-side aggregation work.
  - This increases the risk of cost spikes, DB load amplification, and denial-of-service through cheap repeated requests.
- Fix:
  - Add rate limiting at the edge or app layer.
  - Precompute expensive aggregates on a schedule or cache them in a bounded shared store.
  - Impose stricter query budgets and data caps for expensive endpoints.
- Mitigation:
  - Put the API behind a reverse proxy or CDN with per-IP throttling and cache rules.
- False positive notes:
  - If rate limiting already exists in the reverse proxy or hosting platform, verify it and document it.

### 5. Host-header validation is optional instead of secure-by-default

- Rule ID: `FASTAPI-HOST-001`
- Severity: Medium
- Location:
  - `api.py:35`
  - `api.py:99-100`
  - `.env.example:11-12`
- Evidence:
  - `ALLOWED_HOSTS` defaults to an empty list.
  - `TrustedHostMiddleware` is only enabled when `ALLOWED_HOSTS` is provided.
  - The sample environment calls this "Optional hardening".
- Impact:
  - A deployment that forgets to set `ALLOWED_HOSTS` accepts arbitrary `Host` headers.
  - Even if the current routes do not build absolute URLs, this becomes dangerous quickly when future features, caches, proxies, logging, or redirects start trusting the host header.
- Fix:
  - Fail closed in production if `ALLOWED_HOSTS` is unset.
  - Treat host allowlisting as a required deployment setting, not an optional hardening toggle.
- Mitigation:
  - Normalize and validate `Host` at the reverse proxy even if the app also checks it.
- False positive notes:
  - If a reverse proxy always rewrites `Host` to a fixed trusted value, the immediate risk is lower, but the app should still defend itself.

## Low Severity / Defense in Depth

### 6. No frontend security header policy is visible in repo code

- Rule ID: `NEXT-HEADERS-001`
- Severity: Low
- Location:
  - `frontend/next.config.ts:1-7`
  - `frontend/src/app/layout.tsx:15-44`
- Evidence:
  - `next.config.ts` is effectively empty.
  - I did not find app-level CSP, `frame-ancestors`, or other frontend security-header configuration in the Next.js app.
- Impact:
  - If the frontend is deployed without edge-managed headers, it will miss an important XSS and clickjacking defense layer.
- Fix:
  - Add a baseline CSP and related headers either in Next.js config/middleware or at the hosting edge.
- Mitigation:
  - If a CDN or platform already injects these headers, document that so the protection is visible during review.
- False positive notes:
  - This may already be handled outside the repo. I could not verify runtime headers from code alone.

## Positive Findings

- `.env*` files are ignored in both the backend and frontend gitignore files, with `.env.example` intentionally kept.
- I did not find `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, `document.write`, `localStorage`, or `sessionStorage` usage in `frontend/src`.
- The API does set some baseline headers on backend responses: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy`.
- The frontend uses `rel="noopener noreferrer"` on `target="_blank"` links that I checked.

## Recommended Secure-by-Default Improvements

1. Lock down outbound crawling.
   Validate schemes, domains, redirects, and resolved IPs before any fetch.

2. Re-enable TLS verification globally.
   Handle broken remote endpoints with explicit exceptions instead of `verify=False`.

3. Harden production startup defaults.
   Disable FastAPI docs by default in production and require `ALLOWED_HOSTS`.

4. Add abuse protections for public read endpoints.
   Put the API behind rate limiting and avoid recomputing large aggregates on demand.

5. Make frontend security headers visible in code or deployment docs.
   A baseline CSP plus clickjacking defenses should be documented somewhere reviewers can see.

## Verification Gaps

- I could not verify Supabase Row Level Security or database grants from this repository alone.
- I could not verify edge-layer protections such as rate limiting, WAF rules, or frontend response headers from this repository alone.
- I did not run an external dependency vulnerability scan because that would require network/package-advisory access beyond what is visible in the source tree.
