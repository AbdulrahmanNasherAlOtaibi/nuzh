import { useEffect, useState } from "react";
import { get, put, del, post, SAR, fmtDate } from "../lib/api";
import { useApp } from "../lib/store";
import { Spinner, StatCard, Badge, Modal, Stars } from "../components/ui";
import { Table, SectionHead } from "./AdminApp";

const PROVIDER_STATUS: Record<string, { l: string; tone: any }> = {
  active: { l: "نشطة", tone: "green" }, pending: { l: "قيد المراجعة", tone: "amber" },
  suspended: { l: "معلقة", tone: "amber" }, banned: { l: "محظورة", tone: "red" },
};
const USER_STATUS: Record<string, { l: string; tone: any }> = {
  active: { l: "نشط", tone: "green" }, disabled: { l: "معطل", tone: "amber" }, banned: { l: "محظور", tone: "red" },
};
const BOOKING_STATUS: Record<string, { l: string; tone: any }> = {
  pending: { l: "معلق", tone: "amber" }, confirmed: { l: "مؤكد", tone: "green" }, completed: { l: "مكتمل", tone: "blue" },
  cancelled: { l: "ملغي", tone: "gray" }, refunded: { l: "مسترد", tone: "gray" }, disputed: { l: "نزاع", tone: "red" },
};

function MessageModal({ target, onClose }: { target: { userId: number; name: string } | null; onClose: () => void }) {
  const { toast } = useApp();
  const [f, setF] = useState({ subject: "", body: "" });
  const send = async () => {
    try {
      await post("/admin/message", { userId: target!.userId, ...f });
      toast("أُرسلت الرسالة ✉️");
      onClose(); setF({ subject: "", body: "" });
    } catch (e: any) { toast(e.message, "err"); }
  };
  return (
    <Modal open={!!target} onClose={onClose} title={`رسالة إلى: ${target?.name || ""}`}>
      <div className="space-y-3">
        <div><span className="label">الموضوع</span><input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} className="input" /></div>
        <div><span className="label">النص</span><textarea rows={3} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} className="input resize-none" /></div>
        <button onClick={send} className="btn-gold w-full">إرسال</button>
      </div>
    </Modal>
  );
}

