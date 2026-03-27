const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "") || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY || "";
const USE_SUPABASE_DIRECT = Boolean(SUPABASE_URL && SUPABASE_KEY);

const BID_PUBLIC_COLUMNS = [
  "bid_name",
  "bid_status",
  "bid_closing_date",
  "bid_url",
  "city",
  "year",
  "days_left",
  "bid_classification",
  "bid_type",
  "bid_number",
  "published_date",
  "description",
  "categories",
  "purchasing_representive",
  "bids_submitted",
  "plan_takers",
].join(",");

const MEETING_PUBLIC_COLUMNS = [
  "meeting_title",
  "meeting_date",
  "document_type",
  "pdf_url",
  "city",
  "year",
].join(",");

const SIGNAL_PUBLIC_COLUMNS = [
  "source_type",
  "source_url",
  "city",
  "signal_type",
  "signal_category",
  "confidence",
  "score",
  "summary",
  "raw_excerpt",
  "estimated_value",
  "estimated_timeline",
  "procurement_stage",
  "extracted_at",
  "year",
].join(",");

const PDF_PUBLIC_COLUMNS = [
  "source_url",
  "city",
  "source_type",
  "status",
  "page_count",
  "signals_extracted",
  "created_at",
  "year",
].join(",");

const SIGNAL_STAGE_ORDER = [
  "needs_identified",
  "study_authorized",
  "budget_allocated",
  "market_research",
  "specification_development",
  "rfp_imminent",
  "rfp_published",
  "evaluation_in_progress",
  "shortlisted",
  "negotiation",
  "awarded",
  "contract_execution",
  "in_progress",
  "closeout",
] as const;

const aggregateCache = new Map<string, Promise<unknown>>();

async function fetcher<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function supabaseFetcher<T>(table: string, params: URLSearchParams): Promise<T> {
  if (!USE_SUPABASE_DIRECT) {
    throw new Error("Supabase env vars are not configured");
  }

  const url = new URL(`/rest/v1/${table}`, SUPABASE_URL);
  params.forEach((value, key) => {
    url.searchParams.append(key, value);
  });

  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!res.ok) {
    let message = `Supabase error: ${res.status}`;
    try {
      const payload = await res.json();
      if (typeof payload?.message === "string") {
        message = payload.message;
      }
    } catch {
      // Ignore JSON parse failures and keep the status-based message.
    }
    throw new Error(message);
  }

  return res.json();
}

async function supabaseFetchAll<T>(
  table: string,
  buildParams: (params: URLSearchParams, offset: number, limit: number) => void,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;

  while (true) {
    const params = new URLSearchParams();
    buildParams(params, offset, pageSize);
    const page = await supabaseFetcher<T[]>(table, params);
    rows.push(...page);
    if (page.length < pageSize) {
      break;
    }
    offset += page.length;
  }

  return rows;
}

function addEq(params: URLSearchParams, key: string, value: string | number | undefined) {
  if (value !== undefined && value !== "") {
    params.set(key, `eq.${value}`);
  }
}

function addGte(params: URLSearchParams, key: string, value: number | undefined) {
  if (value !== undefined && value > 0) {
    params.set(key, `gte.${value}`);
  }
}

function addILike(params: URLSearchParams, key: string, value: string) {
  const trimmed = value.trim();
  if (trimmed) {
    params.set(key, `ilike.%${trimmed}%`);
  }
}

function round(value: number, decimals = 3) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function cachedPromise<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const existing = aggregateCache.get(key) as Promise<T> | undefined;
  if (existing) {
    return existing;
  }

  const pending = loader().catch((error) => {
    aggregateCache.delete(key);
    throw error;
  });

  aggregateCache.set(key, pending);
  return pending;
}

