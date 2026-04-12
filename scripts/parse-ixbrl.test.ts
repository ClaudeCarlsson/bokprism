import { describe, it, expect } from "vitest";
import { parseIxbrl } from "./parse-ixbrl";

// Minimal valid iXBRL document for testing
function makeIxbrl({
  orgNumber = "556017-2933",
  companyName = "Test AB",
  periodStart = "2023-01-01",
  periodEnd = "2023-12-31",
  financials = "",
  people = "",
  texts = "",
  extraContexts = "",
}: {
  orgNumber?: string;
  companyName?: string;
  periodStart?: string;
  periodEnd?: string;
  financials?: string;
  people?: string;
  texts?: string;
  extraContexts?: string;
} = {}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"
  xmlns:ix="http://www.xbrl.org/2013/inlineXBRL"
  xmlns:xbrli="http://www.xbrl.org/2003/instance"
  xmlns:se-gen-base="http://www.taxonomier.se/se/fr/gen-base/2021-10-31"
  xmlns:se-cd-base="http://www.taxonomier.se/se/fr/cd-base/2021-10-31"
  xmlns:se-gaap-ext="http://www.taxonomier.se/se/fr/gaap/gaap-ext/2021-10-31"
  xmlns:ixt="http://www.xbrl.org/inlineXBRL/transformation/2010-04-20">
<head><title>Test</title></head>
<body>
  <ix:hidden>
    <ix:nonNumeric name="se-cd-base:RakenskapsarForstaDag" contextRef="period0">${periodStart}</ix:nonNumeric>
    <ix:nonNumeric name="se-cd-base:RakenskapsarSistaDag" contextRef="period0">${periodEnd}</ix:nonNumeric>
  </ix:hidden>
  <ix:header>
    <ix:references>
      <link:schemaRef xmlns:link="http://www.xbrl.org/2003/linkbase" />
    </ix:references>
    <ix:resources>
      <xbrli:context id="period0">
        <xbrli:entity><xbrli:identifier scheme="http://www.bolagsverket.se">${orgNumber}</xbrli:identifier></xbrli:entity>
        <xbrli:period>
          <xbrli:startDate>${periodStart}</xbrli:startDate>
          <xbrli:endDate>${periodEnd}</xbrli:endDate>
        </xbrli:period>
      </xbrli:context>
      <xbrli:context id="balans0">
        <xbrli:entity><xbrli:identifier scheme="http://www.bolagsverket.se">${orgNumber}</xbrli:identifier></xbrli:entity>
        <xbrli:period>
          <xbrli:instant>${periodEnd}</xbrli:instant>
        </xbrli:period>
      </xbrli:context>
      <xbrli:context id="period1">
        <xbrli:entity><xbrli:identifier scheme="http://www.bolagsverket.se">${orgNumber}</xbrli:identifier></xbrli:entity>
        <xbrli:period>
          <xbrli:startDate>2022-01-01</xbrli:startDate>
          <xbrli:endDate>2022-12-31</xbrli:endDate>
        </xbrli:period>
      </xbrli:context>
      <xbrli:context id="balans1">
        <xbrli:entity><xbrli:identifier scheme="http://www.bolagsverket.se">${orgNumber}</xbrli:identifier></xbrli:entity>
        <xbrli:period>
          <xbrli:instant>2022-12-31</xbrli:instant>
        </xbrli:period>
      </xbrli:context>
      ${extraContexts}
      <xbrli:unit id="SEK"><xbrli:measure>iso4217:SEK</xbrli:measure></xbrli:unit>
      <xbrli:unit id="procent"><xbrli:measure>xbrli:pure</xbrli:measure></xbrli:unit>
    </ix:resources>
  </ix:header>
  <ix:nonNumeric name="se-cd-base:ForetagetsNamn" contextRef="period0">${companyName}</ix:nonNumeric>
  <ix:nonNumeric name="se-cd-base:Organisationsnummer" contextRef="period0">${orgNumber}</ix:nonNumeric>
  ${financials}
  ${people}
  ${texts}
</body></html>`;
}

describe("parseIxbrl", () => {
  it("extracts company identity", () => {
    const result = parseIxbrl(makeIxbrl({
      financials: `<ix:nonFraction name="se-gen-base:Aktiekapital" contextRef="balans0"
        unitRef="SEK" scale="0" decimals="0" format="ixt:numspacecomma">50 000</ix:nonFraction>`,
    }));
    expect(result).not.toBeNull();
    expect(result!.orgNumber).toBe("556017-2933");
    expect(result!.companyName).toBe("Test AB");
  });

  it("returns multiple periods", () => {
    const result = parseIxbrl(makeIxbrl({
      financials: `
        <ix:nonFraction name="se-gen-base:Nettoomsattning" contextRef="period0"
          unitRef="SEK" scale="0" decimals="0" format="ixt:numspacecomma">1 000 000</ix:nonFraction>
        <ix:nonFraction name="se-gen-base:Nettoomsattning" contextRef="period1"
          unitRef="SEK" scale="0" decimals="0" format="ixt:numspacecomma">800 000</ix:nonFraction>
      `,
    }));
    expect(result!.periods).toHaveLength(2);

    const p2023 = result!.periods.find(p => p.periodEnd === "2023-12-31");
    const p2022 = result!.periods.find(p => p.periodEnd === "2022-12-31");
    expect(p2023).toBeDefined();
    expect(p2022).toBeDefined();
    expect(p2023!.financials.find(f => f.metric === "Nettoomsattning")?.value).toBe(1_000_000);
    expect(p2022!.financials.find(f => f.metric === "Nettoomsattning")?.value).toBe(800_000);
  });

  it("extracts balance sheet from instant contexts", () => {
    const result = parseIxbrl(makeIxbrl({
      financials: `
        <ix:nonFraction name="se-gen-base:Tillgangar" contextRef="balans0"
          unitRef="SEK" scale="0" decimals="0" format="ixt:numspacecomma">5 000 000</ix:nonFraction>
        <ix:nonFraction name="se-gen-base:Tillgangar" contextRef="balans1"
          unitRef="SEK" scale="0" decimals="0" format="ixt:numspacecomma">4 000 000</ix:nonFraction>
      `,
    }));
    const p2023 = result!.periods.find(p => p.periodEnd === "2023-12-31");
    const p2022 = result!.periods.find(p => p.periodEnd === "2022-12-31");
    expect(p2023!.financials.find(f => f.metric === "Tillgangar")?.value).toBe(5_000_000);
    expect(p2022!.financials.find(f => f.metric === "Tillgangar")?.value).toBe(4_000_000);
  });

  it("mixes P&L and balance sheet for same period", () => {
    const result = parseIxbrl(makeIxbrl({
      financials: `
        <ix:nonFraction name="se-gen-base:Nettoomsattning" contextRef="period0"
          unitRef="SEK" scale="0" decimals="0" format="ixt:numspacecomma">1 000 000</ix:nonFraction>
        <ix:nonFraction name="se-gen-base:Tillgangar" contextRef="balans0"
          unitRef="SEK" scale="0" decimals="0" format="ixt:numspacecomma">5 000 000</ix:nonFraction>
      `,
    }));
    // Both share period end 2023-12-31 — should be in the same period
    expect(result!.periods).toHaveLength(1);
    const p = result!.periods[0];
    expect(p.financials).toHaveLength(2);
  });

  it("handles negative sign attribute", () => {
    const result = parseIxbrl(makeIxbrl({
      financials: `
        <ix:nonFraction name="se-gen-base:FinansiellaPoster" contextRef="period0"
          unitRef="SEK" scale="0" decimals="0" format="ixt:numspacecomma" sign="-">175 229</ix:nonFraction>
      `,
    }));
    expect(result!.periods[0].financials.find(f => f.metric === "FinansiellaPoster")?.value).toBe(-175_229);
  });

  it("prefers exact values over rounded (lower scale)", () => {
    const result = parseIxbrl(makeIxbrl({
      financials: `
        <ix:nonFraction name="se-gen-base:Nettoomsattning" contextRef="period0"
          unitRef="SEK" scale="3" decimals="-3" format="ixt:numspacecomma">101 763</ix:nonFraction>
        <ix:nonFraction name="se-gen-base:Nettoomsattning" contextRef="period0"
          unitRef="SEK" scale="0" decimals="0" format="ixt:numspacecomma">101 763 063</ix:nonFraction>
      `,
    }));
    expect(result!.periods[0].financials.find(f => f.metric === "Nettoomsattning")?.value).toBe(101_763_063);
  });

  it("uses majority vote when multiple inconsistent entries exist", () => {
    const result = parseIxbrl(makeIxbrl({
      financials: `
        <ix:nonFraction name="se-gen-base:AretsResultatEgetKapital" contextRef="balans0"
          unitRef="SEK" scale="0" decimals="0" format="ixt:numspacecomma">4 333 792</ix:nonFraction>
        <ix:nonFraction name="se-gen-base:AretsResultatEgetKapital" contextRef="balans0"
          unitRef="SEK" scale="0" decimals="0" format="ixt:numspacecomma">4 333 792 405</ix:nonFraction>
        <ix:nonFraction name="se-gen-base:AretsResultatEgetKapital" contextRef="balans0"
          unitRef="SEK" scale="3" decimals="0" format="ixt:numspacecomma">4 333 792</ix:nonFraction>
      `,
    }));
    const v = result!.periods[0].financials.find(f => f.metric === "AretsResultatEgetKapital")?.value;
    expect(v).toBeGreaterThan(1e9);
  });

  it("rejects impossible employee counts", () => {
    const result = parseIxbrl(makeIxbrl({
      financials: `
        <ix:nonFraction name="se-gen-base:Aktiekapital" contextRef="balans0"
          unitRef="SEK" scale="0" decimals="0" format="ixt:numspacecomma">50 000</ix:nonFraction>
        <ix:nonFraction name="se-gen-base:MedelantaletAnstallda" contextRef="period0"
          unitRef="antal-anstallda" scale="0" decimals="INF" format="ixt:numspacecomma">20220301</ix:nonFraction>
      `,
    }));
    const p = result!.periods.find(p => p.periodEnd === "2023-12-31")!;
    expect(p.financials.find(f => f.metric === "MedelantaletAnstallda")).toBeUndefined();
  });

  it("rejects negative employees", () => {
    const result = parseIxbrl(makeIxbrl({
      financials: `
        <ix:nonFraction name="se-gen-base:Aktiekapital" contextRef="balans0"
          unitRef="SEK" scale="0" decimals="0" format="ixt:numspacecomma">50 000</ix:nonFraction>
        <ix:nonFraction name="se-gen-base:MedelantaletAnstallda" contextRef="period0"
          unitRef="antal-anstallda" scale="0" decimals="INF" format="ixt:numspacecomma" sign="-">50</ix:nonFraction>
      `,
    }));
    const p = result!.periods.find(p => p.periodEnd === "2023-12-31")!;
    expect(p.financials.find(f => f.metric === "MedelantaletAnstallda")).toBeUndefined();
  });

  it("accepts reasonable employee counts", () => {
    const result = parseIxbrl(makeIxbrl({
      financials: `
        <ix:nonFraction name="se-gen-base:MedelantaletAnstallda" contextRef="period0"
          unitRef="antal-anstallda" scale="0" decimals="INF" format="ixt:numspacecomma">6620</ix:nonFraction>
      `,
    }));
    expect(result!.periods[0].financials.find(f => f.metric === "MedelantaletAnstallda")?.value).toBe(6620);
  });

  it("rejects impossibly large SEK values", () => {
    const result = parseIxbrl(makeIxbrl({
      financials: `
        <ix:nonFraction name="se-gen-base:Aktiekapital" contextRef="balans0"
          unitRef="SEK" scale="0" decimals="0" format="ixt:numspacecomma">50 000</ix:nonFraction>
        <ix:nonFraction name="se-gen-base:ForslagDispositionBalanserasINyRakning" contextRef="balans0"
          unitRef="SEK" scale="0" decimals="0" format="ixt:numspacecomma">2652376242183258284</ix:nonFraction>
      `,
    }));
    const p = result!.periods[0];
    expect(p.financials.find(f => f.metric === "ForslagDispositionBalanserasINyRakning")).toBeUndefined();
  });

  it("extracts people from tuple-based signatures", () => {
    const result = parseIxbrl(makeIxbrl({
      financials: `<ix:nonFraction name="se-gen-base:Aktiekapital" contextRef="balans0"
        unitRef="SEK" scale="0" decimals="0" format="ixt:numspacecomma">50 000</ix:nonFraction>`,
      people: `
        <ix:tuple name="se-gaap-ext:UnderskriftArsredovisningForetradareTuple" tupleID="Underskrift_1" />
        <ix:nonNumeric name="se-gen-base:UnderskriftHandlingTilltalsnamn" contextRef="period0" tupleRef="Underskrift_1">Anna</ix:nonNumeric>
        <ix:nonNumeric name="se-gen-base:UnderskriftHandlingEfternamn" contextRef="period0" tupleRef="Underskrift_1">Svensson</ix:nonNumeric>
        <ix:nonNumeric name="se-gen-base:UnderskriftHandlingRoll" contextRef="period0" tupleRef="Underskrift_1">Styrelseledamot</ix:nonNumeric>
      `,
    }));
    expect(result!.people).toHaveLength(1);
    expect(result!.people[0]).toEqual({ firstName: "Anna", lastName: "Svensson", role: "Styrelseledamot" });
  });

  it("extracts text content", () => {
    const result = parseIxbrl(makeIxbrl({
      financials: `<ix:nonFraction name="se-gen-base:Aktiekapital" contextRef="balans0"
        unitRef="SEK" scale="0" decimals="0" format="ixt:numspacecomma">50 000</ix:nonFraction>`,
      texts: `
        <ix:nonNumeric name="se-gen-base:AllmantVerksamheten" contextRef="period0">
          Bolaget bedriver handel med elektronik och tillbehör.
        </ix:nonNumeric>
      `,
    }));
    expect(result!.texts).toHaveLength(1);
    expect(result!.texts[0].field).toBe("verksamhet");
  });

  it("returns null for missing org number", () => {
    expect(parseIxbrl(`<html><body></body></html>`)).toBeNull();
  });

  it("periods are sorted chronologically", () => {
    const result = parseIxbrl(makeIxbrl({
      financials: `
        <ix:nonFraction name="se-gen-base:Nettoomsattning" contextRef="period0"
          unitRef="SEK" scale="0" decimals="0" format="ixt:numspacecomma">200</ix:nonFraction>
        <ix:nonFraction name="se-gen-base:Nettoomsattning" contextRef="period1"
          unitRef="SEK" scale="0" decimals="0" format="ixt:numspacecomma">100</ix:nonFraction>
      `,
    }));
    expect(result!.periods[0].periodEnd).toBe("2022-12-31");
    expect(result!.periods[1].periodEnd).toBe("2023-12-31");
  });

  it("handles empty financial text as dash", () => {
    const result = parseIxbrl(makeIxbrl({
      financials: `
        <ix:nonFraction name="se-gen-base:Nettoomsattning" contextRef="period0"
          unitRef="SEK" scale="0" decimals="0" format="ixt:numspacecomma">-</ix:nonFraction>
      `,
    }));
    // period0 has no parseable data, but period1 doesn't have any data either
    // So result might have 0 periods
    expect(result).toBeNull();
  });
});
