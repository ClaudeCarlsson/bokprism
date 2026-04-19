export interface Company {
  org_number: string;
  name: string;
}

export interface Filing {
  id: number;
  org_number: string;
  period_start: string;
  period_end: string;
  currency: string;
  source_file: string;
}

export interface Person {
  id: number;
  first_name: string;
  last_name: string;
}

export interface CompanyRole {
  person_id: number;
  first_name: string;
  last_name: string;
  role: string;
  filing_period_end: string;
}

export interface FinancialHistory {
  period_end: string;
  metrics: Record<string, number>;
}

export interface CompanyDetail {
  company: Company;
  filings: Filing[];
  latestFinancials: Record<string, number>;
  history: FinancialHistory[];
  texts: Record<string, string>;
}

export interface PersonWithCompanies {
  person: Person;
  companies: {
    org_number: string;
    name: string;
    role: string;
    period_end: string;
  }[];
}

export interface SearchResult {
  org_number: string;
  name: string;
  latest_revenue: number | null;
  latest_profit: number | null;
  latest_period: string | null;
  filing_count: number;
}

export interface RankingEntry {
  org_number: string;
  name: string;
  value: number;
  period_end: string;
}

export interface SiteStats {
  total_companies: number;
  total_filings: number;
  total_data_points: number;
  total_people: number;
  years_covered: string;
}

// Taxonomy mapping: XBRL tag name → Swedish label, English label, category
export interface MetricMeta {
  sv: string;
  en: string;
  category: "income" | "balance_asset" | "balance_equity" | "balance_liability" | "ratio" | "other";
  // Display unit. Defaults to SEK when omitted.
  unit?: "SEK" | "percent" | "count";
  isSubtotal?: boolean;
}