function parseBidDate(raw: string): Date | null {
  if (!raw) return null;

  const cleaned = raw
    .replace(/\(.*?\)/g, "")
    .replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+/i, "")
    .trim();

  const normalized = cleaned
    .replace(
      /^([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})\s+(\d{1,2}:\d{2})(?::(\d{2}))?\s+([AP]M)$/i,
      (_match, datePart: string, timePart: string, secondsPart: string | undefined, meridiem: string) =>
        `${datePart} ${timePart}${secondsPart ? `:${secondsPart}` : ":00"} ${meridiem.toUpperCase()}`,
    )
    .replace(/^([A-Za-z]{3}\s+\d{1,2},\s+\d{4})$/, "$1 12:00:00 AM")
    .replace(/^([A-Za-z]{4,9}\s+\d{1,2},\s+\d{4})$/, "$1 12:00:00 AM");

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const isoParsed = new Date(cleaned);
  if (!Number.isNaN(isoParsed.getTime())) {
    return isoParsed;
  }

  return null;
}

function formatBidCountdown(parsed: Date, now: Date): string {
  const remainingMs = Math.max(parsed.getTime() - now.getTime(), 0);
  const remainingHours = Math.max(Math.ceil(remainingMs / 3_600_000), 1);
  const remainingDays = Math.max(Math.ceil(remainingMs / 86_400_000), 1);

  if (remainingHours <= 24) {
    return `${remainingHours}h left`;
  }

  return `${remainingDays}d left`;
}

function bidUrgencyLevel(parsed: Date, now: Date): "critical" | "high" | "medium" {
  const remainingDays = Math.max(Math.ceil((parsed.getTime() - now.getTime()) / 86_400_000), 0);
  if (remainingDays <= 3) return "critical";
  if (remainingDays <= 7) return "high";
  return "medium";
}

// -- Types --

export interface BidSubmission {
  company_name: string;
  contact_address: string;
  result: string | null;
}

export interface PlanTaker {
  company_name: string;
  contact_address: string;
}

export interface Bid {
  bid_name: string;
  bid_status: string;
  bid_closing_date: string;
  bid_url: string;
  city: string;
  year: number;
  days_left: string | null;
  bid_classification: string | null;
  bid_type: string | null;
  bid_number: string | null;
  published_date: string | null;
  description: string | null;
  categories: string[] | null;
  closing_at_iso?: string | null;
  days_until_close?: number | null;
  urgency_level?: "critical" | "high" | "medium" | null;
  purchasing_representive: { name: string; contact_email: string } | null;
  bids_submitted: BidSubmission[] | null;
  plan_takers: PlanTaker[] | null;
}

export interface BidStats {
  total: number;
  open: number;
  municipalities: number;
}

export interface Meeting {
  meeting_title: string;
  meeting_date: string;
  document_type: string;
  pdf_url: string;
  city: string;
  year: number;
}

export interface MeetingStats {
  total_meetings: number;
  total_docs: number;
  completed_docs: number;
}

export interface Signal {
  source_type: string;
  source_url: string;
  city: string;
  signal_type: string;
  signal_category: string;
  confidence: number;
  score: number;
  summary: string;
  raw_excerpt: string;
  estimated_value: number | null;
  estimated_timeline: string | null;
  procurement_stage: string | null;
  extracted_at: string;
}

export interface SignalStat {
  category: string;
  count: number;
  high_confidence_count: number;
  avg_score: number;
  avg_confidence: number;
}

export interface CategoryOption {
  value: string;
  label: string;
}

export interface PDFDoc {
  source_url: string;
  city: string;
  source_type: string;
  status: string;
  page_count: number | null;
  signals_extracted: number;
  created_at: string;
}

export interface Account {
  city: string;
  total_bids: number;
  open_bids: number;
  total_signals: number;
  avg_score: number;
  total_meetings: number;
  total_docs: number;
  signals_extracted: number;
}

export interface AccountDetail {
  city: string;
  summary: {
    total_bids: number;
    open_bids: number;
    total_signals: number;
    avg_score: number;
    total_meetings: number;
    total_docs: number;
    contacts_found: number;
  };
  bids: Bid[];
  signals: Signal[];
  meetings: Meeting[];
  documents: PDFDoc[];
  contacts: { name: string; contact_email: string }[];
}

