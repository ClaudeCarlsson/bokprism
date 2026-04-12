import * as cheerio from "cheerio";

export interface ParsedFiling {
  orgNumber: string;
  companyName: string;
  currency: string;
  periods: PeriodData[];
  people: PersonEntry[];
  texts: TextEntry[];
}

export interface PeriodData {
  periodStart: string;
  periodEnd: string;
  financials: FinancialEntry[];
}

export interface FinancialEntry {
  metric: string;
  value: number;
  unit: string;
}

export interface PersonEntry {
  firstName: string;
  lastName: string;
  role: string;
}

export interface TextEntry {
  field: string;
  content: string;
}

// Map unit refs to clean unit names
function normalizeUnit(unitRef: string): string {
  if (unitRef === "SEK" || unitRef.includes("SEK")) return "SEK";
  if (unitRef === "procent" || unitRef.includes("pure")) return "percent";
  if (unitRef.includes("anstallda") || unitRef.includes("antal")) return "count";
  return unitRef;
}

// Strip namespace prefix: "se-gen-base:Nettoomsattning" → "Nettoomsattning"
function stripNamespace(name: string): string {
  const idx = name.lastIndexOf(":");
  return idx >= 0 ? name.slice(idx + 1) : name;
}

// Parse Swedish number format: "1 234,56" → 1234.56
// Then apply scale: value * 10^scale
// Then apply sign
function parseNumber(
  text: string,
  scale: string | undefined,
  sign: string | undefined
): number | null {
  let cleaned = text.replace(/\s+/g, "").replace(/\u00a0/g, "");
  if (!cleaned || cleaned === "-") return null;
  cleaned = cleaned.replace(",", ".");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  const scaleNum = scale ? parseInt(scale, 10) : 0;
  let value = num * Math.pow(10, scaleNum);
  if (sign === "-") value = -value;
  return value;
}

// Sanity bounds — reject values beyond these, they're filer errors
function isSane(metric: string, value: number, unit: string): boolean {
  if (metric === "Soliditet") {
    return value >= -10 && value <= 10;
  }
  if (metric === "MedelantaletAnstallda") {
    return value >= 0 && value <= 200_000;
  }
  if (unit === "percent") {
    return value >= -10 && value <= 10;
  }
  if (unit === "count") {
    if (metric.includes("Anstallda") || metric.includes("anstallda")) {
      return value >= 0 && value <= 200_000;
    }
    return Math.abs(value) <= 1e9;
  }
  return Math.abs(value) <= 1e12;
}

// Text fields we want to capture
const TEXT_FIELDS: Record<string, string> = {
  "AllmantVerksamheten": "verksamhet",
  "VasentligaHandelserRakenskapsaret": "vasentliga_handelser",
  "RedovisningsVarderingsprinciper": "redovisningsprinciper",
  "ForslagDisposition": "resultatdisposition",
};

// Pick the best value for a metric from multiple candidates using majority vote
interface Candidate { value: number; unit: string; absScale: number }

function pickBest(candidates: Candidate[]): Candidate {
  if (candidates.length === 1) return candidates[0];

  type Group = {
    count: number;
    minAbsScale: number;
    unit: string;
    representative: number;
  };
  const groups: Group[] = [];
  const sameCluster = (a: number, b: number) => {
    if (a === b) return true;
    if (a === 0 || b === 0) return false;
    return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b)) < 0.01;
  };

  for (const c of candidates) {
    const existing = groups.find(g => sameCluster(g.representative, c.value));
    if (existing) {
      existing.count++;
      existing.minAbsScale = Math.min(existing.minAbsScale, c.absScale);
      if (Math.abs(c.value) > Math.abs(existing.representative)) {
        existing.representative = c.value;
      }
    } else {
      groups.push({
        count: 1,
        minAbsScale: c.absScale,
        unit: c.unit,
        representative: c.value,
      });
    }
  }

  groups.sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    return a.minAbsScale - b.minAbsScale;
  });

  return {
    value: groups[0].representative,
    unit: groups[0].unit,
    absScale: groups[0].minAbsScale,
  };
}

