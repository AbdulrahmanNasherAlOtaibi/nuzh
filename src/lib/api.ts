export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    credentials: "same-origin",
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || "حدث خطأ غير متوقع");
  return data as T;
}

export const get = <T = any>(path: string) => api<T>(path);
export const post = <T = any>(path: string, body?: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) });
export const put = <T = any>(path: string, body?: unknown) =>
  api<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) });
export const del = <T = any>(path: string) => api<T>(path, { method: "DELETE" });

export const SAR = (n: number) => `${Math.round(n).toLocaleString("en")} ر.س`;

export const CATEGORIES: { key: string; ar: string; en: string; icon: string }[] = [
  { key: "eco", ar: "بيئية", en: "Eco", icon: "🌿" },
  { key: "culture", ar: "ثقافية", en: "Culture", icon: "🏛️" },
  { key: "fun", ar: "ترفيهية", en: "Fun", icon: "🎉" },
  { key: "adventure", ar: "مغامرات", en: "Adventure", icon: "🧗" },
  { key: "guided", ar: "مع مرشد سياحي", en: "With a guide", icon: "🧭" },
];
export const catLabel = (key: string, lang: string) =>
  CATEGORIES.find((c) => c.key === key)?.[lang === "en" ? "en" : "ar"] || key;

export const AWARENESS: { key: string; ar: string; en: string; icon: string }[] = [
  { key: "article", ar: "المقالات", en: "Articles", icon: "📖" },
  { key: "snapshot", ar: "اللقطات", en: "Snapshots", icon: "📸" },
  { key: "report", ar: "تقارير المحميات", en: "Reserve reports", icon: "📊" },
  { key: "behavior", ar: "السلوك البيئي الصحيح", en: "Eco etiquette", icon: "♻️" },
];

export function fmtDate(d: string, lang = "ar") {
  if (!d) return "";
  try {
    return new Intl.DateTimeFormat(lang === "en" ? "en" : "ar", {
      day: "numeric", month: "long", year: "numeric", calendar: "gregory",
    }).format(new Date(d));
  } catch {
    return d;
  }
}
