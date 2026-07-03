import { useEffect, useState } from "react";
import { get, put, del, post, SAR, fmtDate, catLabel } from "../lib/api";
import { useApp } from "../lib/store";
import { Spinner, StatCard, Badge, Modal, Stars, LineChart, BarChart, Donut } from "../components/ui";
import { Table, SectionHead, monthLabel } from "./AdminApp";

const CAT_COLORS: Record<string, string> = { eco: "#4CAF50", culture: "#9C6ADE", fun: "#2196F3", adventure: "#FF7043", guided: "#c9a95c" };

/* 5️⃣ الإيرادات والمالية */
export function FinanceSection() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { get("/admin/finance").then(setData).catch(() => {}); }, []);
  if (!data) return <Spinner />;
  const TX_STATUS: Record<string, { l: string; tone: any }> = {
    paid: { l: "مدفوع", tone: "green" }, pending: { l: "معلق", tone: "amber" },
    failed: { l: "فشل", tone: "red" }, refunded: { l: "مسترد", tone: "gray" },
  };
  return (
    <div>
      <SectionHead title="الإيرادات والمالية" sub="مراقبة شاملة للجانب المالي" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard icon="wallet" label="إجمالي الإيرادات" value={SAR(data.stats.total)} />
        <StatCard icon="chart" label="إيرادات هذا الشهر" value={SAR(data.stats.thisMonth)} tone="green" />
        <StatCard icon="clock" label="الإيرادات المعلقة" value={SAR(data.stats.pending)} tone="amber" />
        <StatCard icon="star" label="أرباح المنصة (الرسوم)" value={SAR(data.stats.netProfit)} tone="blue" />
      </div>

      <div className="grid lg:grid-cols-2 gap-3 mb-3">
        <div className="card p-4">
          <h3 className="font-extrabold text-sm mb-3">اتجاه الإيرادات (12 شهر)</h3>
          <LineChart data={data.trend.map((x: any) => ({ label: monthLabel(x.m), value: x.s }))} color="#c9a95c" />
        </div>
        <div className="card p-4">
          <h3 className="font-extrabold text-sm mb-3">توزيع الإيرادات حسب الفئة</h3>
          <Donut data={data.byCategory.map((x: any) => ({ label: catLabel(x.category, "ar"), value: x.s, color: CAT_COLORS[x.category] || "#888" }))} />
        </div>
      </div>

      <div className="card p-4 mb-3">
        <h3 className="font-extrabold text-sm mb-3">الإيرادات حسب الشركة</h3>
        <BarChart data={data.byCompany.map((x: any) => ({ label: x.name.slice(0, 8), value: x.s }))} />
      </div>

      <h3 className="font-extrabold text-sm mb-2">جدول المعاملات</h3>
      <Table
        headers={["#", "الشركة", "المبلغ", "رسوم المنصة", "طريقة الدفع", "الحالة", "التاريخ"]}
        rows={data.transactions.slice(0, 60).map((x: any) => [
          x.id, x.provider_name || "—", SAR(x.amount), SAR(x.fee),
          x.method === "mada" ? "مدى" : x.method === "visa" ? "Visa" : "Apple Pay",
          <Badge tone={TX_STATUS[x.status]?.tone}>{TX_STATUS[x.status]?.l}</Badge>,
          fmtDate(x.created_at),
        ])}
      />
    </div>
  );
}