export interface SearchResult {
  type: "bid" | "signal" | "meeting";
  title: string;
  city: string;
  url: string;
  meta: string;
  score?: number;
}

export interface PipelineStage {
  stage: string;
  label: string;
  count: number;
  avg_score: number;
  avg_confidence: number;
}

type BidAggregateRow = Pick<Bid, "city" | "bid_status">;
type SignalAggregateRow = Pick<Signal, "city" | "score" | "confidence" | "signal_category" | "procurement_stage">;
type MeetingAggregateRow = Pick<Meeting, "city">;
type PdfAggregateRow = Pick<PDFDoc, "city" | "status" | "signals_extracted">;

function getBidAggregateRows(year?: number) {
  return cachedPromise(`bids:${year ?? "all"}`, () =>
    supabaseFetchAll<BidAggregateRow>("bids", (rest, offset, limit) => {
      rest.set("select", "city,bid_status");
      if (year) addEq(rest, "year", year);
      rest.set("limit", String(limit));
      rest.set("offset", String(offset));
    }),
  );
}

function getSignalAggregateRows(year?: number) {
  return cachedPromise(`signals:${year ?? "all"}`, () =>
    supabaseFetchAll<SignalAggregateRow>("signals", (rest, offset, limit) => {
      rest.set("select", "city,score,confidence,signal_category,procurement_stage");
      if (year) addEq(rest, "year", year);
      rest.set("limit", String(limit));
      rest.set("offset", String(offset));
    }),
  );
}

function getMeetingAggregateRows(year?: number) {
  return cachedPromise(`meetings:${year ?? "all"}`, () =>
    supabaseFetchAll<MeetingAggregateRow>("meetings", (rest, offset, limit) => {
      rest.set("select", "city");
      if (year) addEq(rest, "year", year);
      rest.set("limit", String(limit));
      rest.set("offset", String(offset));
    }),
  );
}

function getPdfAggregateRows(year?: number) {
  return cachedPromise(`pdf_documents:${year ?? "all"}`, () =>
    supabaseFetchAll<PdfAggregateRow>("pdf_documents", (rest, offset, limit) => {
      rest.set("select", "city,status,signals_extracted");
      if (year) addEq(rest, "year", year);
      rest.set("limit", String(limit));
      rest.set("offset", String(offset));
    }),
  );
}

// -- Endpoints --

export async function getBids(params?: { city?: string; status?: string; year?: number; limit?: number; offset?: number }) {
  const q = new URLSearchParams();
  if (params?.city) q.set("city", params.city);
  if (params?.status) q.set("status", params.status);
  if (params?.year) q.set("year", String(params.year));
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));

  if (!USE_SUPABASE_DIRECT) {
    return fetcher<Bid[]>(`/bids?${q}`);
  }

  const rest = new URLSearchParams();
  rest.set("select", BID_PUBLIC_COLUMNS);
  addEq(rest, "city", params?.city);
  addEq(rest, "bid_status", params?.status);
  if (params?.year) addEq(rest, "year", params.year);
  rest.set("order", "bid_closing_date.desc");
  rest.set("limit", String(params?.limit ?? 50));
  rest.set("offset", String(params?.offset ?? 0));
  return supabaseFetcher<Bid[]>("bids", rest);
}

export async function getBidStats(params?: { city?: string; status?: string; year?: number }) {
  const q = new URLSearchParams();
  if (params?.city) q.set("city", params.city);
  if (params?.status) q.set("status", params.status);
  if (params?.year) q.set("year", String(params.year));

  if (!USE_SUPABASE_DIRECT) {
    return fetcher<BidStats>(`/bids/stats?${q}`);
  }

  const rows = (await getBidAggregateRows(params?.year)).filter((row) => {
    if (params?.city && row.city !== params.city) return false;
    if (params?.status && row.bid_status !== params.status) return false;
    return true;
  });

  return {
    total: rows.length,
    open: rows.filter((row) => row.bid_status?.toLowerCase().includes("open")).length,
    municipalities: new Set(rows.map((row) => row.city).filter(Boolean)).size,
  };
}

