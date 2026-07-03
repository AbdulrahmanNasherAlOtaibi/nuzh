import { useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { post } from "../lib/api";
import { useApp } from "../lib/store";
import { Logo } from "../components/ui";

export default function Auth() {
  const [, nav] = useLocation();
  const search = useSearch();
  const next = useMemo(() => new URLSearchParams(search).get("next") || "/", [search]);
  const { refresh, toast } = useApp();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "" });

  const submit = async () => {
    setBusy(true);
    try {
      if (tab === "login") await post("/auth/login", { email: f.email, password: f.password });
      else await post("/auth/register", f);
      await refresh();
      toast(tab === "login" ? "أهلاً بعودتك 🌿" : "أهلاً بك في نُزه 🌿");
      nav(next);
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-4 max-w-md mx-auto pt-8 pb-6">
      <div className="text-center mb-6">
        <div className="flex justify-center"><Logo size={84} /></div>
        <h1 className="font-black text-2xl mt-2 text-gold-600 dark:text-gold-400">نُزه</h1>
        <p className="text-xs font-bold opacity-55">السياحة البيئية في المحميات — Wildlife Tourism</p>
      </div>

      <div className="card p-5">
        <div className="grid grid-cols-2 gap-2 mb-5">
          <button onClick={() => setTab("login")} className={`chip justify-center w-full ${tab === "login" ? "chip-active" : ""}`}>تسجيل الدخول</button>
          <button onClick={() => setTab("register")} className={`chip justify-center w-full ${tab === "register" ? "chip-active" : ""}`}>حساب جديد</button>
        </div>

        <div className="space-y-3">
          {tab === "register" && (
            <>
              <div><span className="label">الاسم</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="input" placeholder="اسمك الكامل" /></div>
              <div><span className="label">رقم الجوال</span><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className="input" dir="ltr" placeholder="05xxxxxxxx" /></div>
            </>
          )}
          <div><span className="label">البريد الإلكتروني</span><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className="input" dir="ltr" placeholder="you@example.com" /></div>
          <div><span className="label">كلمة المرور</span><input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className="input" dir="ltr" onKeyDown={(e) => e.key === "Enter" && submit()} /></div>
          {tab === "register" && (
            <p className="text-[10px] font-bold opacity-50 leading-4">🪪 التسجيل بالإيميل مع إثبات الهوية — بإكمال التسجيل أنت تقر بأن البيانات تخصك وتوافق على شروط الاستخدام.</p>
          )}
          <button onClick={submit} disabled={busy} className="btn-gold w-full py-3">
            {busy ? "لحظات…" : tab === "login" ? "دخول" : "إنشاء الحساب"}
          </button>
        </div>
      </div>

      <button onClick={() => nav("/provider")} className="w-full text-center mt-5 text-xs font-black text-gold-600 dark:text-gold-400">
        🏢 شركة سياحية أو مرشد؟ — بوابة مزودي الخدمة
      </button>
    </div>
  );
}