const ActionBtn = ({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) => (
  <button onClick={onClick} className={`text-[10px] font-black rounded-lg border px-2 py-1 me-1 ${danger ? "border-red-500/50 text-red-500" : "border-gold-500/50 text-gold-600 dark:text-gold-400"}`}>
    {label}
  </button>
);

/* 2️⃣ إدارة الشركات */
export function CompaniesSection() {
  const { toast } = useApp();
  const [data, setData] = useState<any>(null);
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("");
  const [detail, setDetail] = useState<any>(null);
  const [msg, setMsg] = useState<any>(null);

  const load = () => get(`/admin/companies?status=${status}&sort=${sort}`).then(setData).catch(() => {});
  useEffect(() => { load(); }, [status, sort]);
  if (!data) return <Spinner />;

  const act = async (fn: () => Promise<any>, okMsg: string) => {
    try { await fn(); toast(okMsg); load(); } catch (e: any) { toast(e.message, "err"); }
  };

  return (
    <div>
      <SectionHead title="إدارة الشركات" sub="إدارة كاملة للشركات السياحية والمرشدين">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input !w-auto text-xs">
          <option value="">كل الحالات</option><option value="active">نشطة</option><option value="pending">قيد المراجعة</option><option value="suspended">معلقة</option><option value="banned">محظورة</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="input !w-auto text-xs">
          <option value="">حسب التاريخ</option><option value="revenue">حسب الإيرادات</option><option value="rating">حسب التقييم</option>
        </select>
      </SectionHead>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard icon="building" label="إجمالي الشركات" value={data.stats.total} />
        <StatCard icon="check" label="النشطة" value={data.stats.active} tone="green" />
        <StatCard icon="clock" label="المعلقة" value={data.stats.pending} tone="amber" />
        <StatCard icon="x" label="المحظورة" value={data.stats.banned} tone="red" />
      </div>

      <Table
        headers={["الاسم", "النوع", "تاريخ التسجيل", "الرحلات", "الإيرادات", "التقييم", "الحالة", "إجراءات"]}
        rows={data.companies.map((c: any) => [
          <div><div className="font-black">{c.name}</div><div className="opacity-50 text-[10px]" dir="ltr">{c.email}</div></div>,
          c.type === "company" ? "🏢 شركة" : "🧭 مرشد",
          fmtDate(c.created_at),
          c.trips_count,
          SAR(c.revenue),
          c.rating ? `⭐ ${c.rating}` : "—",
          <Badge tone={PROVIDER_STATUS[c.status]?.tone}>{PROVIDER_STATUS[c.status]?.l}</Badge>,
          <div className="flex flex-wrap">
            <ActionBtn label="التفاصيل" onClick={() => setDetail(c)} />
            {c.status !== "active" && <ActionBtn label="تفعيل" onClick={() => act(() => put(`/admin/companies/${c.id}`, { status: "active" }), "تم التفعيل")} />}
            {c.status === "active" && <ActionBtn label="تعليق" onClick={() => act(() => put(`/admin/companies/${c.id}`, { status: "suspended" }), "تم التعليق")} />}
            {c.status !== "banned"
              ? <ActionBtn danger label="حظر" onClick={() => act(() => put(`/admin/companies/${c.id}`, { status: "banned" }), "تم الحظر")} />
              : <ActionBtn label="إلغاء الحظر" onClick={() => act(() => put(`/admin/companies/${c.id}`, { status: "active" }), "أُلغي الحظر")} />}
            <ActionBtn label="رسالة" onClick={() => setMsg({ userId: c.user_id, name: c.name })} />
            <ActionBtn danger label="حذف" onClick={() => window.confirm(`حذف ${c.name} نهائياً؟`) && act(() => del(`/admin/companies/${c.id}`), "تم الحذف")} />
          </div>,
        ])}
      />

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name || ""}>
        {detail && (
          <div className="space-y-2 text-sm font-bold">
            <div className="flex justify-between"><span className="opacity-55">النوع</span><span>{detail.type === "company" ? "شركة سياحية" : "مرشد سياحي"}</span></div>
            <div className="flex justify-between"><span className="opacity-55">الترخيص</span><span dir="ltr">{detail.license || "—"}</span></div>
            <div className="flex justify-between"><span className="opacity-55">الإيميل</span><span dir="ltr">{detail.email}</span></div>
            <div className="flex justify-between"><span className="opacity-55">الجوال</span><span dir="ltr">{detail.phone}</span></div>
            <div className="flex justify-between"><span className="opacity-55">الرحلات</span><span>{detail.trips_count}</span></div>
            <div className="flex justify-between"><span className="opacity-55">الإيرادات</span><span>{SAR(detail.revenue)}</span></div>
            <div className="flex justify-between"><span className="opacity-55">التقييم</span><span>{detail.rating || "—"}</span></div>
            {detail.bio && <p className="text-xs opacity-70 leading-5 border-t border-sand-200 dark:border-night-600/50 pt-2">{detail.bio}</p>}
          </div>
        )}
      </Modal>
      <MessageModal target={msg} onClose={() => setMsg(null)} />
    </div>
  );
}

/* 3️⃣ إدارة المستخدمين */
export function UsersSection() {
  const { toast } = useApp();
  const [data, setData] = useState<any>(null);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);

  const load = () => get(`/admin/users?status=${status}&q=${encodeURIComponent(q)}`).then(setData).catch(() => {});
  useEffect(() => { load(); }, [status, q]);
  if (!data) return <Spinner />;

  const act = async (fn: () => Promise<any>, okMsg: string) => {
    try { await fn(); toast(okMsg); load(); } catch (e: any) { toast(e.message, "err"); }
  };

  return (
    <div>
      <SectionHead title="إدارة المستخدمين" sub="إدارة جميع مستخدمي المنصة">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الإيميل…" className="input !w-52 text-xs" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input !w-auto text-xs">
          <option value="">كل الحالات</option><option value="active">نشط</option><option value="disabled">معطل</option><option value="banned">محظور</option>
        </select>
      </SectionHead>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard icon="users" label="إجمالي المستخدمين" value={data.stats.total} />
        <StatCard icon="check" label="النشطون" value={data.stats.active} tone="green" />
        <StatCard icon="plus" label="الجدد هذا الشهر" value={data.stats.newThisMonth} tone="blue" />
        <StatCard icon="x" label="المحظورون" value={data.stats.banned} tone="red" />
      </div>

      <Table
        headers={["الاسم", "الإيميل", "الهاتف", "المدينة", "تاريخ التسجيل", "آخر نشاط", "الحجوزات", "الحالة", "إجراءات"]}
        rows={data.users.map((u: any) => [
          u.name,
          <span dir="ltr">{u.email}</span>,
          <span dir="ltr">{u.phone || "—"}</span>,
          u.city || "—",
          fmtDate(u.created_at),
          fmtDate(u.last_active),
          u.bookings_count,
          <Badge tone={USER_STATUS[u.status]?.tone}>{USER_STATUS[u.status]?.l}</Badge>,
          <div className="flex flex-wrap">
            <ActionBtn label="الملف" onClick={() => setDetail(u)} />
            {u.status === "active"
              ? <ActionBtn label="تعطيل" onClick={() => act(() => put(`/admin/users/${u.id}`, { status: "disabled" }), "تم التعطيل")} />
              : <ActionBtn label="تفعيل" onClick={() => act(() => put(`/admin/users/${u.id}`, { status: "active" }), "تم التفعيل")} />}
            {u.status !== "banned"
              ? <ActionBtn danger label="حظر" onClick={() => act(() => put(`/admin/users/${u.id}`, { status: "banned" }), "تم الحظر")} />
              : <ActionBtn label="إلغاء الحظر" onClick={() => act(() => put(`/admin/users/${u.id}`, { status: "active" }), "أُلغي الحظر")} />}
            <ActionBtn label="رسالة" onClick={() => setMsg({ userId: u.id, name: u.name })} />
            <ActionBtn danger label="حذف" onClick={() => window.confirm(`حذف حساب ${u.name}؟`) && act(() => del(`/admin/users/${u.id}`), "تم الحذف")} />
          </div>,
        ])}
      />

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name || ""}>
        {detail && (
          <div className="space-y-2 text-sm font-bold">
            <div className="flex justify-between"><span className="opacity-55">الإيميل</span><span dir="ltr">{detail.email}</span></div>
            <div className="flex justify-between"><span className="opacity-55">الجوال</span><span dir="ltr">{detail.phone || "—"}</span></div>
            <div className="flex justify-between"><span className="opacity-55">الجنس</span><span>{detail.gender || "—"}</span></div>
            <div className="flex justify-between"><span className="opacity-55">المدينة</span><span>{detail.city || "—"}</span></div>
            <div className="flex justify-between"><span className="opacity-55">الحجوزات</span><span>{detail.bookings_count}</span></div>
            <div className="flex justify-between"><span className="opacity-55">التسجيل</span><span>{fmtDate(detail.created_at)}</span></div>
          </div>
        )}
      </Modal>
      <MessageModal target={msg} onClose={() => setMsg(null)} />
    </div>
  );
}

