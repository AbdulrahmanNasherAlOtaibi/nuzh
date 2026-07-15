import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { get, post } from "./api";

export type Lang = "ar" | "en";
export type Theme = "dark" | "light" | "system";

export interface User {
  id: number; name: string; email: string; phone: string; role: string;
  avatar: string; city: string; gender: string; mustChangePassword?: boolean;
  totpEnabled?: boolean;
}
export interface ProviderInfo { id: number; type: string; name: string; status: string }

const DICT: Record<string, { ar: string; en: string }> = {
  home: { ar: "الرئيسية", en: "Home" },
  explore: { ar: "استكشف", en: "Explore" },
  map: { ar: "الخريطة", en: "Map" },
  myTrips: { ar: "رحلاتي", en: "My Trips" },
  account: { ar: "حسابي", en: "Account" },
  help: { ar: "مساعدة", en: "Help" },
  login: { ar: "تسجيل الدخول", en: "Sign in" },
  logout: { ar: "تسجيل الخروج", en: "Sign out" },
  welcome: { ar: "مرحباً", en: "Welcome" },
  guest: { ar: "زائر", en: "Guest" },
  mainCategories: { ar: "التصنيفات الرئيسية", en: "Main categories" },
  ecoAwareness: { ar: "التوعية البيئية", en: "Eco awareness" },
  lovedTrips: { ar: "رحلات يحبها الضيوف", en: "Guest favorites" },
  topRated: { ar: "أعلى الرحلات تقييماً لدينا", en: "Top rated trips" },
  weekendOffers: { ar: "عروض نهاية الأسبوع", en: "Weekend offers" },
  viewAll: { ar: "عرض الكل", en: "View all" },
  exploreTrips: { ar: "استكشف الرحلات", en: "Explore trips" },
  partners: { ar: "شركاء النجاح بعد توفيق الله", en: "Our success partners" },
  startsFrom: { ar: "يبدأ من", en: "From" },
  book: { ar: "حجز", en: "Book" },
  bookNow: { ar: "احجز الآن", en: "Book now" },
  mostBooked: { ar: "الأكثر طلباً", en: "Most booked" },
  featured: { ar: "مميز", en: "Featured" },
  upcoming: { ar: "القادمة", en: "Upcoming" },
  past: { ar: "السابقة", en: "Past" },
  stats: { ar: "الإحصائيات", en: "Stats" },
  permits: { ar: "التصاريح", en: "Permits" },
  achievements: { ar: "الإنجازات", en: "Achievements" },
  settings: { ar: "الإعدادات", en: "Settings" },
  profile: { ar: "الملف الشخصي", en: "Profile" },
  appearance: { ar: "المظهر", en: "Appearance" },
  darkMode: { ar: "داكن", en: "Dark" },
  lightMode: { ar: "فاتح", en: "Light" },
  systemMode: { ar: "حسب الجوال", en: "System" },
  language: { ar: "اللغة", en: "Language" },
  contact: { ar: "التواصل", en: "Contact" },
  learnMore: { ar: "لمعرفة المزيد", en: "Learn more" },
  aboutNuzh: { ar: "عن نُزه", en: "About Nuzh" },
  faq: { ar: "الأسئلة الشائعة", en: "FAQ" },
  userGuide: { ar: "دليل المستخدم", en: "User guide" },
  providerPortal: { ar: "بوابة مزودي الخدمة", en: "Provider portal" },
  planNewTrip: { ar: "خطط رحلة جديدة", en: "Plan a new trip" },
  mapTitle: { ar: "خريطة مناطق التنزه في المملكة", en: "Kingdom picnic areas map" },
  myLocation: { ar: "موقعي", en: "Me" },
  allowed: { ar: "مسموح", en: "Allowed" },
  permitNeeded: { ar: "تصريح", en: "Permit" },
  forbidden: { ar: "ممنوع", en: "Forbidden" },
  search: { ar: "ابحث عن رحلة أو وجهة…", en: "Search trips…" },
  all: { ar: "الكل", en: "All" },
};

interface Ctx {
  user: User | null;
  provider: ProviderInfo | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  lang: Lang;
  setLang: (l: Lang) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  t: (key: string) => string;
  toast: (msg: string, kind?: "ok" | "err") => void;
  toastState: { msg: string; kind: "ok" | "err" } | null;
  loaded: boolean;
}

const AppCtx = createContext<Ctx>(null as any);
export const useApp = () => useContext(AppCtx);

function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.classList.toggle("light", !dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#12291b" : "#faf6ec");
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [provider, setProvider] = useState<ProviderInfo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem("nuzh_lang") as Lang) || "ar");
  const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem("nuzh_theme") as Theme) || "dark");
  const [toastState, setToastState] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);

  const refresh = async () => {
    try {
      const data = await get("/auth/me");
      setUser(data.user);
      setProvider(data.provider);
    } catch {
      setUser(null);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("nuzh_theme", theme);
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const fn = () => applyTheme("system");
      mq.addEventListener("change", fn);
      return () => mq.removeEventListener("change", fn);
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    localStorage.setItem("nuzh_lang", lang);
  }, [lang]);

  const value = useMemo<Ctx>(
    () => ({
      user, provider, refresh, loaded,
      logout: async () => { await post("/auth/logout"); setUser(null); setProvider(null); },
      lang,
      setLang: setLangState,
      theme,
      setTheme: setThemeState,
      t: (key: string) => DICT[key]?.[lang] ?? key,
      toast: (msg, kind = "ok") => {
        setToastState({ msg, kind });
        setTimeout(() => setToastState(null), 2600);
      },
      toastState,
    }),
    [user, provider, lang, theme, toastState, loaded]
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
