export function formatSEK(value: number | null | undefined): string {
  if (value == null) return "–";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)} mdr`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)} mkr`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)} tkr`;
  return `${sign}${abs.toFixed(0)} kr`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) return "–";
  return `${(value * 100).toFixed(1)}%`;
}

export function formatCount(value: number | null | undefined): string {
  if (value == null) return "–";
  return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(value);
}

export function formatOrgNumber(orgNumber: string): string {
  const clean = orgNumber.replace(/\D/g, "");
  if (clean.length === 10) {
    return `${clean.slice(0, 6)}-${clean.slice(6)}`;
  }
  return orgNumber;
}

export function formatPeriod(periodEnd: string | null | undefined): string {
  if (!periodEnd || periodEnd.length < 10) return "–";
  const [year, month] = periodEnd.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return "–";
  if (month === 12) return `${year}`;
  return `${year - 1}/${String(year).slice(2)}`;
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