export async function getBid(bidNumber: string) {
  if (!USE_SUPABASE_DIRECT) {
    return fetcher<Bid>(`/bids/${encodeURIComponent(bidNumber)}`);
  }

  const params = new URLSearchParams();
  params.set("select", BID_PUBLIC_COLUMNS);
  addEq(params, "bid_number", bidNumber);
  params.set("limit", "1");

  const rows = await supabaseFetcher<Bid[]>("bids", params);
  if (!rows.length) {
    throw new Error("Bid not found");
  }
  return rows[0];
}

export async function getMeetings(params?: { city?: string; document_type?: string; year?: number; limit?: number; offset?: number }) {
  const q = new URLSearchParams();
  if (params?.city) q.set("city", params.city);
  if (params?.document_type) q.set("document_type", params.document_type);
  if (params?.year) q.set("year", String(params.year));
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));

  if (!USE_SUPABASE_DIRECT) {
    return fetcher<Meeting[]>(`/meetings?${q}`);
  }

  const rest = new URLSearchParams();
  rest.set("select", MEETING_PUBLIC_COLUMNS);
  addEq(rest, "city", params?.city);
  addEq(rest, "document_type", params?.document_type);
  if (params?.year) addEq(rest, "year", params.year);
  rest.set("order", "meeting_date.desc");
  rest.set("limit", String(params?.limit ?? 50));
  rest.set("offset", String(params?.offset ?? 0));
  return supabaseFetcher<Meeting[]>("meetings", rest);
}

export async function getMeetingStats(params?: { year?: number }) {
  const q = new URLSearchParams();
  if (params?.year) q.set("year", String(params.year));

  if (!USE_SUPABASE_DIRECT) {
    return fetcher<MeetingStats>(`/meetings/stats?${q}`);
  }

  const [meetings, docs] = await Promise.all([getMeetingAggregateRows(params?.year), getPdfAggregateRows(params?.year)]);

  return {
    total_meetings: meetings.length,
    total_docs: docs.length,
    completed_docs: docs.filter((doc) => doc.status === "completed").length,
  };
}

export async function getSignals(params?: {
  city?: string;
  category?: string;
  year?: number;
  min_confidence?: number;
  min_score?: number;
  limit?: number;
  offset?: number;
}) {
  const q = new URLSearchParams();
  if (params?.city) q.set("city", params.city);
  if (params?.category) q.set("category", params.category);
  if (params?.year) q.set("year", String(params.year));
  if (params?.min_confidence) q.set("min_confidence", String(params.min_confidence));
  if (params?.min_score) q.set("min_score", String(params.min_score));
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));

  if (!USE_SUPABASE_DIRECT) {
    return fetcher<Signal[]>(`/signals?${q}`);
  }

  const rest = new URLSearchParams();
  rest.set("select", SIGNAL_PUBLIC_COLUMNS);
  addEq(rest, "city", params?.city);
  addEq(rest, "signal_category", params?.category);
  if (params?.year) addEq(rest, "year", params.year);
  addGte(rest, "confidence", params?.min_confidence);
  addGte(rest, "score", params?.min_score);
  rest.set("order", "score.desc");
  rest.set("limit", String(params?.limit ?? 50));
  rest.set("offset", String(params?.offset ?? 0));
  return supabaseFetcher<Signal[]>("signals", rest);
}

