import { useLocation, Link } from "wouter";
import { useApp } from "../lib/store";
import { Icon, Logo } from "./ui";

export function Header() {
  const { user, t } = useApp();
  const [, nav] = useLocation();
  return (
    <header className="sticky top-0 z-[1000] bg-sand-50/90 dark:bg-night-950/90 backdrop-blur border-b border-sand-200 dark:border-night-700/60">
      <div className="max-w-3xl mx-auto flex items-center justify-between px-4 py-2.5">
        {/* يمين: تسجيل الدخول / الترحيب */}
        <button
          onClick={() => nav(user ? "/account" : "/auth")}
          className="flex items-center gap-2 rounded-2xl border border-gold-500/60 px-3 py-1.5 text-sm font-bold text-gold-700 dark:text-gold-300"
        >
          <span className="w-7 h-7 rounded-full bg-gold-500/20 flex items-center justify-center overflow-hidden">
            {user?.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : <Icon name="user" size={15} />}
          </span>
          <span className="max-w-[110px] truncate">{user ? `${t("welcome")}، ${user.name.split(" ")[0]}` : t("login")}</span>
        </button>

        {/* المنتصف: الشعار */}
        <Link href="/" className="flex flex-col items-center -my-1">
          <Logo size={46} />
        </Link>

        {/* يسار: مركز المساعدة */}
        <button
          onClick={() => nav("/help")}
          className="flex items-center gap-2 rounded-2xl border border-gold-500/60 px-3 py-1.5 text-sm font-bold text-gold-700 dark:text-gold-300"
        >
          <Icon name="shield" size={16} />
          <span>{t("help")}</span>
        </button>
      </div>
    </header>
  );
}

const NAV = [
  { href: "/", icon: "home", key: "home" },
  { href: "/explore", icon: "compass", key: "explore" },
  { href: "/map", icon: "map", key: "map" },
  { href: "/my-trips", icon: "trips", key: "myTrips" },
  { href: "/account", icon: "user", key: "account" },
];

export function BottomNav() {
  const [loc, nav] = useLocation();
  const { t } = useApp();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-[1000] bg-sand-50/85 dark:bg-night-950/85 backdrop-blur border-t border-sand-200 dark:border-night-700/60 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-3xl mx-auto grid grid-cols-5">
        {NAV.map((item) => {
          const active = item.href === "/" ? loc === "/" : loc.startsWith(item.href);
          return (
            <button
              key={item.href}
              onClick={() => nav(item.href)}
              className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-bold transition ${
                active ? "text-gold-600 dark:text-gold-400" : "opacity-55"
              }`}
            >
              <Icon name={item.icon} size={21} />
              <span>{t(item.key)}</span>
              <span className={`h-0.5 w-6 rounded-full ${active ? "bg-gold-500" : "bg-transparent"}`} />
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function PartnersFooter({ partners }: { partners: { id: number; name: string; kind: string; logo: string }[] }) {
  const { t } = useApp();
  if (!partners?.length) return null;
  return (
    <footer className="mt-10 mb-4 text-center">
      <h3 className="text-sm font-extrabold text-gold-600 dark:text-gold-400 mb-3">{t("partners")}</h3>
      <div className="flex justify-center gap-3 flex-wrap">
        {partners.map((p) => (
          <div key={p.id} className="card px-5 py-3 flex items-center gap-2">
            <span className="text-xl">{p.logo}</span>
            <div className="text-start">
              <div className="text-sm font-extrabold">{p.name}</div>
              <div className="text-[10px] opacity-50">{p.kind}</div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] opacity-40 mt-5">نُزه © {new Date().getFullYear()} — السياحة البيئية في المحميات 🇸🇦</p>
    </footer>
  );
}

export function Toast() {
  const { toastState } = useApp();
  if (!toastState) return null;
  return (
    <div className="fixed top-16 inset-x-0 z-[1300] flex justify-center px-4 pointer-events-none">
      <div
        className={`rounded-xl px-4 py-2.5 text-sm font-bold shadow-lg ${
          toastState.kind === "ok" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
        }`}
      >
        {toastState.msg}
      </div>
    </div>
  );
}
