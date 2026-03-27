# Meridian — 5-Minute Demo Script

Target audience: NationGraph team
Format: Screen recording with voiceover
Have the app running at localhost:3000 with backend at localhost:8000

---

## [0:00 - 0:30] THE HOOK — Start on Dashboard

> "This is Meridian — a procurement intelligence platform that tells you what Canadian municipalities are about to buy, before the RFP drops."
>
> "Right now we're tracking 18 municipalities across the GTA. We've extracted over 12,800 intelligence signals from 355 council documents — budget reports, meeting minutes, committee agendas — and we've identified a $9.5 billion procurement pipeline for 2026."

**ACTION:** Show the dashboard. Point to the KPI cards (12,800+ signals, 495 bids, 500+ meetings, 18 municipalities).

---

## [0:30 - 1:15] THE DAILY LEADS — Show Immediate Value

> "Every day, the platform surfaces the highest-scoring leads. These are signals where our AI has high confidence that a procurement opportunity is imminent."

**ACTION:** Scroll through the Daily Leads carousel slowly.

> "Here's one — Brampton has allocated $2.6 million for an arts and culture hub. Score: 0.98. The budget is allocated, specs are being written. A vendor who sees this today has a 3-6 month head start before the RFP hits the street."

**ACTION:** Point to one high-value lead card. Highlight the score, the category, the procurement stage, and the 'Why it matters' section.

> "Here's another — Georgina just directed staff to issue an REOI for their Beach Vendor Program. Score: 0.99. That's not a prediction — that's a council directive we extracted from last week's meeting minutes."

---

## [1:15 - 2:00] THE PIPELINE — Show Intelligence Depth

> "This isn't just a list of bids. We map every signal to a procurement lifecycle stage."

**ACTION:** Point to the Procurement Pipeline visualization.

> "You can see the heaviest concentration is in 'Specification Development' and 'Budget Allocated' — these are the stages where vendors have the most influence. 236 signals in spec development means 236 opportunities where requirements are still being written."
>
> "The hot stages — RFP Imminent and RFP Published — light up in orange. Right now we have 14 signals in those stages. These are deals that are about to go live."

---

## [2:00 - 2:45] THE CITY DRILL-DOWN — Show Depth Per Municipality

> "Let's drill into Brampton — the most active municipality in our system."

**ACTION:** Click on Brampton in the Top Cities section. Navigate to the Account Detail page.

> "Brampton has 57 bids tracked, 10 currently open, and 184 intelligence signals. Their average signal score is among the highest — meaning they're actively procuring."
>
> "Look at the signals tab — $1.5 billion in capital projects, a $1.1 billion hospital and cancer centre, electrical transit components, park maintenance tenders. We even extract the purchasing representative contacts from bid documents."

**ACTION:** Click through the Signals tab, then the Bids tab, then briefly show Contacts.

---

## [2:45 - 3:30] THE BIDS EXPLORER — Show Operational Use

> "For teams that want to respond to active bids right now, we have a full bid explorer."

**ACTION:** Navigate to the Bids page.

> "152 open bids across 17 cities. I can filter by city, by status, by year."

**ACTION:** Filter to Mississauga, then to Open status. Show results.

> "Mississauga alone has 25 open bids — infrastructure, consulting, supply contracts. Each one links directly to the bid portal. A business development team could start their morning here, every day."

---

## [3:30 - 4:15] THE SIGNALS EXPLORER — Show AI Capability

> "The real magic is the signal extraction engine. We process council PDFs through an AI pipeline that identifies 15 categories of procurement intelligence."

**ACTION:** Navigate to the Signals page.

> "Budget signals, timing signals, scope signals, decision-maker changes, infrastructure needs, technology initiatives. Each signal has a confidence score and a relevance score computed from a weighted formula."

**ACTION:** Adjust the confidence slider up to 0.80. Show the filtered results.

> "When I set confidence to 80%, I'm seeing only the signals our AI is most certain about. These aren't guesses — they're extracted from official council documents with specific dollar amounts, dates, and named officials."

---

## [4:15 - 4:45] THE SCALE STORY — Year-over-Year Growth

> "We launched with 3 municipalities in 2025 — Mississauga, Vaughan, Markham. 3,000 signals, 160 bids."
>
> "In 2026, we've scaled to 18 municipalities, 12,800+ signals, 495 bids. That's a 4x increase in intelligence output."

**ACTION:** Toggle the year selector from FY 2026 to FY 2025 on the dashboard. Show the difference in numbers. Toggle back to 2026.

> "The architecture supports adding any Canadian municipality that uses standard procurement portals. The GTA alone has 25+ municipalities. Ontario has 444. The data compounds."

---

## [4:45 - 5:00] THE CLOSE

> "Meridian gives procurement teams a systematic advantage — they see what's coming before it's public. The combination of automated crawling, AI signal extraction, and a clean operational dashboard means a single BD team can monitor the entire GTA procurement landscape from one screen."
>
> "Thank you. I'm happy to dive deeper into any part of the system."

---

## BACKUP TALKING POINTS (if questions come up)

- **How does scoring work?** Category weight x confidence x procurement stage multiplier x richness bonus. Timing signals near RFP stage score highest.
- **How often does it update?** Crawlers can run daily. Meeting agendas are typically posted 3-5 days before council sessions.
- **What's the tech stack?** Python/FastAPI backend, Next.js frontend, Supabase PostgreSQL, Playwright crawlers, Grok LLM for signal extraction.
- **How accurate is the AI?** Average confidence across all signals is 0.75+. We filter dashboard leads at 0.8+ confidence.
- **What about Toronto?** Architecture supports it. Toronto uses a different portal format — it's on the roadmap.
- **Revenue model?** SaaS subscription for vendor teams. Tier by number of municipalities monitored or signals accessed.