export async function getSignalStats(params?: { city?: string; year?: number; min_confidence?: number }) {
  const q = new URLSearchParams();
  if (params?.city) q.set("city", params.city);
  if (params?.year) q.set("year", String(params.year));
  if (params?.min_confidence) q.set("min_confidence", String(params.min_confidence));

  if (!USE_SUPABASE_DIRECT) {
    return fetcher<SignalStat[]>(`/signals/stats?${q}`);
  }

  const rows = (await getSignalAggregateRows(params?.year)).filter((row) => {
    if (params?.city && row.city !== params.city) return false;
    if ((params?.min_confidence ?? 0) > 0 && (row.confidence ?? 0) < (params?.min_confidence ?? 0)) return false;
    return true;
  });

  const byCategory = new Map<
    string,
    { count: number; high_confidence_count: number; total_score: number; total_confidence: number }
  >();

  for (const row of rows) {
    const category = row.signal_category || "unknown";
    const current = byCategory.get(category) || {
      count: 0,
      high_confidence_count: 0,
      total_score: 0,
      total_confidence: 0,
    };

    current.count += 1;
    if ((row.confidence ?? 0) >= 0.7) {
      current.high_confidence_count += 1;
    }
    current.total_score += row.score ?? 0;
    current.total_confidence += row.confidence ?? 0;
    byCategory.set(category, current);
  }

  return [...byCategory.entries()]
    .map(([category, stats]) => ({
      category,
      count: stats.count,
      high_confidence_count: stats.high_confidence_count,
      avg_score: stats.count ? round(stats.total_score / stats.count) : 0,
      avg_confidence: stats.count ? round(stats.total_confidence / stats.count) : 0,
    }))
    .sort((a, b) => b.avg_score - a.avg_score);
}

export async function getSignalCategories() {
  if (!USE_SUPABASE_DIRECT) {
    return fetcher<CategoryOption[]>("/signals/categories");
  }

  const categories = await getSignalStats();
  return categories.map((item) => ({
    value: item.category,
    label: item.category.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase()),
  }));
}

export async function getSignalPipeline(params?: { city?: string; year?: number }) {
  const q = new URLSearchParams();
  if (params?.city) q.set("city", params.city);
  if (params?.year) q.set("year", String(params.year));

  if (!USE_SUPABASE_DIRECT) {
    return fetcher<PipelineStage[]>(`/signals/pipeline?${q}`);
  }

  const rows = (await getSignalAggregateRows(params?.year)).filter((row) => {
    if (params?.city && row.city !== params.city) return false;
    return true;
  });

  const byStage = new Map<string, { count: number; total_score: number; total_confidence: number }>();

  for (const row of rows) {
    const stage = row.procurement_stage || "unknown";
    const current = byStage.get(stage) || { count: 0, total_score: 0, total_confidence: 0 };
    current.count += 1;
    current.total_score += row.score ?? 0;
    current.total_confidence += row.confidence ?? 0;
    byStage.set(stage, current);
  }

  const result: PipelineStage[] = SIGNAL_STAGE_ORDER.map((stage) => {
    const current = byStage.get(stage) || { count: 0, total_score: 0, total_confidence: 0 };
    return {
      stage,
      label: stage.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase()),
      count: current.count,
      avg_score: current.count ? round(current.total_score / current.count) : 0,
      avg_confidence: current.count ? round(current.total_confidence / current.count) : 0,
    };
  });

  if (byStage.has("unknown")) {
    const current = byStage.get("unknown")!;
    result.push({
      stage: "unknown",
      label: "Unclassified",
      count: current.count,
      avg_score: current.count ? round(current.total_score / current.count) : 0,
      avg_confidence: current.count ? round(current.total_confidence / current.count) : 0,
    });
  }

  return result;
}

