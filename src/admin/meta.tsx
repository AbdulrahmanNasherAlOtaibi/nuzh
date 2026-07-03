import { useEffect, useState } from "react";
import { get, put, post, del } from "../lib/api";
import { useApp } from "../lib/store";
import { Spinner, StatCard, Badge, Modal } from "../components/ui";
import { Table, SectionHead } from "./AdminApp";

/* 9️⃣ التقارير والتحليلات */
const REPORTS = [
  { key: "monthly", label: "تقرير الأداء الشهري", icon: "📈" },
  { key: "top-companies", label: "تقرير الشركات الأفضل", icon: "🏢" },
  { key: "top-users", label: "المستخدمون الأكثر نشاطاً", icon: "👥" },
  { key: "top-trips", label: "الرحلات الأكثر حجزاً", icon: "🗺️" },
  { key: "complaints", label: "تقرير الشكاوى والمشاكل", icon: "⚠️" },
];

export function ReportsSection() {
  const [type, setType] = useState("monthly");
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<any>(null);

  const load = () => {
    setData(null);
    get(`/admin/reports/${type}?from=${from}&to=${to}`).then(setData).catch(() => setData({ title: "", rows: [] }));
  };
  useEffect(() => { load(); }, [type, from, to]);

  const headers = data?.rows?.length ? Object.keys(data.rows[0]) : [];
  return (
    <div>
      <SectionHead title="التقارير والتحليلات" sub="تقارير شاملة وتحليلات متقدمة مع تصدير CSV" />
      <div className="flex gap-2 flex-wrap mb-4">
        {REPORTS.map((r) => (
          <button key={r.key} onClick={() => setType(r.key)} className={`chip text-xs ${type === r.key ? "chip-active" : ""}`}>
            {r.icon} {r.label}
          </button>
        ))}
      </div>

      <div className="card p-3.5 mb-4 flex items-end gap-3 flex-wrap">
        <div><span className="label">من تاريخ</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input !w-auto" /></div>
        <div><span className="label">إلى تاريخ</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input !w-auto" /></div>
        <a href={`/api/admin/reports/${type}?from=${from}&to=${to}&format=csv`} download className="btn-outline text-xs py-2.5">⬇️ تصدير CSV / Excel</a>
      </div>

      {!data ? (
        <Spinner />
      ) : (
        <>
          <h3 className="font-extrabold text-sm mb-2">{data.title} <span className="opacity-50 font-bold text-xs">({data.rows.length} سجل)</span></h3>
          <Table headers={headers} rows={data.rows.map((row: any) => headers.map((h) => String(row[h] ?? "—")))} />
        </>
      )}
    </div>
  );
}

