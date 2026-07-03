import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { get, put } from "../lib/api";
import { useApp } from "../lib/store";
import { Icon, Modal, Badge } from "../components/ui";

export default function Account() {
  const { user, provider, t, lang, setLang, theme, setTheme, logout, refresh, toast } = useApp();
  const [, nav] = useLocation();
  const [pub, setPub] = useState<any>(null);
  const [modal, setModal] = useState<"" | "about" | "faq" | "guide" | "profile" | "password" | "achievements">("");
  const [form, setForm] = useState({ name: "", phone: "", city: "" });
  const [pass, setPass] = useState({ current: "", next: "" });

  useEffect(() => { get("/public-settings").then(setPub).catch(() => {}); }, []);
  useEffect(() => { if (user) setForm({ name: user.name, phone: user.phone, city: user.city }); }, [user?.id]);

  const saveProfile = async () => {
    try { await put("/auth/profile", form); await refresh(); toast("تم حفظ الملف الشخصي"); setModal(""); }
    catch (e: any) { toast(e.message, "err"); }
  };
  const savePassword = async () => {
    try { await put("/auth/password", pass); toast("تم تغيير كلمة المرور"); setModal(""); setPass({ current: "", next: "" }); }
    catch (e: any) { toast(e.message, "err"); }
  };

  const Row = ({ icon, label, value, onClick, danger }: any) => (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3.5 text-start ${danger ? "text-red-500" : ""}`}>
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${danger ? "bg-red-500/10" : "bg-gold-500/12 text-gold-600 dark:text-gold-400"}`}>
        <Icon name={icon} size={17} />
      </span>
      <span className="flex-1 font-extrabold text-sm">{label}</span>
      {value && <span className="text-xs font-bold opacity-50">{value}</span>}
      <Icon name="back" size={15} className="opacity-30 rotate-180" />
    </button>
  );
  const Divider = () => <div className="border-t border-sand-200 dark:border-night-600/40 mx-4" />;

  return (
    <div className="px-4 max-w-3xl mx-auto pb-6">
      {/* بطاقة الملف الشخصي */}
      <div className="card p-5 mt-4 text-center relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-gold-500/15 to-transparent" />
        <div className="w-20 h-20 mx-auto rounded-full border-[3px] border-gold-500 bg-gold-500/15 flex items-center justify-center text-gold-600 dark:text-gold-300">
          {user ? <span className="text-3xl font-black">{user.name[0]}</span> : <Icon name="user" size={34} />}
        </div>
        <h1 className="font-black text-lg mt-2">{user ? user.name : t("guest")}</h1>
        {user && <p className="text-xs opacity-55 font-bold">{user.email}</p>}
        {provider && <div className="mt-1.5"><Badge tone="gold">{provider.type === "company" ? "🏢 شركة سياحية" : "🧭 مرشد سياحي"}: {provider.name}</Badge></div>}
        {!user && (
          <button onClick={() => nav("/auth")} className="btn-gold mt-4 px-10">{t("login")}</button>
        )}
      </div>

      {user && (
        <div className="card mt-3 overflow-hidden">
          <Row icon="user" label={t("profile")} onClick={() => setModal("profile")} />
          <Divider />
          <Row icon="shield" label="تغيير كلمة المرور" onClick={() => setModal("password")} />
        </div>
      )}

      {/* الإعدادات */}
      <h2 className="font-extrabold text-gold-600 dark:text-gold-400 text-sm mt-5 mb-2">{t("settings")}</h2>
      <div className="card overflow-hidden">
        <div className="px-4 py-3.5">
          <div className="flex items-center gap-3 mb-2.5">
            <span className="w-9 h-9 rounded-xl bg-gold-500/12 text-gold-600 dark:text-gold-400 flex items-center justify-center"><Icon name="moon" size={17} /></span>
            <span className="font-extrabold text-sm">{t("appearance")}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([["dark", t("darkMode"), "moon"], ["light", t("lightMode"), "sun"], ["system", t("systemMode"), "cog"]] as const).map(([k, l, ic]) => (
              <button key={k} onClick={() => setTheme(k)} className={`chip justify-center w-full text-xs gap-1.5 ${theme === k ? "chip-active" : ""}`}>
                <Icon name={ic} size={14} /> {l}
              </button>
            ))}
          </div>
        </div>
        <Divider />
        <div className="px-4 py-3.5">
          <div className="flex items-center gap-3 mb-2.5">
            <span className="w-9 h-9 rounded-xl bg-gold-500/12 text-gold-600 dark:text-gold-400 flex items-center justify-center">🌐</span>
            <span className="font-extrabold text-sm">{t("language")}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setLang("ar")} className={`chip justify-center w-full text-xs ${lang === "ar" ? "chip-active" : ""}`}>عربي</button>
            <button onClick={() => setLang("en")} className={`chip justify-center w-full text-xs ${lang === "en" ? "chip-active" : ""}`}>English</button>
          </div>
        </div>
      </div>

      {/* التواصل */}
      <h2 className="font-extrabold text-gold-600 dark:text-gold-400 text-sm mt-5 mb-2">{t("contact")}</h2>
      <div className="card overflow-hidden">
        <Row icon="phone" label="الهاتف" value={pub?.general?.phone} onClick={() => (location.href = `tel:${pub?.general?.phone}`)} />
        <Divider />
        <Row icon="mail" label="الإيميل" value={pub?.general?.email} onClick={() => (location.href = `mailto:${pub?.general?.email}`)} />
      </div>

      {/* لمعرفة المزيد */}
      <h2 className="font-extrabold text-gold-600 dark:text-gold-400 text-sm mt-5 mb-2">{t("learnMore")}</h2>
      <div className="card overflow-hidden">
        <Row icon="leaf" label={t("aboutNuzh")} onClick={() => setModal("about")} />
        <Divider />
        <Row icon="msg" label={t("faq")} onClick={() => setModal("faq")} />
        <Divider />
        <Row icon="doc" label={t("userGuide")} onClick={() => setModal("guide")} />
        <Divider />
        <Row icon="star" label="إنجازات المنصة وشركاؤنا" onClick={() => setModal("achievements")} />
      </div>

      {/* بوابة مزودي الخدمة */}
      <div className="card mt-5 overflow-hidden">
        <Row icon="building" label={t("providerPortal")} value={provider ? "لوحة التحكم" : "سجل كشركة أو مرشد"} onClick={() => nav("/provider")} />
      </div>

      {user && (
        <div className="card mt-3 overflow-hidden">
          <Row icon="logout" label={t("logout")} danger onClick={async () => { await logout(); nav("/"); }} />
        </div>
      )}

      {/* ---------- النوافذ ---------- */}
      <Modal open={modal === "profile"} onClose={() => setModal("")} title={t("profile")}>
        <div className="space-y-3">
          <div><span className="label">الاسم</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" /></div>
          <div><span className="label">الجوال</span><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" dir="ltr" /></div>
          <div><span className="label">المدينة</span><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input" /></div>
          <button onClick={saveProfile} className="btn-gold w-full">حفظ</button>
        </div>
      </Modal>

      <Modal open={modal === "password"} onClose={() => setModal("")} title="تغيير كلمة المرور">
        <div className="space-y-3">
          <div><span className="label">كلمة المرور الحالية</span><input type="password" value={pass.current} onChange={(e) => setPass({ ...pass, current: e.target.value })} className="input" /></div>
          <div><span className="label">كلمة المرور الجديدة</span><input type="password" value={pass.next} onChange={(e) => setPass({ ...pass, next: e.target.value })} className="input" /></div>
          <button onClick={savePassword} className="btn-gold w-full">تغيير</button>
        </div>
      </Modal>

      <Modal open={modal === "about"} onClose={() => setModal("")} title={t("aboutNuzh")}>
        <p className="text-sm leading-7 opacity-85">{pub?.about}</p>
      </Modal>

      <Modal open={modal === "faq"} onClose={() => setModal("")} title={t("faq")}>
        <div className="space-y-3">
          {pub?.faq?.map((f: any, i: number) => (
            <details key={i} className="card !rounded-xl p-3">
              <summary className="font-extrabold text-sm cursor-pointer">{f.q}</summary>
              <p className="text-xs leading-6 opacity-75 mt-2">{f.a}</p>
            </details>
          ))}
        </div>
      </Modal>

      <Modal open={modal === "guide"} onClose={() => setModal("")} title={t("userGuide")}>
        <div className="space-y-3">
          {pub?.userGuide?.map((g: any, i: number) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="text-2xl">{g.icon}</span>
              <div><div className="font-extrabold text-sm">{g.title}</div><p className="text-xs opacity-70 leading-5">{g.body}</p></div>
            </div>
          ))}
        </div>
      </Modal>

      <Modal open={modal === "achievements"} onClose={() => setModal("")} title="إنجازات المنصة">
        <div className="space-y-3">
          {pub?.platformAchievements?.map((a: any, i: number) => (
            <div key={i} className="card !rounded-xl p-3.5 flex gap-3 items-start">
              <span className="text-2xl">{a.icon}</span>
              <div><div className="font-extrabold text-sm">{a.title}</div><p className="text-xs opacity-70 leading-5 mt-0.5">{a.body}</p></div>
            </div>
          ))}
          <h4 className="font-extrabold text-sm text-gold-600 dark:text-gold-400 pt-1">شركاء النجاح بعد توفيق الله</h4>
          <div className="flex gap-2 flex-wrap">
            {pub?.partners?.map((p: any) => (
              <span key={p.id} className="card !rounded-xl px-4 py-2 text-sm font-extrabold">{p.logo} {p.name}</span>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