export async function getCities(params?: { year?: number }) {
  const q = new URLSearchParams();
  if (params?.year) q.set("year", String(params.year));

  if (!USE_SUPABASE_DIRECT) {
    return fetcher<string[]>(`/cities?${q}`);
  }

  const [bids, signals] = await Promise.all([getBidAggregateRows(params?.year), getSignalAggregateRows(params?.year)]);

  return [...new Set([...bids, ...signals].map((row) => row.city).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export async function getPDFDocuments(params?: { city?: string; status?: string; limit?: number; offset?: number }) {
  const q = new URLSearchParams();
  if (params?.city) q.set("city", params.city);
  if (params?.status) q.set("status", params.status);
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));

  if (!USE_SUPABASE_DIRECT) {
    return fetcher<PDFDoc[]>(`/pdf-documents?${q}`);
  }

  const rest = new URLSearchParams();
  rest.set("select", PDF_PUBLIC_COLUMNS);
  addEq(rest, "city", params?.city);
  addEq(rest, "status", params?.status);
  rest.set("order", "created_at.desc");
  rest.set("limit", String(params?.limit ?? 50));
  rest.set("offset", String(params?.offset ?? 0));
  return supabaseFetcher<PDFDoc[]>("pdf_documents", rest);
}

export async function getAccounts(params?: { year?: number }) {
  const q = new URLSearchParams();
  if (params?.year) q.set("year", String(params.year));

  if (!USE_SUPABASE_DIRECT) {
    return fetcher<Account[]>(`/accounts?${q}`);
  }

  const [bids, signals, meetings, docs] = await Promise.all([
    getBidAggregateRows(params?.year),
    getSignalAggregateRows(params?.year),
    getMeetingAggregateRows(params?.year),
    getPdfAggregateRows(params?.year),
  ]);

  const cities = new Map<string, Account & { _scores: number[] }>();

  const ensureAccount = (city: string) => {
    if (!cities.has(city)) {
      cities.set(city, {
        city,
        total_bids: 0,
        open_bids: 0,
        total_signals: 0,
        avg_score: 0,
        total_meetings: 0,
        total_docs: 0,
        signals_extracted: 0,
        _scores: [],
      });
    }
    return cities.get(city)!;
  };

  for (const bid of bids) {
    if (!bid.city) continue;
    const account = ensureAccount(bid.city);
    account.total_bids += 1;
    if (bid.bid_status?.toLowerCase().includes("open")) {
      account.open_bids += 1;
    }
  }

  for (const signal of signals) {
    if (!signal.city) continue;
    const account = ensureAccount(signal.city);
    account.total_signals += 1;
    account._scores.push(signal.score ?? 0);
  }

  for (const meeting of meetings) {
    if (!meeting.city) continue;
    ensureAccount(meeting.city).total_meetings += 1;
  }

  for (const doc of docs) {
    if (!doc.city) continue;
    const account = ensureAccount(doc.city);
    account.total_docs += 1;
    account.signals_extracted += doc.signals_extracted ?? 0;
  }

  return [...cities.values()]
    .map(({ _scores, ...account }) => ({
      ...account,
      avg_score: _scores.length ? round(_scores.reduce((sum, score) => sum + score, 0) / _scores.length) : 0,
    }))
    .sort((a, b) => b.total_signals - a.total_signals);
}

export async function getAccount(city: string) {
  if (!USE_SUPABASE_DIRECT) {
    return fetcher<AccountDetail>(`/accounts/${encodeURIComponent(city)}`);
  }

  const [bids, signals, meetings, documents] = await Promise.all([
    getBids({ city, limit: 50, offset: 0 }),
    getSignals({ city, limit: 50, offset: 0 }),
    getMeetings({ city, limit: 50, offset: 0 }),
    getPDFDocuments({ city, limit: 50, offset: 0 }),
  ]);

  const contacts: { name: string; contact_email: string }[] = [];
  const seenContacts = new Set<string>();

  for (const bid of bids) {
    const rep = bid.purchasing_representive;
    if (rep?.name) {
      const key = rep.name.toLowerCase();
      if (!seenContacts.has(key)) {
        seenContacts.add(key);
        contacts.push(rep);
      }
    }
  }

  const openBids = bids.filter((bid) => bid.bid_status?.toLowerCase().includes("open"));
  const scores = signals.map((signal) => signal.score ?? 0);

  return {
    city,
    summary: {
      total_bids: bids.length,
      open_bids: openBids.length,
      total_signals: signals.length,
      avg_score: scores.length ? round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0,
      total_meetings: meetings.length,
      total_docs: documents.length,
      contacts_found: contacts.length,
    },
    bids,
    signals,
    meetings,
    documents,
    contacts,
  };
}

export async function globalSearch(query: string) {
  if (!USE_SUPABASE_DIRECT) {
    return fetcher<SearchResult[]>(`/search?q=${encodeURIComponent(query)}`);
  }

  const limit = 20;
  const [bids, signals, meetings] = await Promise.all([
    supabaseFetcher<Array<Pick<Bid, "bid_name" | "bid_status" | "city" | "bid_url" | "bid_closing_date">>>("bids", (() => {
      const params = new URLSearchParams();
      params.set("select", "bid_name,bid_status,city,bid_url,bid_closing_date");
      addILike(params, "bid_name", query);
      params.set("limit", String(limit));
      return params;
    })()),
    supabaseFetcher<Array<Pick<Signal, "summary" | "signal_category" | "city" | "source_url" | "score">>>("signals", (() => {
      const params = new URLSearchParams();
      params.set("select", "summary,signal_category,city,source_url,score");
      addILike(params, "summary", query);
      params.set("limit", String(limit));
      return params;
    })()),
    supabaseFetcher<Array<Pick<Meeting, "meeting_title" | "city" | "meeting_date" | "pdf_url">>>("meetings", (() => {
      const params = new URLSearchParams();
      params.set("select", "meeting_title,city,meeting_date,pdf_url");
      addILike(params, "meeting_title", query);
      params.set("limit", String(limit));
      return params;
    })()),
  ]);

  return [
    ...bids.map<SearchResult>((bid) => ({
      type: "bid",
      title: bid.bid_name,
      city: bid.city,
      url: bid.bid_url,
      meta: bid.bid_status,
    })),
    ...signals.map<SearchResult>((signal) => ({
      type: "signal",
      title: signal.summary,
      city: signal.city,
      url: signal.source_url,
      meta: signal.signal_category,
      score: signal.score,
    })),
    ...meetings.map<SearchResult>((meeting) => ({
      type: "meeting",
      title: meeting.meeting_title,
      city: meeting.city,
      url: meeting.pdf_url,
      meta: meeting.meeting_date,
    })),
  ];
}

export async function getBidsClosingSoon(params?: { days?: number; city?: string; year?: number; limit?: number }) {
  const q = new URLSearchParams();
  if (params?.days) q.set("days", String(params.days));
  if (params?.city) q.set("city", params.city);
  if (params?.year) q.set("year", String(params.year));
  if (params?.limit) q.set("limit", String(params.limit));

  if (!USE_SUPABASE_DIRECT) {
    return fetcher<Bid[]>(`/bids/closing-soon?${q}`);
  }

  const rows = await supabaseFetchAll<Bid>("bids", (rest, offset, limit) => {
    rest.set("select", BID_PUBLIC_COLUMNS);
    addEq(rest, "city", params?.city);
    if (params?.year) addEq(rest, "year", params.year);
    rest.set("limit", String(limit));
    rest.set("offset", String(offset));
  });

  const now = new Date();
  const maxDays = params?.days ?? 90;
  const cutoff = new Date(now.getTime() + maxDays * 86_400_000);
  const limit = params?.limit ?? 50;
  const upcoming: Bid[] = [];

  for (const row of rows) {
    if (!row.bid_status?.toLowerCase().includes("open")) {
      continue;
    }

    const parsed = parseBidDate(row.bid_closing_date);
    if (!parsed || parsed < now || parsed > cutoff) {
      continue;
    }

    upcoming.push({
      ...row,
      closing_at_iso: parsed.toISOString(),
      days_until_close: Math.max(Math.ceil((parsed.getTime() - now.getTime()) / 86_400_000), 0),
      days_left: formatBidCountdown(parsed, now),
      urgency_level: bidUrgencyLevel(parsed, now),
    });
  }

  return upcoming
    .sort((a, b) => {
      const left = a.closing_at_iso ? new Date(a.closing_at_iso).getTime() : Number.MAX_SAFE_INTEGER;
      const right = b.closing_at_iso ? new Date(b.closing_at_iso).getTime() : Number.MAX_SAFE_INTEGER;
      return left - right;
    })
    .slice(0, limit);
}