/* 6️⃣ التقييمات والشكاوى */
export function QualitySection() {
  const { toast } = useApp();
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<"reviews" | "complaints">("complaints");
  const [replyFor, setReplyFor] = useState<any>(null);
  const [replyText, setReplyText] = useState("");
  const [complaintFor, setComplaintFor] = useState<any>(null);
  const [cForm, setCForm] = useState({ status: "", priority: "", reply: "" });

  const load = () => get("/admin/quality").then(setData).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!data) return <Spinner />;

  const PRIORITY: Record<string, { l: string; tone: any }> = {
    high: { l: "عالية", tone: "red" }, medium: { l: "متوسطة", tone: "amber" }, low: { l: "منخفضة", tone: "gray" },
  };
  const C_STATUS: Record<string, { l: string; tone: any }> = {
    new: { l: "جديدة", tone: "red" }, processing: { l: "قيد المعالجة", tone: "amber" }, closed: { l: "مغلقة", tone: "green" },
  };

  const saveComplaint = async () => {
    try {
      await put(`/admin/complaints/${complaintFor.id}`, cForm);
      toast("تم تحديث الشكوى");
      setComplaintFor(null); load();
    } catch (e: any) { toast(e.message, "err"); }
  };
  const saveReply = async () => {
    try {
      await put(`/admin/reviews/${replyFor.id}`, { reply: replyText });
      toast("تم الرد على التقييم");
      setReplyFor(null); setReplyText(""); load();
    } catch (e: any) { toast(e.message, "err"); }
  };

  return (
    <div>
      <SectionHead title="التقييمات والشكاوى" sub="إدارة جودة الخدمة والشكاوى">
        <button onClick={() => setTab("complaints")} className={`chip text-xs ${tab === "complaints" ? "chip-active" : ""}`}>الشكاوى</button>
        <button onClick={() => setTab("reviews")} className={`chip text-xs ${tab === "reviews" ? "chip-active" : ""}`}>التقييمات</button>
      </SectionHead>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <StatCard icon="star" label="متوسط التقييم العام" value={`${data.stats.avgRating} / 5`} tone="amber" />
        <StatCard icon="msg" label="إجمالي التقييمات" value={data.stats.totalReviews} />
        <StatCard icon="check" label="إيجابية (4-5)" value={data.stats.positive} tone="green" />
        <StatCard icon="x" label="سلبية (1-2)" value={data.stats.negative} tone="red" />
        <StatCard icon="bell" label="شكاوى معلقة" value={data.stats.openComplaints} tone="amber" />
      </div>

      {tab === "complaints" ? (
        <Table
          headers={["#", "المستخدم", "الشركة", "النوع", "الأولوية", "الحالة", "التاريخ", "إجراء"]}
          rows={data.complaints.map((c: any) => [
            c.id, c.user_name, c.provider_name || "—", c.type,
            <Badge tone={PRIORITY[c.priority]?.tone}>{PRIORITY[c.priority]?.l}</Badge>,
            <Badge tone={C_STATUS[c.status]?.tone}>{C_STATUS[c.status]?.l}</Badge>,
            fmtDate(c.created_at),
            <button onClick={() => { setComplaintFor(c); setCForm({ status: c.status, priority: c.priority, reply: c.reply }); }}
              className="text-[10px] font-black rounded-lg border border-gold-500/50 text-gold-600 dark:text-gold-400 px-2 py-1">معالجة</button>,
          ])}
        />
      ) : (
        <div className="space-y-2.5">
          {data.reviews.map((r: any) => (
            <div key={r.id} className="card p-3.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="font-extrabold text-sm">{r.user_name} — {r.title} <span className="opacity-50 text-[10px]">({r.provider_name})</span></div>
                <div className="flex items-center gap-2"><Stars value={r.rating} size={13} /><span className="text-[10px] opacity-45">{fmtDate(r.created_at)}</span></div>
              </div>
              {r.text && <p className="text-xs opacity-75 mt-1.5 leading-5">{r.text}</p>}
              {r.reply
                ? <p className="text-[11px] mt-2 rounded-lg bg-gold-500/10 border border-gold-500/30 p-2"><b>الرد:</b> {r.reply}</p>
                : <button onClick={() => setReplyFor(r)} className="text-[11px] font-black text-gold-600 dark:text-gold-400 mt-2">↩️ رد</button>}
            </div>
          ))}
        </div>
      )}

      <Modal open={!!complaintFor} onClose={() => setComplaintFor(null)} title={`شكوى #${complaintFor?.id}: ${complaintFor?.type || ""}`}>
        {complaintFor && (
          <div className="space-y-3">
            <p className="text-xs opacity-75 leading-5 card !rounded-xl p-3">{complaintFor.description}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="label">الحالة</span>
                <select value={cForm.status} onChange={(e) => setCForm({ ...cForm, status: e.target.value })} className="input">
                  <option value="new">جديدة</option><option value="processing">قيد المعالجة</option><option value="closed">مغلقة</option>
                </select>
              </div>
              <div>
                <span className="label">الأولوية</span>
                <select value={cForm.priority} onChange={(e) => setCForm({ ...cForm, priority: e.target.value })} className="input">
                  <option value="high">عالية</option><option value="medium">متوسطة</option><option value="low">منخفضة</option>
                </select>
              </div>
            </div>
            <div><span className="label">الرد / الحل</span><textarea rows={3} value={cForm.reply} onChange={(e) => setCForm({ ...cForm, reply: e.target.value })} className="input resize-none" /></div>
            <button onClick={saveComplaint} className="btn-gold w-full">حفظ</button>
          </div>
        )}
      </Modal>

      <Modal open={!!replyFor} onClose={() => setReplyFor(null)} title="الرد على التقييم">
        <textarea rows={3} value={replyText} onChange={(e) => setReplyText(e.target.value)} className="input resize-none mb-3" />
        <button onClick={saveReply} className="btn-gold w-full">إرسال</button>
      </Modal>
    </div>
  );
}

