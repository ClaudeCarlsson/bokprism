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
}: {
  orgNumber?: string;
  companyName?: string;
  periodStart?: string;
  periodEnd?: string;
  financials?: string;
  people?: string;
  texts?: string;
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
    const result = parseIxbrl(makeIxbrl());
    expect(result).not.toBeNull();
    expect(result!.orgNumber).toBe("556017-2933");
    expect(result!.companyName).toBe("Test AB");
    expect(result!.periodStart).toBe("2023-01-01");
    expect(result!.periodEnd).toBe("2023-12-31");
  });

  it("extracts financial values with scale=0", () => {
    const result = parseIxbrl(makeIxbrl({
      financials: `
        <ix:nonFraction name="se-gen-base:Nettoomsattning" contextRef="period0"
          unitRef="SEK" scale="0" decimals="0" format="ixt:numspacecomma">1 000 000</ix:nonFraction>
      `,
    }));
    expect(result!.financials.find(f => f.metric === "Nettoomsattning")?.value).toBe(1_000_000);
  });

  it("extracts financial values with scale=3 (thousands)", () => {
    const result = parseIxbrl(makeIxbrl({
      financials: `
        <ix:nonFraction name="se-gen-base:Nettoomsattning" contextRef="period0"
          unitRef="SEK" scale="3" decimals="-3" format="ixt:numspacecomma">1 000</ix:nonFraction>
      `,
    }));
    expect(result!.financials.find(f => f.metric === "Nettoomsattning")?.value).toBe(1_000_000);
  });

  it("handles negative sign attribute", () => {
    const result = parseIxbrl(makeIxbrl({
      financials: `
        <ix:nonFraction name="se-gen-base:FinansiellaPoster" contextRef="period0"
          unitRef="SEK" scale="0" decimals="0" format="ixt:numspacecomma" sign="-">175 229</ix:nonFraction>
      `,
    }));
    expect(result!.financials.find(f => f.metric === "FinansiellaPoster")?.value).toBe(-175_229);
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
    expect(result!.financials.find(f => f.metric === "Nettoomsattning")?.value).toBe(101_763_063);
  });

  it("uses majority vote when multiple inconsistent entries exist", () => {
    // Real case from Hexagon Smart Solutions: three entries, one is a filer error.
    // Two entries agree on 4.3B, one has a stray 4.3M. The majority value wins.
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
    const v = result!.financials.find(f => f.metric === "AretsResultatEgetKapital")?.value;
    // Two entries produce ~4.333B (the 4.333B scale=0 and 4.333B from scale=3)
    // One entry is the filer error at 4.333M
    // The majority (4.3B range) should win
    expect(v).toBeGreaterThan(1e9);
  });

  it("only extracts current period data", () => {
    const result = parseIxbrl(makeIxbrl({
      financials: `
        <ix:nonFraction name="se-gen-base:Nettoomsattning" contextRef="period0"
          unitRef="SEK" scale="0" decimals="0" format="ixt:numspacecomma">100 000</ix:nonFraction>
        <ix:nonFraction name="se-gen-base:Nettoomsattning" contextRef="period1"
          unitRef="SEK" scale="0" decimals="0" format="ixt:numspacecomma">80 000</ix:nonFraction>
      `,
    }));
    // Should only have one entry for the current period
    const revenues = result!.financials.filter(f => f.metric === "Nettoomsattning");
    expect(revenues).toHaveLength(1);
    expect(revenues[0].value).toBe(100_000);
  });

  it("extracts percent values correctly", () => {
    const result = parseIxbrl(makeIxbrl({
      financials: `
        <ix:nonFraction name="se-gen-base:Soliditet" contextRef="balans0"
          unitRef="procent" scale="-2" decimals="INF" format="ixt:numspacecomma">42</ix:nonFraction>
      `,
    }));
    const soliditet = result!.financials.find(f => f.metric === "Soliditet");
    expect(soliditet?.value).toBeCloseTo(0.42);
    expect(soliditet?.unit).toBe("percent");
  });

  it("extracts people from tuple-based signatures", () => {
    const result = parseIxbrl(makeIxbrl({
      people: `
        <ix:tuple name="se-gaap-ext:UnderskriftArsredovisningForetradareTuple" tupleID="Underskrift_1" />
        <ix:nonNumeric name="se-gen-base:UnderskriftHandlingTilltalsnamn" contextRef="period0" tupleRef="Underskrift_1">Anna</ix:nonNumeric>
        <ix:nonNumeric name="se-gen-base:UnderskriftHandlingEfternamn" contextRef="period0" tupleRef="Underskrift_1">Svensson</ix:nonNumeric>
        <ix:nonNumeric name="se-gen-base:UnderskriftHandlingRoll" contextRef="period0" tupleRef="Underskrift_1">Styrelseledamot</ix:nonNumeric>
      `,
    }));
    expect(result!.people).toHaveLength(1);
    expect(result!.people[0]).toEqual({
      firstName: "Anna",
      lastName: "Svensson",
      role: "Styrelseledamot",
    });
  });

  it("extracts text content", () => {
    const result = parseIxbrl(makeIxbrl({
      texts: `
        <ix:nonNumeric name="se-gen-base:AllmantVerksamheten" contextRef="period0">
          Bolaget bedriver handel med elektronik och tillbehör.
        </ix:nonNumeric>
      `,
    }));
    expect(result!.texts).toHaveLength(1);
    expect(result!.texts[0].field).toBe("verksamhet");
    expect(result!.texts[0].content).toContain("elektronik");
  });

  it("returns null for missing org number", () => {
    const html = `<html><body></body></html>`;
    expect(parseIxbrl(html)).toBeNull();
  });

  it("defaults to SEK currency", () => {
    const result = parseIxbrl(makeIxbrl());
    expect(result!.currency).toBe("SEK");
  });

  it("rejects impossible employee counts (filer errors)", () => {
    const result = parseIxbrl(makeIxbrl({
      financials: `
        <ix:nonFraction name="se-gen-base:MedelantaletAnstallda" contextRef="period0"
          unitRef="antal-anstallda" scale="0" decimals="INF" format="ixt:numspacecomma">20220301</ix:nonFraction>
      `,
    }));
    // 20M employees is clearly a filer error (looks like a date)
    expect(result!.financials.find(f => f.metric === "MedelantaletAnstallda")).toBeUndefined();
  });

  it("rejects negative employees", () => {
    const result = parseIxbrl(makeIxbrl({
      financials: `
        <ix:nonFraction name="se-gen-base:MedelantaletAnstallda" contextRef="period0"
          unitRef="antal-anstallda" scale="0" decimals="INF" format="ixt:numspacecomma" sign="-">50</ix:nonFraction>
      `,
    }));
    expect(result!.financials.find(f => f.metric === "MedelantaletAnstallda")).toBeUndefined();
  });

  it("accepts reasonable employee counts", () => {
    const result = parseIxbrl(makeIxbrl({
      financials: `
        <ix:nonFraction name="se-gen-base:MedelantaletAnstallda" contextRef="period0"
          unitRef="antal-anstallda" scale="0" decimals="INF" format="ixt:numspacecomma">6620</ix:nonFraction>
      `,
    }));
    expect(result!.financials.find(f => f.metric === "MedelantaletAnstallda")?.value).toBe(6620);
  });

  it("rejects impossibly large SEK values", () => {
    const result = parseIxbrl(makeIxbrl({
      financials: `
        <ix:nonFraction name="se-gen-base:ForslagDispositionBalanserasINyRakning" contextRef="balans0"
          unitRef="SEK" scale="0" decimals="0" format="ixt:numspacecomma">2652376242183258284</ix:nonFraction>
      `,
    }));
    expect(result!.financials.find(f => f.metric === "ForslagDispositionBalanserasINyRakning")).toBeUndefined();
  });

  it("rejects Soliditet outside reasonable bounds", () => {
    const result = parseIxbrl(makeIxbrl({
      financials: `
        <ix:nonFraction name="se-gen-base:Soliditet" contextRef="balans0"
          unitRef="procent" scale="3" decimals="-3" format="ixt:numspacecomma">29520523</ix:nonFraction>
      `,
    }));
    // 29.5 billion as a percent is clearly a filer error
    expect(result!.financials.find(f => f.metric === "Soliditet")).toBeUndefined();
  });

  it("handles empty financial text as dash", () => {
    const result = parseIxbrl(makeIxbrl({
      financials: `
        <ix:nonFraction name="se-gen-base:Nettoomsattning" contextRef="period0"
          unitRef="SEK" scale="0" decimals="0" format="ixt:numspacecomma">-</ix:nonFraction>
      `,
    }));
    // Should not include metrics that can't be parsed
    expect(result!.financials.find(f => f.metric === "Nettoomsattning")).toBeUndefined();
  });
});
