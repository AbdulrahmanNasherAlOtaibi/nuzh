import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { get, post } from "../lib/api";
import { useApp } from "../lib/store";
import { Icon, Logo, Spinner, StatCard, LineChart, BarChart } from "../components/ui";
import { CompaniesSection, UsersSection, BookingsSection } from "./ops";
import { FinanceSection, QualitySection, ContentSection, PromotionsSection } from "./biz";
import { ReportsSection, SettingsSection } from "./meta";

export const SECTIONS = [
  { key: "dashboard", label: "لوحة المعلومات", icon: "chart" },
  { key: "companies", label: "إدارة الشركات", icon: "building" },
  { key: "users", label: "إدارة المستخدمين", icon: "users" },
  { key: "bookings", label: "إدارة الحجوزات", icon: "ticket" },
  { key: "finance", label: "الإيرادات والمالية", icon: "wallet" },
  { key: "quality", label: "التقييمات والشكاوى", icon: "star" },
  { key: "content", label: "المحتوى والرحلات", icon: "map" },
  { key: "promotions", label: "الترويجات والعروض", icon: "gift" },
  { key: "reports", label: "التقارير والتحليلات", icon: "doc" },
  { key: "settings", label: "الإعدادات والأمان", icon: "cog" },
];

/* جدول عام قابل لإعادة الاستخدام */
export function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="text-[11px] opacity-55 border-b border-sand-200 dark:border-night-600/50">
            {headers.map((h) => <th key={h} className="text-start font-extrabold px-3.5 py-2.5 whitespace-nowrap">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={headers.length} className="text-center py-8 opacity-50 font-bold text-xs">لا توجد بيانات</td></tr>
          )}
          {rows.map((cells, i) => (
            <tr key={i} className="border-b border-sand-200/60 dark:border-night-600/30 last:border-0 hover:bg-gold-500/5">
              {cells.map((c, j) => <td key={j} className="px-3.5 py-2.5 font-bold text-xs whitespace-nowrap">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SectionHead({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
      <div>
        <h1 className="font-black text-xl">{title}</h1>
        {sub && <p className="text-xs font-bold opacity-50 mt-0.5">{sub}</p>}
      </div>
      <div className="flex gap-2 flex-wrap">{children}</div>
    </div>
  );
}

const MONTH_AR = ["ينا", "فبر", "مار", "أبر", "ماي", "يون", "يول", "أغس", "سبت", "أكت", "نوف", "ديس"];
export const monthLabel = (m: string) => MONTH_AR[Number(m.slice(5, 7)) - 1] || m;

/* 1️⃣ لوحة المعلومات */
function Dashboard() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { get("/admin/overview").then(setData).catch(() => {}); }, []);
  if (!data) return <Spinner />;
  const k = data.kpis;
  return (
    <div>
      <SectionHead title="لوحة المعلومات" sub="ملخص سريع لحالة المنصة" />
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard icon="building" label="الشركات النشطة" value={k.activeCompanies} />
        <StatCard icon="users" label="إجمالي المستخدمين" value={k.totalUsers} tone="blue" />
        <StatCard icon="ticket" label="حجوزات هذا الشهر" value={k.bookingsThisMonth} tone="green" />
        <StatCard icon="wallet" label="الإيرادات الإجمالية" value={`${k.totalRevenue.toLocaleString("en")} ر.س`} />
        <StatCard icon="star" label="معدل الرضا العام" value={`${k.satisfaction} / 5`} tone="amber" />
        <StatCard icon="bell" label="الشكاوى المعلقة" value={k.pendingComplaints} tone="red" />
      </div>

      <div className="grid lg:grid-cols-2 gap-3 mt-3">
        <div className="card p-4">
          <h3 className="font-extrabold text-sm mb-3">اتجاه الحجوزات (آخر 12 شهر)</h3>
          <LineChart data={data.bookingsTrend.map((x: any) => ({ label: monthLabel(x.m), value: x.c }))} color="#4CAF50" />
        </div>
        <div className="card p-4">
          <h3 className="font-extrabold text-sm mb-3">توزيع الإيرادات حسب الشركة</h3>
          <BarChart data={data.revenueByCompany.map((x: any) => ({ label: x.name.slice(0, 8), value: x.s }))} />
        </div>
      </div>

      <div className="card p-4 mt-3">
        <h3 className="font-extrabold text-sm mb-3">نمو المستخدمين الجدد</h3>
        <BarChart data={data.usersTrend.map((x: any) => ({ label: monthLabel(x.m), value: x.c }))} color="#2196F3" height={110} />
      </div>

      <div className="grid lg:grid-cols-3 gap-3 mt-3">
        {[
          { title: "آخر الشركات المضافة", rows: data.recentCompanies.map((c: any) => [c.type === "company" ? "🏢" : "🧭", c.name, c.status === "active" ? "نشطة" : c.status === "pending" ? "قيد المراجعة" : c.status]) },
          { title: "آخر الحجوزات", rows: data.recentBookings.map((b: any) => ["🎫", `${b.user_name} — ${b.title}`, `${b.total} ر.س`]) },
          { title: "آخر الشكاوى", rows: data.recentComplaints.map((c: any) => ["⚠️", `${c.user_name} — ${c.type}`, c.priority === "high" ? "عالية" : c.priority === "medium" ? "متوسطة" : "منخفضة"]) },
        ].map((box) => (
          <div key={box.title} className="card p-4">
            <h3 className="font-extrabold text-sm mb-2.5">{box.title}</h3>
            <div className="space-y-2">
              {box.rows.map((r: any[], i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs font-bold">
                  <span>{r[0]}</span>
                  <span className="flex-1 truncate opacity-75">{r[1]}</span>
                  <span className="opacity-50 text-[10px]">{r[2]}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* شاشة دخول الأدمن */
function AdminLogin() {
  const { refresh, toast } = useApp();
  const [f, setF] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await post("/auth/login", f);
      await refresh();
    } catch (e: any) { toast(e.message, "err"); }
    finally { setBusy(false); }
  };
  return (
    <div className="min-h-dvh flex items-center justify-center px-4">
      <div className="card p-6 w-full max-w-sm text-center">
        <div className="flex justify-center"><Logo size={70} /></div>
        <h1 className="font-black text-lg mt-2">لوحة تحكم نزهة</h1>
        <p className="text-xs font-bold opacity-50 mb-5">الدخول للمشرفين فقط</p>
        <div className="space-y-3 text-start">
          <div><span className="label">الإيميل</span><input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className="input" dir="ltr" /></div>
          <div><span className="label">كلمة المرور</span><input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className="input" dir="ltr" onKeyDown={(e) => e.key === "Enter" && submit()} /></div>
          <button onClick={submit} disabled={busy} className="btn-gold w-full py-3">{busy ? "لحظات…" : "دخول"}</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminApp() {
  const { user, loaded, logout } = useApp();
  const [loc, nav] = useLocation();
  const section = loc.split("/")[2] || "dashboard";

  if (!loaded) return <Spinner />;
  if (!user || user.role !== "admin") return <AdminLogin />;

  const Body = {
    dashboard: Dashboard,
    companies: CompaniesSection,
    users: UsersSection,
    bookings: BookingsSection,
    finance: FinanceSection,
    quality: QualitySection,
    content: ContentSection,
    promotions: PromotionsSection,
    reports: ReportsSection,
    settings: SettingsSection,
  }[section] || Dashboard;

  return (
    <div className="min-h-dvh flex">
      {/* الشريط الجانبي */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 border-e border-sand-200 dark:border-night-700/60 bg-white/60 dark:bg-night-900/60 sticky top-0 h-dvh">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <Logo size={40} />
          <div>
            <div className="font-black text-sm">نُزهة</div>
            <div className="text-[10px] font-bold opacity-50">لوحة التحكم</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2.5 space-y-1">
          {SECTIONS.map((s) => (
            <button key={s.key} onClick={() => nav(`/admin/${s.key}`)}
              className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-extrabold transition ${
                section === s.key ? "bg-gold-500/15 text-gold-700 dark:text-gold-300 border border-gold-500/40" : "opacity-60 hover:opacity-100"
              }`}>
              <Icon name={s.icon} size={17} /> {s.label}
            </button>
          ))}
        </nav>
        <div className="p-2.5 space-y-1 border-t border-sand-200 dark:border-night-700/60">
          <button onClick={() => nav("/")} className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-extrabold opacity-60 hover:opacity-100">
            <Icon name="compass" size={17} /> العودة للموقع
          </button>
          <button onClick={async () => { await logout(); nav("/"); }} className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-extrabold text-red-500">
            <Icon name="logout" size={17} /> تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* المحتوى */}
      <main className="flex-1 min-w-0">
        {/* شريط علوي للجوال */}
        <div className="md:hidden sticky top-0 z-40 bg-sand-50/95 dark:bg-night-950/95 backdrop-blur border-b border-sand-200 dark:border-night-700/60">
          <div className="flex items-center gap-2 px-3 py-2">
            <Logo size={34} />
            <span className="font-black text-sm flex-1">لوحة التحكم</span>
            <button onClick={() => nav("/")} className="text-[11px] font-black text-gold-600 dark:text-gold-400">الموقع ←</button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-3 pb-2">
            {SECTIONS.map((s) => (
              <button key={s.key} onClick={() => nav(`/admin/${s.key}`)}
                className={`chip !py-1.5 text-[11px] ${section === s.key ? "chip-active" : ""}`}>{s.label}</button>
            ))}
          </div>
        </div>
        <div className="p-4 lg:p-6 max-w-7xl">
          <Body />
        </div>
      </main>
    </div>
  );
}
