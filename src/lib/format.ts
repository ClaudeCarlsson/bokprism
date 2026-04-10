export function formatSEK(value: number | null | undefined): string {
  if (value == null) return "–";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)} mdr`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)} mkr`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)} tkr`;
  return `${sign}${abs.toFixed(0)} kr`;
}

export function formatSEKFull(value: number | null | undefined): string {
  if (value == null) return "–";
  return new Intl.NumberFormat("sv-SE", {
    style: "decimal",
    maximumFractionDigits: 0,
  }).format(value) + " kr";
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) return "–";
  return `${(value * 100).toFixed(1)}%`;
}

export function formatCount(value: number | null | undefined): string {
  if (value == null) return "–";
  return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(value);
}

export function formatMetricValue(value: number | null | undefined, unit: string): string {
  if (value == null) return "–";
  switch (unit) {
    case "percent":
      return formatPercent(value);
    case "count":
      return formatCount(value);
    default:
      return formatSEK(value);
  }
}

export function formatOrgNumber(orgNumber: string): string {
  // Ensure format: 556070-1715
  const clean = orgNumber.replace(/\D/g, "");
  if (clean.length === 10) {
    return `${clean.slice(0, 6)}-${clean.slice(6)}`;
  }
  return orgNumber;
}

export function formatPeriod(periodEnd: string): string {
  // "2024-12-31" → "2024"
  // "2024-06-30" → "2023/24" (broken fiscal year)
  const [year, month] = periodEnd.split("-").map(Number);
  if (month === 12) return `${year}`;
  // Broken fiscal year: show as YYYY/YY
  return `${year - 1}/${String(year).slice(2)}`;
}

export function formatDateShort(date: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "short",
  }).format(new Date(date));
}

export function trendDirection(current: number | null, previous: number | null): "up" | "down" | "flat" | null {
  if (current == null || previous == null) return null;
  if (previous === 0) return current > 0 ? "up" : current < 0 ? "down" : "flat";
  const change = (current - previous) / Math.abs(previous);
  if (change > 0.01) return "up";
  if (change < -0.01) return "down";
  return "flat";
}

export function trendPercent(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}