export function parseIxbrl(html: string): ParsedFiling | null {
  const $ = cheerio.load(html, { xml: { xmlMode: false } });

  // Extract company identity
  const orgNumberEl = $('[name="se-cd-base:Organisationsnummer"]').first();
  const companyNameEl = $('[name="se-cd-base:ForetagetsNamn"]').first().length
    ? $('[name="se-cd-base:ForetagetsNamn"]').first()
    : $('[name="se-ar-base:Foretagsnamn"]').first();
  const periodEndEl = $('[name="se-cd-base:RakenskapsarSistaDag"]').first();

  const orgNumber = orgNumberEl.text().trim().replace(/\s/g, "");
  const companyName = companyNameEl.text().trim();
  const filingPeriodEnd = periodEndEl.text().trim();

  if (!orgNumber || !filingPeriodEnd) return null;

  // Determine currency
  const currencyEl = $('[name="se-cd-base:RedovisningsvalutaHandlingList"]').first();
  const currencyText = currencyEl.text().trim();
  const currency = currencyText.includes("Euro") ? "EUR" : "SEK";

  // Build context map: context ID → { start?, end?, instant? }
  const contextInfo = new Map<string, { start?: string; end?: string; instant?: string }>();
  $("xbrli\\:context, context").each((_, el) => {
    const id = $(el).attr("id");
    if (!id) return;
    const startDate = $(el).find("xbrli\\:startDate, startDate").first().text().trim();
    const endDate = $(el).find("xbrli\\:endDate, endDate").first().text().trim();
    const instant = $(el).find("xbrli\\:instant, instant").first().text().trim();
    contextInfo.set(id, {
      start: startDate || undefined,
      end: endDate || undefined,
      instant: instant || undefined,
    });
  });

  // Group contexts by their effective period end date.
  // "period" contexts have endDate; "instant" contexts have instant.
  // Both with the same date belong to the same fiscal year.
  const contextsByPeriodEnd = new Map<string, {
    contextIds: Set<string>;
    periodStart?: string;
  }>();

  for (const [id, info] of contextInfo) {
    const effectiveEnd = info.end || info.instant;
    if (!effectiveEnd) continue;

    let group = contextsByPeriodEnd.get(effectiveEnd);
    if (!group) {
      group = { contextIds: new Set() };
      contextsByPeriodEnd.set(effectiveEnd, group);
    }
    group.contextIds.add(id);
    // Capture periodStart from period contexts (not instant ones)
    if (info.start && !group.periodStart) {
      group.periodStart = info.start;
    }
  }

  // Extract financial data for ALL periods
  // First pass: collect all ix:nonFraction elements keyed by (periodEnd, metric)
  const allCandidates = new Map<string, Map<string, Candidate[]>>();

  $("ix\\:nonFraction, nonfraction").each((_, el) => {
    const $el = $(el);
    const contextRef = $el.attr("contextref") || $el.attr("contextRef");
    if (!contextRef) return;

    // Find which period this context belongs to
    const cInfo = contextInfo.get(contextRef);
    if (!cInfo) return;
    const effectiveEnd = cInfo.end || cInfo.instant;
    if (!effectiveEnd) return;

    // Check this context is in one of our known groups
    const group = contextsByPeriodEnd.get(effectiveEnd);
    if (!group || !group.contextIds.has(contextRef)) return;

    const rawName = $el.attr("name");
    if (!rawName) return;

    const metric = stripNamespace(rawName);
    const unitRef = $el.attr("unitref") || $el.attr("unitRef") || "SEK";
    const scale = $el.attr("scale");
    const sign = $el.attr("sign");
    const text = $el.text();

    const value = parseNumber(text, scale, sign);
    if (value === null) return;

    const unit = normalizeUnit(unitRef);
    if (!isSane(metric, value, unit)) return;

    const absScale = Math.abs(parseInt(scale || "0", 10));

    if (!allCandidates.has(effectiveEnd)) {
      allCandidates.set(effectiveEnd, new Map());
    }
    const periodMap = allCandidates.get(effectiveEnd)!;
    if (!periodMap.has(metric)) {
      periodMap.set(metric, []);
    }
    periodMap.get(metric)!.push({ value, unit, absScale });
  });

  // Build period data for each discovered period
  const periods: PeriodData[] = [];
  for (const [periodEnd, metricMap] of allCandidates) {
    const financials: FinancialEntry[] = [];
    for (const [metric, candidates] of metricMap) {
      const best = pickBest(candidates);
      financials.push({ metric, value: best.value, unit: best.unit });
    }
    if (financials.length === 0) continue;

    const group = contextsByPeriodEnd.get(periodEnd);
    // Infer period start: use the context's startDate, or estimate as 1 year before end
    let periodStart = group?.periodStart || "";
    if (!periodStart && periodEnd) {
      // Estimate: fiscal year typically starts 1 year before end + 1 day
      const d = new Date(periodEnd);
      d.setFullYear(d.getFullYear() - 1);
      d.setDate(d.getDate() + 1);
      periodStart = d.toISOString().slice(0, 10);
    }

    periods.push({ periodStart, periodEnd, financials });
  }

  // Sort periods chronologically
  periods.sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));

  if (periods.length === 0) return null;

  // Extract people — only from the filing's primary period contexts
  const primaryContexts = new Set<string>();
  const primaryGroup = contextsByPeriodEnd.get(filingPeriodEnd);
  if (primaryGroup) {
    for (const id of primaryGroup.contextIds) primaryContexts.add(id);
  }
  // Fallback
  if (primaryContexts.size === 0) {
    primaryContexts.add("period0");
    primaryContexts.add("balans0");
  }

  const people: PersonEntry[] = [];
  const seenPeople = new Set<string>();

  const tupleData = new Map<string, { firstName?: string; lastName?: string; role?: string; title?: string }>();
  $("ix\\:nonNumeric, nonnumeric").each((_, el) => {
    const $el = $(el);
    const name = $el.attr("name") || "";
    const tupleRef = $el.attr("tupleref") || $el.attr("tupleRef");
    if (!tupleRef) return;

    const strippedName = stripNamespace(name);
    const text = $el.text().trim();
    if (!text) return;

    if (!tupleData.has(tupleRef)) tupleData.set(tupleRef, {});
    const data = tupleData.get(tupleRef)!;

    if (strippedName.includes("Tilltalsnamn")) data.firstName = data.firstName || text;
    else if (strippedName.includes("Efternamn")) data.lastName = data.lastName || text;
    else if (strippedName.includes("Roll") || strippedName.includes("Foretradarroll")) data.role = data.role || text;
    else if (strippedName.includes("Titel")) data.title = data.title || text;
  });

  for (const [tupleRef, data] of tupleData) {
    if (!data.firstName || !data.lastName) continue;
    let role = data.role || data.title || "";
    if (!role) role = tupleRef.toLowerCase().includes("revisor") ? "Revisor" : "Styrelseledamot";
    const key = `${data.firstName}|${data.lastName}|${role}`;
    if (seenPeople.has(key)) continue;
    seenPeople.add(key);
    people.push({ firstName: data.firstName, lastName: data.lastName, role });
  }

  // Non-tuple signatories
  const fastPeople = new Map<string, { firstName?: string; lastName?: string; role?: string }>();
  $("ix\\:nonNumeric, nonnumeric").each((_, el) => {
    const $el = $(el);
    const name = stripNamespace($el.attr("name") || "");
    const text = $el.text().trim();
    if (!text) return;
    if (name === "UnderskriftFaststallelseintygForetradareTilltalsnamn")
      fastPeople.set("f", { ...fastPeople.get("f"), firstName: text });
    else if (name === "UnderskriftFaststallelseintygForetradareEfternamn")
      fastPeople.set("f", { ...fastPeople.get("f"), lastName: text });
    else if (name === "UnderskriftFaststallelseintygForetradareForetradarroll")
      fastPeople.set("f", { ...fastPeople.get("f"), role: text });
  });
  for (const [, data] of fastPeople) {
    if (!data.firstName || !data.lastName) continue;
    const role = data.role || "Styrelseledamot";
    const key = `${data.firstName}|${data.lastName}|${role}`;
    if (seenPeople.has(key)) continue;
    seenPeople.add(key);
    people.push({ firstName: data.firstName, lastName: data.lastName, role });
  }

  // Extract text content from primary period only
  const texts: TextEntry[] = [];
  $("ix\\:nonNumeric, nonnumeric").each((_, el) => {
    const $el = $(el);
    const name = stripNamespace($el.attr("name") || "");
    const fieldName = TEXT_FIELDS[name];
    if (!fieldName) return;
    const content = $el.text().trim();
    if (!content || content.length < 10) return;
    const contextRef = $el.attr("contextref") || $el.attr("contextRef");
    if (contextRef && !primaryContexts.has(contextRef)) return;
    if (texts.some(t => t.field === fieldName)) return;
    texts.push({ field: fieldName, content });
  });

  return { orgNumber, companyName, currency, periods, people, texts };
}
