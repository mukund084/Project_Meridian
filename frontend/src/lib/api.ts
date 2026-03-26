const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetcher<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ── Types ──

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
  purchasing_representive: { name: string; contact_email: string } | null;
}

export interface Meeting {
  meeting_title: string;
  meeting_date: string;
  document_type: string;
  pdf_url: string;
  city: string;
  year: number;
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

// ── Endpoints ──

export function getBids(params?: { city?: string; status?: string; limit?: number; offset?: number }) {
  const q = new URLSearchParams();
  if (params?.city) q.set("city", params.city);
  if (params?.status) q.set("status", params.status);
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));
  return fetcher<Bid[]>(`/bids?${q}`);
}

export function getBid(bidNumber: string) {
  return fetcher<Bid>(`/bids/${encodeURIComponent(bidNumber)}`);
}

export function getMeetings(params?: { city?: string; document_type?: string; limit?: number; offset?: number }) {
  const q = new URLSearchParams();
  if (params?.city) q.set("city", params.city);
  if (params?.document_type) q.set("document_type", params.document_type);
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));
  return fetcher<Meeting[]>(`/meetings?${q}`);
}

export function getSignals(params?: { city?: string; category?: string; min_confidence?: number; min_score?: number; limit?: number; offset?: number }) {
  const q = new URLSearchParams();
  if (params?.city) q.set("city", params.city);
  if (params?.category) q.set("category", params.category);
  if (params?.min_confidence) q.set("min_confidence", String(params.min_confidence));
  if (params?.min_score) q.set("min_score", String(params.min_score));
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));
  return fetcher<Signal[]>(`/signals?${q}`);
}

export function getSignalStats(city?: string) {
  const q = city ? `?city=${encodeURIComponent(city)}` : "";
  return fetcher<SignalStat[]>(`/signals/stats${q}`);
}

export function getSignalCategories() {
  return fetcher<CategoryOption[]>("/signals/categories");
}

export function getCities() {
  return fetcher<string[]>("/cities");
}

export function getPDFDocuments(params?: { city?: string; status?: string; limit?: number; offset?: number }) {
  const q = new URLSearchParams();
  if (params?.city) q.set("city", params.city);
  if (params?.status) q.set("status", params.status);
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));
  return fetcher<PDFDoc[]>(`/pdf-documents?${q}`);
}

export function getAccounts() {
  return fetcher<Account[]>("/accounts");
}

export function getAccount(city: string) {
  return fetcher<AccountDetail>(`/accounts/${encodeURIComponent(city)}`);
}

export function globalSearch(query: string) {
  return fetcher<SearchResult[]>(`/search?q=${encodeURIComponent(query)}`);
}

export function getExpiringContracts(params?: { days?: number; city?: string; limit?: number }) {
  const q = new URLSearchParams();
  if (params?.days) q.set("days", String(params.days));
  if (params?.city) q.set("city", params.city);
  if (params?.limit) q.set("limit", String(params.limit));
  return fetcher<Bid[]>(`/contracts/expiring?${q}`);
}