/* 🔟 الإعدادات والأمان */
export function SettingsSection() {
  const { toast } = useApp();
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<"general" | "payment" | "security" | "staff" | "backup">("general");
  const [general, setGeneral] = useState<any>({});
  const [payment, setPayment] = useState<any>({});
  const [security, setSecurity] = useState<any>({});
  const [staffModal, setStaffModal] = useState<any>(null);
  const [pass, setPass] = useState({ current: "", next: "" });

  const load = () => get("/admin/settings").then((d) => {
    setData(d); setGeneral(d.general); setPayment(d.payment); setSecurity(d.security);
  }).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!data) return <Spinner />;

  const save = async (key: string, value: any, msg: string) => {
    try { await put(`/admin/settings/${key}`, value); toast(msg); load(); } catch (e: any) { toast(e.message, "err"); }
  };
  const changePass = async () => {
    try { await put("/auth/password", pass); toast("تم تغيير كلمة المرور"); setPass({ current: "", next: "" }); }
    catch (e: any) { toast(e.message, "err"); }
  };
  const saveStaff = async () => {
    try {
      if (staffModal.id) await put(`/admin/staff/${staffModal.id}`, staffModal);
      else await post("/admin/staff", staffModal);
      toast("تم حفظ الموظف"); setStaffModal(null); load();
    } catch (e: any) { toast(e.message, "err"); }
  };

  return (
    <div>
      <SectionHead title="الإعدادات والأمان" sub="إدارة إعدادات المنصة والأمان">
        {[["general", "عامة"], ["payment", "الدفع"], ["security", "الأمان"], ["staff", "الموظفون"], ["backup", "النسخ الاحتياطي"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as any)} className={`chip text-xs ${tab === k ? "chip-active" : ""}`}>{l}</button>
        ))}
      </SectionHead>

      {tab === "general" && (
        <div className="card p-5 max-w-xl space-y-3">
          <h3 className="font-extrabold text-sm mb-1">الإعدادات العامة</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><span className="label">اسم المنصة</span><input value={general.name || ""} onChange={(e) => setGeneral({ ...general, name: e.target.value })} className="input" /></div>
            <div><span className="label">الاسم بالإنجليزية</span><input value={general.nameEn || ""} onChange={(e) => setGeneral({ ...general, nameEn: e.target.value })} className="input" dir="ltr" /></div>
            <div><span className="label">البريد الإلكتروني</span><input value={general.email || ""} onChange={(e) => setGeneral({ ...general, email: e.target.value })} className="input" dir="ltr" /></div>
            <div><span className="label">الهاتف</span><input value={general.phone || ""} onChange={(e) => setGeneral({ ...general, phone: e.target.value })} className="input" dir="ltr" /></div>
          </div>
          <div><span className="label">الشعار التعريفي</span><input value={general.tagline || ""} onChange={(e) => setGeneral({ ...general, tagline: e.target.value })} className="input" /></div>
          <div><span className="label">العنوان</span><input value={general.address || ""} onChange={(e) => setGeneral({ ...general, address: e.target.value })} className="input" /></div>
          <button onClick={() => save("general", general, "حُفظت الإعدادات العامة")} className="btn-gold">حفظ</button>
        </div>
      )}

      {tab === "payment" && (
        <div className="card p-5 max-w-xl space-y-4">
          <h3 className="font-extrabold text-sm">إعدادات الدفع</h3>
          <div>
            <span className="label">رسوم المنصة (%)</span>
            <input type="number" value={payment.feePercent ?? 10} onChange={(e) => setPayment({ ...payment, feePercent: Number(e.target.value) })} className="input !w-32" />
          </div>
          <div>
            <span className="label">طرق الدفع المفعلة</span>
            <div className="flex gap-4 flex-wrap">
              {[["mada", "مدى"], ["visa", "Visa"], ["applepay", "Apple Pay"]].map(([k, l]) => (
                <label key={k} className="flex items-center gap-2 text-sm font-extrabold">
                  <input type="checkbox" checked={!!payment.methods?.[k]} onChange={(e) => setPayment({ ...payment, methods: { ...payment.methods, [k]: e.target.checked } })} className="accent-[#c9a95c] w-4 h-4" />
                  {l}
                </label>
              ))}
            </div>
          </div>
          <div>
            <span className="label">الحساب البنكي</span>
            {(payment.banks || []).map((b: any, i: number) => (
              <div key={i} className="grid grid-cols-3 gap-2 mb-2">
                <input value={b.bank} onChange={(e) => { const banks = [...payment.banks]; banks[i] = { ...b, bank: e.target.value }; setPayment({ ...payment, banks }); }} className="input" placeholder="البنك" />
                <input value={b.iban} onChange={(e) => { const banks = [...payment.banks]; banks[i] = { ...b, iban: e.target.value }; setPayment({ ...payment, banks }); }} className="input col-span-2" dir="ltr" placeholder="IBAN" />
              </div>
            ))}
          </div>
          <button onClick={() => save("payment", payment, "حُفظت إعدادات الدفع")} className="btn-gold">حفظ</button>
        </div>
      )}

      {tab === "security" && (
        <div className="space-y-4 max-w-3xl">
          <div className="card p-5 space-y-3">
            <h3 className="font-extrabold text-sm">كلمة مرور الأدمن</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><span className="label">الحالية</span><input type="password" value={pass.current} onChange={(e) => setPass({ ...pass, current: e.target.value })} className="input" /></div>
              <div><span className="label">الجديدة</span><input type="password" value={pass.next} onChange={(e) => setPass({ ...pass, next: e.target.value })} className="input" /></div>
            </div>
            <button onClick={changePass} className="btn-gold">تغيير</button>
          </div>

          <div className="card p-5">
            <label className="flex items-center gap-2 text-sm font-extrabold">
              <input type="checkbox" checked={!!security.twoFactor}
                onChange={(e) => { const s = { ...security, twoFactor: e.target.checked }; setSecurity(s); save("security", s, "حُفظت إعدادات الأمان"); }}
                className="accent-[#c9a95c] w-4 h-4" />
              تفعيل المصادقة الثنائية (2FA) لحسابات المشرفين
            </label>
          </div>

          <div>
            <h3 className="font-extrabold text-sm mb-2">⚠️ الأنشطة المريبة (محاولات دخول فاشلة متكررة)</h3>
            <Table headers={["الإيميل", "المحاولات", "آخر محاولة"]}
              rows={data.suspicious.map((s: any) => [<span dir="ltr">{s.email}</span>, <Badge tone="red">{s.attempts}</Badge>, s.last?.slice(0, 16).replace("T", " ")])} />
          </div>

          <div>
            <h3 className="font-extrabold text-sm mb-2">سجلات الدخول الأخيرة</h3>
            <Table headers={["الإيميل", "النتيجة", "الوقت"]}
              rows={data.logins.slice(0, 20).map((l: any) => [
                <span dir="ltr">{l.email}</span>,
                <Badge tone={l.ok ? "green" : "red"}>{l.ok ? "ناجح" : "فاشل"}</Badge>,
                l.created_at?.slice(0, 16).replace("T", " "),
              ])} />
          </div>
        </div>
      )}

      {tab === "staff" && (
        <div>
          <button onClick={() => setStaffModal({ name: "", email: "", role: "مشرف" })} className="btn-gold text-xs mb-3">+ موظف جديد</button>
          <Table
            headers={["الاسم", "الإيميل", "الدور", "الحالة", "إجراءات"]}
            rows={data.staff.map((s: any) => [
              s.name, <span dir="ltr">{s.email}</span>, s.role,
              <Badge tone={s.active ? "green" : "gray"}>{s.active ? "نشط" : "معطل"}</Badge>,
              <div className="flex gap-1">
                <button onClick={() => setStaffModal(s)} className="text-[10px] font-black rounded-lg border border-gold-500/50 text-gold-600 px-2 py-1">تعديل</button>
                <button onClick={async () => { await put(`/admin/staff/${s.id}`, { active: s.active ? 0 : 1 }); load(); }} className="text-[10px] font-black rounded-lg border border-sky-500/50 text-sky-600 px-2 py-1">{s.active ? "تعطيل" : "تفعيل"}</button>
                <button onClick={async () => { if (window.confirm("حذف الموظف؟")) { await del(`/admin/staff/${s.id}`); load(); } }} className="text-[10px] font-black rounded-lg border border-red-500/50 text-red-500 px-2 py-1">حذف</button>
              </div>,
            ])}
          />
          <h3 className="font-extrabold text-sm mt-6 mb-2">سجل النشاط</h3>
          <Table headers={["الفاعل", "الإجراء", "الوقت"]}
            rows={data.activity.slice(0, 25).map((a: any) => [a.actor, a.action, a.created_at?.slice(0, 16).replace("T", " ")])} />
        </div>
      )}

      {tab === "backup" && (
        <div className="card p-5 max-w-xl space-y-4">
          <h3 className="font-extrabold text-sm">إدارة النسخ الاحتياطية</h3>
          <p className="text-xs font-bold opacity-60 leading-5">
            تُصدَّر نسخة كاملة من بيانات المنصة (المستخدمون، الشركات، الرحلات، الحجوزات، المعاملات…) بصيغة JSON.
            احتفظ بالنسخ في مكان آمن — قاعدة البيانات نفسها ملف <code dir="ltr">data/nuzha.db</code> ويمكن نسخه لاستعادة كل شيء.
          </p>
          <a href="/api/admin/backup" download className="btn-gold inline-block text-sm">⬇️ تنزيل نسخة احتياطية الآن</a>
        </div>
      )}

      <Modal open={!!staffModal} onClose={() => setStaffModal(null)} title={staffModal?.id ? "تعديل موظف" : "موظف جديد"}>
        {staffModal && (
          <div className="space-y-3">
            <div><span className="label">الاسم</span><input value={staffModal.name} onChange={(e) => setStaffModal({ ...staffModal, name: e.target.value })} className="input" /></div>
            <div><span className="label">الإيميل</span><input value={staffModal.email} onChange={(e) => setStaffModal({ ...staffModal, email: e.target.value })} className="input" dir="ltr" /></div>
            <div>
              <span className="label">الدور</span>
              <select value={staffModal.role} onChange={(e) => setStaffModal({ ...staffModal, role: e.target.value })} className="input">
                {["مدير المنصة", "مشرف", "مشرفة الشكاوى", "محاسب", "دعم فني"].map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <button onClick={saveStaff} className="btn-gold w-full">حفظ</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