/* 7️⃣ المحتوى والرحلات */
export function ContentSection() {
  const { toast } = useApp();
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<"trips" | "ads" | "articles">("trips");
  const [adModal, setAdModal] = useState<any>(null);
  const [artModal, setArtModal] = useState<any>(null);

  const load = () => get("/admin/content").then(setData).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!data) return <Spinner />;

  const act = async (fn: () => Promise<any>, okMsg: string) => {
    try { await fn(); toast(okMsg); load(); } catch (e: any) { toast(e.message, "err"); }
  };
  const saveAd = () => act(async () => {
    if (adModal.id) await put(`/admin/ads/${adModal.id}`, adModal);
    else await post("/admin/ads", adModal);
    setAdModal(null);
  }, "تم حفظ الإعلان");
  const saveArt = () => act(async () => {
    if (artModal.id) await put(`/admin/contents/${artModal.id}`, artModal);
    else await post("/admin/contents", artModal);
    setArtModal(null);
  }, "تم حفظ المحتوى");

  const T_STATUS: Record<string, { l: string; tone: any }> = {
    active: { l: "منشورة", tone: "green" }, pending: { l: "بانتظار الاعتماد", tone: "amber" }, hidden: { l: "مخفية", tone: "gray" },
  };
  const KINDS: Record<string, string> = { article: "مقال", snapshot: "لقطة", report: "تقرير محمية", behavior: "سلوك بيئي" };

  return (
    <div>
      <SectionHead title="المحتوى والرحلات" sub="إدارة المحتوى والرحلات على المنصة">
        {[["trips", "الرحلات"], ["ads", "إعلانات الكاروسيل"], ["articles", "التوعية البيئية"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as any)} className={`chip text-xs ${tab === k ? "chip-active" : ""}`}>{l}</button>
        ))}
      </SectionHead>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard icon="map" label="إجمالي الرحلات" value={data.stats.totalTrips} />
        <StatCard icon="check" label="النشطة" value={data.stats.activeTrips} tone="green" />
        <StatCard icon="clock" label="معلقة/مخفية" value={data.stats.pendingTrips} tone="amber" />
        <StatCard icon="trash" label="المحذوفة" value={data.stats.deletedTrips} tone="red" />
      </div>

      {tab === "trips" && (
        <Table
          headers={["الرحلة", "الشركة", "الوجهة", "السعر", "الحجوزات", "التقييم", "الحالة", "إجراءات"]}
          rows={data.trips.map((t: any) => [
            <div className="flex items-center gap-2"><img src={t.image} className="w-10 h-7 rounded object-cover" /><span className="max-w-[150px] truncate font-black">{t.title}</span></div>,
            t.provider_name,
            <span className="max-w-[110px] truncate inline-block">{t.location}</span>,
            SAR(t.price),
            t.bookings_count,
            t.rating ? `⭐ ${t.rating}` : "—",
            <Badge tone={T_STATUS[t.status]?.tone}>{T_STATUS[t.status]?.l}</Badge>,
            <div className="flex flex-wrap gap-1">
              {t.status !== "active"
                ? <button onClick={() => act(() => put(`/admin/trips/${t.id}`, { status: "active" }), "تم النشر")} className="text-[10px] font-black rounded-lg border border-emerald-500/50 text-emerald-600 px-2 py-1">نشر</button>
                : <button onClick={() => act(() => put(`/admin/trips/${t.id}`, { status: "hidden" }), "تم الإخفاء")} className="text-[10px] font-black rounded-lg border border-amber-500/50 text-amber-600 px-2 py-1">إخفاء</button>}
              <button onClick={() => act(() => put(`/admin/trips/${t.id}`, { featured: t.featured ? 0 : 1 }), "تم التحديث")} className={`text-[10px] font-black rounded-lg border px-2 py-1 ${t.featured ? "border-gold-500 text-gold-600 bg-gold-500/10" : "border-gold-500/40 text-gold-600/70"}`}>⭐ مميزة</button>
              <button onClick={() => act(() => put(`/admin/trips/${t.id}`, { weekendOffer: t.weekend_offer ? 0 : 1 }), "تم التحديث")} className={`text-[10px] font-black rounded-lg border px-2 py-1 ${t.weekend_offer ? "border-sky-500 text-sky-600 bg-sky-500/10" : "border-sky-500/40 text-sky-600/70"}`}>🔥 عرض</button>
              <button onClick={() => window.confirm("حذف الرحلة؟") && act(() => del(`/admin/trips/${t.id}`), "تم الحذف")} className="text-[10px] font-black rounded-lg border border-red-500/50 text-red-500 px-2 py-1">حذف</button>
            </div>,
          ])}
        />
      )}

      {tab === "ads" && (
        <div>
          <button onClick={() => setAdModal({ title: "", subtitle: "", image: "/scenes/dunes-sunset.svg", link: "" })} className="btn-gold text-xs mb-3">+ إعلان جديد</button>
          <Table
            headers={["الصورة", "العنوان", "الوصف", "الرابط", "الترتيب", "الحالة", "إجراءات"]}
            rows={data.ads.map((a: any) => [
              <img src={a.image} className="w-16 h-9 rounded object-cover" />,
              a.title, <span className="max-w-[160px] truncate inline-block">{a.subtitle}</span>, a.link || "—", a.sort,
              <Badge tone={a.active ? "green" : "gray"}>{a.active ? "ظاهر" : "مخفي"}</Badge>,
              <div className="flex flex-wrap gap-1">
                <button onClick={() => setAdModal(a)} className="text-[10px] font-black rounded-lg border border-gold-500/50 text-gold-600 px-2 py-1">تعديل</button>
                <button onClick={() => act(() => put(`/admin/ads/${a.id}`, { active: a.active ? 0 : 1 }), "تم التحديث")} className="text-[10px] font-black rounded-lg border border-sky-500/50 text-sky-600 px-2 py-1">{a.active ? "إخفاء" : "إظهار"}</button>
                <button onClick={() => window.confirm("حذف الإعلان؟") && act(() => del(`/admin/ads/${a.id}`), "تم الحذف")} className="text-[10px] font-black rounded-lg border border-red-500/50 text-red-500 px-2 py-1">حذف</button>
              </div>,
            ])}
          />
        </div>
      )}

      {tab === "articles" && (
        <div>
          <button onClick={() => setArtModal({ kind: "article", title: "", body: "", image: "/scenes/oasis.svg", author: "فريق نُزه" })} className="btn-gold text-xs mb-3">+ محتوى جديد</button>
          <Table
            headers={["النوع", "العنوان", "الكاتب", "التاريخ", "إجراءات"]}
            rows={data.contents.map((c: any) => [
              KINDS[c.kind] || c.kind,
              <span className="max-w-[220px] truncate inline-block font-black">{c.title}</span>,
              c.author, fmtDate(c.created_at),
              <div className="flex flex-wrap gap-1">
                <button onClick={() => setArtModal(c)} className="text-[10px] font-black rounded-lg border border-gold-500/50 text-gold-600 px-2 py-1">تعديل</button>
                <button onClick={() => window.confirm("حذف المحتوى؟") && act(() => del(`/admin/contents/${c.id}`), "تم الحذف")} className="text-[10px] font-black rounded-lg border border-red-500/50 text-red-500 px-2 py-1">حذف</button>
              </div>,
            ])}
          />
        </div>
      )}

      {/* نافذة إعلان */}
      <Modal open={!!adModal} onClose={() => setAdModal(null)} title={adModal?.id ? "تعديل إعلان" : "إعلان جديد"}>
        {adModal && (
          <div className="space-y-3">
            <div><span className="label">العنوان</span><input value={adModal.title} onChange={(e) => setAdModal({ ...adModal, title: e.target.value })} className="input" /></div>
            <div><span className="label">الوصف</span><input value={adModal.subtitle} onChange={(e) => setAdModal({ ...adModal, subtitle: e.target.value })} className="input" /></div>
            <div><span className="label">الرابط الداخلي (مثال: /explore)</span><input value={adModal.link} onChange={(e) => setAdModal({ ...adModal, link: e.target.value })} className="input" dir="ltr" /></div>
            <div>
              <span className="label">الصورة</span>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {["/scenes/dunes-sunset.svg", "/scenes/dunes-day.svg", "/scenes/sarawat.svg", "/scenes/alula.svg", "/scenes/wildlife.svg", "/scenes/night-camp.svg", "/scenes/oasis.svg"].map((s) => (
                  <button key={s} onClick={() => setAdModal({ ...adModal, image: s })} className={`shrink-0 rounded-xl overflow-hidden border-2 ${adModal.image === s ? "border-gold-500" : "border-transparent"}`}>
                    <img src={s} className="w-20 h-12 object-cover" />
                  </button>
                ))}
              </div>
            </div>
            <button onClick={saveAd} className="btn-gold w-full">حفظ</button>
          </div>
        )}
      </Modal>

      {/* نافذة محتوى */}
      <Modal open={!!artModal} onClose={() => setArtModal(null)} title={artModal?.id ? "تعديل محتوى" : "محتوى جديد"}>
        {artModal && (
          <div className="space-y-3">
            <div>
              <span className="label">النوع</span>
              <select value={artModal.kind} onChange={(e) => setArtModal({ ...artModal, kind: e.target.value })} className="input">
                {Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div><span className="label">العنوان</span><input value={artModal.title} onChange={(e) => setArtModal({ ...artModal, title: e.target.value })} className="input" /></div>
            <div><span className="label">النص</span><textarea rows={4} value={artModal.body} onChange={(e) => setArtModal({ ...artModal, body: e.target.value })} className="input resize-none" /></div>
            <div><span className="label">الكاتب</span><input value={artModal.author} onChange={(e) => setArtModal({ ...artModal, author: e.target.value })} className="input" /></div>
            <button onClick={saveArt} className="btn-gold w-full">حفظ</button>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* 8️⃣ الترويجات والعروض */
export function PromotionsSection() {
  const { toast } = useApp();
  const [promos, setPromos] = useState<any[] | null>(null);
  const [modal, setModal] = useState<any>(null);

  const load = () => get("/admin/promotions").then((d) => setPromos(d.promotions)).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!promos) return <Spinner />;

  const act = async (fn: () => Promise<any>, okMsg: string) => {
    try { await fn(); toast(okMsg); load(); } catch (e: any) { toast(e.message, "err"); }
  };
  const save = () => act(async () => {
    if (modal.id) await put(`/admin/promotions/${modal.id}`, { ...modal, maxUses: Number(modal.max_uses) });
    else await post("/admin/promotions", { ...modal, maxUses: Number(modal.max_uses || 100) });
    setModal(null);
  }, "تم حفظ الترويج");

  const totalUsed = promos.reduce((n, p) => n + p.used, 0);
  return (
    <div>
      <SectionHead title="الترويجات والعروض" sub="إدارة الحملات الترويجية وأكواد الخصم">
        <button onClick={() => setModal({ name: "", code: "", kind: "percent", value: 10, starts: new Date().toISOString().slice(0, 10), ends: "", max_uses: 100 })} className="btn-gold text-xs">+ ترويج جديد</button>
      </SectionHead>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <StatCard icon="gift" label="إجمالي الترويجات" value={promos.length} />
        <StatCard icon="check" label="النشطة" value={promos.filter((p) => p.active).length} tone="green" />
        <StatCard icon="users" label="مرات الاستخدام" value={totalUsed} tone="blue" />
      </div>

      <Table
        headers={["الاسم", "الكود", "نوع الخصم", "القيمة", "الفترة", "الاستخدام", "الحالة", "إجراءات"]}
        rows={promos.map((p: any) => [
          p.name,
          <code className="font-black text-gold-600 dark:text-gold-400" dir="ltr">{p.code}</code>,
          p.kind === "percent" ? "نسبة" : "مبلغ ثابت",
          p.kind === "percent" ? `${p.value}%` : SAR(p.value),
          <span className="text-[10px]">{p.starts} ← {p.ends}</span>,
          `${p.used} / ${p.max_uses}`,
          <Badge tone={p.active ? "green" : "gray"}>{p.active ? "نشط" : "معطل"}</Badge>,
          <div className="flex flex-wrap gap-1">
            <button onClick={() => setModal(p)} className="text-[10px] font-black rounded-lg border border-gold-500/50 text-gold-600 px-2 py-1">تعديل</button>
            <button onClick={() => act(() => put(`/admin/promotions/${p.id}`, { active: p.active ? 0 : 1 }), "تم التحديث")} className="text-[10px] font-black rounded-lg border border-sky-500/50 text-sky-600 px-2 py-1">{p.active ? "تعطيل" : "تفعيل"}</button>
            <button onClick={() => window.confirm("حذف الترويج؟") && act(() => del(`/admin/promotions/${p.id}`), "تم الحذف")} className="text-[10px] font-black rounded-lg border border-red-500/50 text-red-500 px-2 py-1">حذف</button>
          </div>,
        ])}
      />

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? "تعديل ترويج" : "ترويج جديد"}>
        {modal && (
          <div className="space-y-3">
            <div><span className="label">اسم الترويج</span><input value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} className="input" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><span className="label">الكود</span><input value={modal.code} onChange={(e) => setModal({ ...modal, code: e.target.value })} className="input" dir="ltr" disabled={!!modal.id} /></div>
              <div>
                <span className="label">نوع الخصم</span>
                <select value={modal.kind} onChange={(e) => setModal({ ...modal, kind: e.target.value })} className="input">
                  <option value="percent">نسبة %</option><option value="fixed">مبلغ ثابت</option>
                </select>
              </div>
              <div><span className="label">القيمة</span><input type="number" value={modal.value} onChange={(e) => setModal({ ...modal, value: Number(e.target.value) })} className="input" /></div>
              <div><span className="label">الحد الأقصى للاستخدام</span><input type="number" value={modal.max_uses} onChange={(e) => setModal({ ...modal, max_uses: e.target.value })} className="input" /></div>
              <div><span className="label">من</span><input type="date" value={modal.starts} onChange={(e) => setModal({ ...modal, starts: e.target.value })} className="input" /></div>
              <div><span className="label">إلى</span><input type="date" value={modal.ends} onChange={(e) => setModal({ ...modal, ends: e.target.value })} className="input" /></div>
            </div>
            <button onClick={save} className="btn-gold w-full">حفظ</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
