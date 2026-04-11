import * as cheerio from "cheerio";

export interface ParsedFiling {
  orgNumber: string;
  companyName: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
  financials: FinancialEntry[];
  people: PersonEntry[];
  texts: TextEntry[];
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

// Map context IDs to whether they're the primary (current) period
// We only extract period0/balans0 (current year) to avoid duplicates
const PRIMARY_PERIOD_CONTEXTS = new Set(["period0", "balans0"]);

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
  // Clean text: trim whitespace, remove non-breaking spaces
  let cleaned = text.replace(/\s+/g, "").replace(/\u00a0/g, "");

  // Handle empty
  if (!cleaned || cleaned === "-") return null;

  // Swedish format: comma is decimal separator
  cleaned = cleaned.replace(",", ".");

  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;

  // Apply scale: the display value * 10^scale = actual value
  const scaleNum = scale ? parseInt(scale, 10) : 0;
  let value = num * Math.pow(10, scaleNum);

  // Apply sign attribute
  if (sign === "-") value = -value;

  return value;
}

// Sanity bounds — reject values beyond these, they're filer errors
// (e.g., some filings have dates typed in employee fields, or percentages
// with missing scale attributes, etc.)
function isSane(metric: string, value: number, unit: string): boolean {
  // Percent values should be in a reasonable ratio range
  if (unit === "percent") {
    return value >= -10 && value <= 10; // -1000% to 1000%
  }
  // Employee counts
  if (unit === "count") {
    if (metric.includes("Anstallda") || metric.includes("anstallda")) {
      // Sweden's largest employer has ~100K. Cap at 200K to allow some slack.
      return value >= 0 && value <= 200_000;
    }
    return Math.abs(value) <= 1e9;
  }
  // SEK monetary values: reject anything above 1 trillion SEK.
  // Swedish GDP is ~6 trillion SEK, largest single company values are ~100-200B.
  // Using 1T gives a 5-10x safety margin.
  return Math.abs(value) <= 1e12;
}

// Text fields we want to capture
const TEXT_FIELDS: Record<string, string> = {
  "AllmantVerksamheten": "verksamhet",
  "VasentligaHandelserRakenskapsaret": "vasentliga_handelser",
  "RedovisningsVarderingsprinciper": "redovisningsprinciper",
  "ForslagDisposition": "resultatdisposition",
};