/* 4️⃣ إدارة الحجوزات */
export function BookingsSection() {
  const { toast } = useApp();
  const [data, setData] = useState<any>(null);
  const [status, setStatus] = useState("");

  const load = () => get(`/admin/bookings?status=${status}`).then(setData).catch(() => {});
  useEffect(() => { load(); }, [status]);
  if (!data) return <Spinner />;

  const act = async (id: number, s: string, okMsg: string) => {
    try { await put(`/admin/bookings/${id}`, { status: s }); toast(okMsg); load(); } catch (e: any) { toast(e.message, "err"); }
  };

  return (
    <div>
      <SectionHead title="إدارة الحجوزات" sub="مراقبة وإدارة جميع الحجوزات">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input !w-auto text-xs">
          <option value="">كل الحالات</option>
          {Object.entries(BOOKING_STATUS).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
        </select>
      </SectionHead>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard icon="ticket" label="إجمالي الحجوزات" value={data.stats.total} />
        <StatCard icon="check" label="المؤكدة" value={data.stats.confirmed} tone="green" />
        <StatCard icon="clock" label="المعلقة" value={data.stats.pending} tone="amber" />
        <StatCard icon="x" label="الملغاة" value={data.stats.cancelled} tone="red" />
      </div>

      <Table
        headers={["#", "المستخدم", "الشركة", "الرحلة", "التاريخ", "المشاركون", "الإجمالي", "الحالة", "إجراءات"]}
        rows={data.bookings.map((b: any) => [
          b.id,
          b.user_name,
          b.provider_name,
          <span className="max-w-[140px] truncate inline-block">{b.title}</span>,
          fmtDate(b.date),
          b.adults + b.children,
          SAR(b.total),
          <Badge tone={BOOKING_STATUS[b.status]?.tone}>{BOOKING_STATUS[b.status]?.l}</Badge>,
          <div className="flex flex-wrap">
            {b.status === "pending" && <ActionBtn label="تأكيد" onClick={() => act(b.id, "confirmed", "تم التأكيد")} />}
            {["pending", "confirmed"].includes(b.status) && <ActionBtn danger label="إلغاء" onClick={() => act(b.id, "cancelled", "تم الإلغاء")} />}
            {["confirmed", "completed", "disputed"].includes(b.status) && <ActionBtn label="استرجاع" onClick={() => act(b.id, "refunded", "تم الاسترجاع")} />}
            {b.status === "disputed" && <ActionBtn label="حل النزاع" onClick={() => act(b.id, "completed", "حُل النزاع")} />}
            {b.status === "confirmed" && <ActionBtn label="إكمال" onClick={() => act(b.id, "completed", "اكتمل الحجز")} />}
          </div>,
        ])}
      />
    </div>
  );
}