export const METRIC_TAXONOMY: Record<string, MetricMeta> = {
  // Income Statement
  Nettoomsattning: { sv: "Nettoomsättning", en: "Net Revenue", category: "income" },
  RorelseintakterLagerforandringarMm: { sv: "Omsättning", en: "Revenue", category: "income", isSubtotal: true },
  HandelsvarorKostnader: { sv: "Handelsvaror", en: "Cost of Goods Sold", category: "income" },
  OvrigaExternaKostnader: { sv: "Övriga externa kostnader", en: "Other External Costs", category: "income" },
  Personalkostnader: { sv: "Personalkostnader", en: "Personnel Costs", category: "income" },
  AvskrivningarNedskrivningarMateriellaImmateriellaAnlaggningstillgangar: { sv: "Avskrivningar", en: "Depreciation & Amortization", category: "income" },
  OvrigaRorelsekostnader: { sv: "Övriga rörelsekostnader", en: "Other Operating Costs", category: "income" },
  Rorelsekostnader: { sv: "Rörelsekostnader", en: "Total Operating Costs", category: "income", isSubtotal: true },
  Rorelseresultat: { sv: "Rörelseresultat", en: "Operating Profit (EBIT)", category: "income", isSubtotal: true },
  OvrigaRanteintakterLiknandeResultatposter: { sv: "Ränteintäkter", en: "Interest Income", category: "income" },
  RantekostnaderLiknandeResultatposter: { sv: "Räntekostnader", en: "Interest Expense", category: "income" },
  FinansiellaPoster: { sv: "Finansnetto", en: "Net Financial Items", category: "income", isSubtotal: true },
  ResultatEfterFinansiellaPoster: { sv: "Resultat efter finansiella poster", en: "Profit After Financial Items", category: "income", isSubtotal: true },
  Bokslutsdispositioner: { sv: "Bokslutsdispositioner", en: "Appropriations", category: "income" },
  ResultatForeSkatt: { sv: "Resultat före skatt", en: "Profit Before Tax", category: "income", isSubtotal: true },
  SkattAretsResultat: { sv: "Skatt", en: "Tax", category: "income" },
  AretsResultat: { sv: "Årets resultat", en: "Net Income", category: "income", isSubtotal: true },

  // Balance Sheet — Assets
  ByggnaderMark: { sv: "Byggnader och mark", en: "Buildings & Land", category: "balance_asset" },
  MaskinerAndraTekniskaAnlaggningar: { sv: "Maskiner", en: "Machinery", category: "balance_asset" },
  InventarierVerktygInstallationer: { sv: "Inventarier", en: "Equipment", category: "balance_asset" },
  MateriellaAnlaggningstillgangar: { sv: "Materiella anläggningstillgångar", en: "Tangible Fixed Assets", category: "balance_asset", isSubtotal: true },
  AndelarKoncernforetag: { sv: "Andelar i koncernföretag", en: "Shares in Group Companies", category: "balance_asset" },
  FinansiellaAnlaggningstillgangar: { sv: "Finansiella anläggningstillgångar", en: "Financial Fixed Assets", category: "balance_asset", isSubtotal: true },
  Anlaggningstillgangar: { sv: "Anläggningstillgångar", en: "Total Fixed Assets", category: "balance_asset", isSubtotal: true },
  VarulagerMm: { sv: "Varulager", en: "Inventory", category: "balance_asset" },
  Kundfordringar: { sv: "Kundfordringar", en: "Accounts Receivable", category: "balance_asset" },
  KortfristigaFordringar: { sv: "Kortfristiga fordringar", en: "Short-term Receivables", category: "balance_asset", isSubtotal: true },
  KassaBankExklRedovisningsmedel: { sv: "Kassa och bank", en: "Cash & Bank", category: "balance_asset" },
  Omsattningstillgangar: { sv: "Omsättningstillgångar", en: "Total Current Assets", category: "balance_asset", isSubtotal: true },
  Tillgangar: { sv: "Summa tillgångar", en: "Total Assets", category: "balance_asset", isSubtotal: true },

  // Balance Sheet — Equity
  Aktiekapital: { sv: "Aktiekapital", en: "Share Capital", category: "balance_equity" },
  Reservfond: { sv: "Reservfond", en: "Reserve Fund", category: "balance_equity" },
  BalanseratResultat: { sv: "Balanserat resultat", en: "Retained Earnings", category: "balance_equity" },
  AretsResultatEgetKapital: { sv: "Årets resultat", en: "Net Income (Equity)", category: "balance_equity" },
  BundetEgetKapital: { sv: "Bundet eget kapital", en: "Restricted Equity", category: "balance_equity", isSubtotal: true },
  FrittEgetKapital: { sv: "Fritt eget kapital", en: "Free Equity", category: "balance_equity", isSubtotal: true },
  EgetKapital: { sv: "Eget kapital", en: "Total Equity", category: "balance_equity", isSubtotal: true },
  ObeskattadeReserver: { sv: "Obeskattade reserver", en: "Untaxed Reserves", category: "balance_liability" },

  // Balance Sheet — Liabilities
  LangfristigaSkulder: { sv: "Långfristiga skulder", en: "Long-term Liabilities", category: "balance_liability", isSubtotal: true },
  Leverantorsskulder: { sv: "Leverantörsskulder", en: "Accounts Payable", category: "balance_liability" },
  Skatteskulder: { sv: "Skatteskulder", en: "Tax Liabilities", category: "balance_liability" },
  KortfristigaSkulder: { sv: "Kortfristiga skulder", en: "Short-term Liabilities", category: "balance_liability", isSubtotal: true },
  EgetKapitalSkulder: { sv: "Summa eget kapital och skulder", en: "Total Equity & Liabilities", category: "balance_liability", isSubtotal: true },

  // Ratios
  Soliditet: { sv: "Soliditet", en: "Equity Ratio", category: "ratio", unit: "percent" },
  MedelantaletAnstallda: { sv: "Medelantal anställda", en: "Average Employees", category: "ratio", unit: "count" },
};

// Key metrics to show in overview cards — matches Swedish standard
// (Allabolag/UC use RorelseintakterLagerforandringarMm as "Omsättning"
// and ResultatEfterFinansiellaPoster as headline profit)
export const KEY_METRICS = [
  "RorelseintakterLagerforandringarMm",
  "ResultatEfterFinansiellaPoster",
  "AretsResultat",
  "Tillgangar",
  "EgetKapital",
  "KortfristigaSkulder",
  "Soliditet",
  "MedelantaletAnstallda",
] as const;

// Metrics for ranking
export const RANKABLE_METRICS = [
  { key: "RorelseintakterLagerforandringarMm", label: "Omsättning" },
  { key: "ResultatEfterFinansiellaPoster", label: "Resultat" },
  { key: "AretsResultat", label: "Nettoresultat" },
  { key: "Tillgangar", label: "Tillgångar" },
  { key: "EgetKapital", label: "Eget kapital" },
  { key: "MedelantaletAnstallda", label: "Anställda" },
  { key: "Rorelseresultat", label: "Rörelseresultat" },
  { key: "Soliditet", label: "Soliditet" },
] as const;