export function parseIxbrl(html: string): ParsedFiling | null {
  const $ = cheerio.load(html, { xml: { xmlMode: false } });

  // Extract company identity — handle multiple namespace variants
  const orgNumberEl = $('[name="se-cd-base:Organisationsnummer"]').first();
  const companyNameEl = $('[name="se-cd-base:ForetagetsNamn"]').first().length
    ? $('[name="se-cd-base:ForetagetsNamn"]').first()
    : $('[name="se-ar-base:Foretagsnamn"]').first();
  const periodStartEl = $('[name="se-cd-base:RakenskapsarForstaDag"]').first();
  const periodEndEl = $('[name="se-cd-base:RakenskapsarSistaDag"]').first();

  const orgNumber = orgNumberEl.text().trim().replace(/\s/g, "");
  const companyName = companyNameEl.text().trim();
  const periodStart = periodStartEl.text().trim();
  const periodEnd = periodEndEl.text().trim();

  if (!orgNumber || !periodEnd) return null;

  // Determine currency (default SEK)
  const currencyEl = $('[name="se-cd-base:RedovisningsvalutaHandlingList"]').first();
  const currencyText = currencyEl.text().trim();
  const currency = currencyText.includes("Euro") ? "EUR" : "SEK";

  // Build a map of context IDs to their period info
  // We need to identify which contexts are "current year" vs comparative
  const contextPeriods = new Map<string, { start?: string; end?: string; instant?: string }>();
  $("xbrli\\:context, context").each((_, el) => {
    const id = $(el).attr("id");
    if (!id) return;
    const startDate = $(el).find("xbrli\\:startDate, startDate").first().text().trim();
    const endDate = $(el).find("xbrli\\:endDate, endDate").first().text().trim();
    const instant = $(el).find("xbrli\\:instant, instant").first().text().trim();
    contextPeriods.set(id, { start: startDate || undefined, end: endDate || undefined, instant: instant || undefined });
  });

  // Find the current filing period end date from contexts
  // The "current" period is the one matching the filing's period end
  const filingPeriodEnd = periodEnd;
  const currentPeriodContexts = new Set<string>();
  const currentInstantContexts = new Set<string>();

  for (const [id, period] of contextPeriods) {
    if (period.end === filingPeriodEnd) {
      currentPeriodContexts.add(id);
    }
    if (period.instant === filingPeriodEnd) {
      currentInstantContexts.add(id);
    }
  }

  // If we couldn't match by date, fall back to period0/balans0
  if (currentPeriodContexts.size === 0) {
    currentPeriodContexts.add("period0");
  }
  if (currentInstantContexts.size === 0) {
    currentInstantContexts.add("balans0");
  }

  const currentContexts = new Set([...currentPeriodContexts, ...currentInstantContexts]);

  // Extract all financial numbers from the current period.
  // A single metric can appear multiple times (in the flerårsöversikt, the
  // main statement, and the förändring av eget kapital section), sometimes
  // with inconsistent scale attributes due to filer errors. We collect every
  // occurrence and then pick the value with the highest vote count. Ties
  // broken by lowest abs(scale), which prefers exact values over rounded.
  interface Candidate { value: number; unit: string; absScale: number }
  const metricCandidates = new Map<string, Candidate[]>();

  $("ix\\:nonFraction, nonfraction").each((_, el) => {
    const $el = $(el);
    const contextRef = $el.attr("contextref") || $el.attr("contextRef");
    if (!contextRef || !currentContexts.has(contextRef)) return;

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

    // Reject clearly impossible values (filer errors in the source XML)
    if (!isSane(metric, value, unit)) return;

    const absScale = Math.abs(parseInt(scale || "0", 10));
    const arr = metricCandidates.get(metric) || [];
    arr.push({ value, unit, absScale });
    metricCandidates.set(metric, arr);
  });

  // Pick the best candidate for each metric by majority vote with
  // relative tolerance clustering (values within 1% agree).
  function pickBest(candidates: Candidate[]): Candidate {
    if (candidates.length === 1) return candidates[0];

    type Group = {
      values: number[];
      count: number;
      minAbsScale: number;
      unit: string;
      // "Representative" value for the group — use the largest-scale one for
      // better precision when candidates differ slightly (e.g. 4,333,792,000
      // vs 4,333,792,405 from scale=3 rounding).
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
        existing.values.push(c.value);
        existing.count++;
        existing.minAbsScale = Math.min(existing.minAbsScale, c.absScale);
        // Update representative to the larger-magnitude value (more precision)
        if (Math.abs(c.value) > Math.abs(existing.representative)) {
          existing.representative = c.value;
        }
      } else {
        groups.push({
          values: [c.value],
          count: 1,
          minAbsScale: c.absScale,
          unit: c.unit,
          representative: c.value,
        });
      }
    }

    // Sort: most occurrences first, then lowest absScale
    groups.sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count;
      return a.minAbsScale - b.minAbsScale;
    });

    const winner = groups[0];
    return {
      value: winner.representative,
      unit: winner.unit,
      absScale: winner.minAbsScale,
    };
  }

  const financials: FinancialEntry[] = [];
  for (const [metric, candidates] of metricCandidates) {
    const best = pickBest(candidates);
    financials.push({ metric, value: best.value, unit: best.unit });
  }

  // Extract people (board members, CEO, auditor)
  const people: PersonEntry[] = [];
  const seenPeople = new Set<string>();

  // Collect tuple-based people (grouped by tupleRef)
  const tupleData = new Map<string, { firstName?: string; lastName?: string; role?: string; title?: string }>();

  $("ix\\:nonNumeric, nonnumeric").each((_, el) => {
    const $el = $(el);
    const name = $el.attr("name") || "";
    const tupleRef = $el.attr("tupleref") || $el.attr("tupleRef");

    if (!tupleRef) return;

    const strippedName = stripNamespace(name);
    const text = $el.text().trim();
    if (!text) return;

    if (!tupleData.has(tupleRef)) {
      tupleData.set(tupleRef, {});
    }
    const data = tupleData.get(tupleRef)!;

    if (strippedName.includes("Tilltalsnamn")) {
      data.firstName = data.firstName || text;
    } else if (strippedName.includes("Efternamn")) {
      data.lastName = data.lastName || text;
    } else if (strippedName.includes("Roll") || strippedName.includes("Foretradarroll")) {
      data.role = data.role || text;
    } else if (strippedName.includes("Titel")) {
      data.title = data.title || text;
    }
  });

  for (const [tupleRef, data] of tupleData) {
    if (!data.firstName || !data.lastName) continue;

    // Determine role: use explicit role, or infer from tuple ID
    let role = data.role || data.title || "";
    if (!role) {
      if (tupleRef.toLowerCase().includes("revisor")) {
        role = "Revisor";
      } else {
        role = "Styrelseledamot";
      }
    }

    const key = `${data.firstName}|${data.lastName}|${role}`;
    if (seenPeople.has(key)) continue;
    seenPeople.add(key);

    people.push({
      firstName: data.firstName,
      lastName: data.lastName,
      role,
    });
  }

  // Also capture non-tuple based signatories (simpler format)
  const faststallelsePeople = new Map<string, { firstName?: string; lastName?: string; role?: string }>();
  $("ix\\:nonNumeric, nonnumeric").each((_, el) => {
    const $el = $(el);
    const name = stripNamespace($el.attr("name") || "");
    const text = $el.text().trim();
    if (!text) return;

    if (name === "UnderskriftFaststallelseintygForetradareTilltalsnamn") {
      faststallelsePeople.set("faststallelse", { ...faststallelsePeople.get("faststallelse"), firstName: text });
    } else if (name === "UnderskriftFaststallelseintygForetradareEfternamn") {
      faststallelsePeople.set("faststallelse", { ...faststallelsePeople.get("faststallelse"), lastName: text });
    } else if (name === "UnderskriftFaststallelseintygForetradareForetradarroll") {
      faststallelsePeople.set("faststallelse", { ...faststallelsePeople.get("faststallelse"), role: text });
    }
  });

  for (const [, data] of faststallelsePeople) {
    if (!data.firstName || !data.lastName) continue;
    const role = data.role || "Styrelseledamot";
    const key = `${data.firstName}|${data.lastName}|${role}`;
    if (seenPeople.has(key)) continue;
    seenPeople.add(key);
    people.push({ firstName: data.firstName, lastName: data.lastName, role });
  }

  // Extract text content
  const texts: TextEntry[] = [];
  $("ix\\:nonNumeric, nonnumeric").each((_, el) => {
    const $el = $(el);
    const name = stripNamespace($el.attr("name") || "");
    const fieldName = TEXT_FIELDS[name];
    if (!fieldName) return;

    const content = $el.text().trim();
    if (!content || content.length < 10) return; // Skip very short/empty content

    // Only take from current period context
    const contextRef = $el.attr("contextref") || $el.attr("contextRef");
    if (contextRef && !currentContexts.has(contextRef) && !PRIMARY_PERIOD_CONTEXTS.has(contextRef)) return;

    // Avoid duplicates
    if (texts.some(t => t.field === fieldName)) return;

    texts.push({ field: fieldName, content });
  });

  return {
    orgNumber,
    companyName,
    periodStart,
    periodEnd,
    currency,
    financials,
    people,
    texts,
  };
}
