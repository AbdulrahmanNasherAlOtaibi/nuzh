import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { get, post, put, del, SAR, CATEGORIES, fmtDate, catLabel } from "../lib/api";
import { useApp } from "../lib/store";
import { Icon, Spinner, Empty, Modal, Badge, StatCard, Stars } from "../components/ui";

const SCENES = ["/scenes/dunes-sunset.svg", "/scenes/dunes-day.svg", "/scenes/sarawat.svg", "/scenes/alula.svg", "/scenes/wildlife.svg", "/scenes/night-camp.svg", "/scenes/oasis.svg"];

export default function Provider() {
  const { user, provider, refresh, toast, lang } = useApp();
  const [, nav] = useLocation();

  /* ---------- تسجيل مزود جديد ---------- */
  const [mode, setMode] = useState<"login" | "register">("register");
  const [type, setType] = useState<"company" | "guide">("company");
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "" });
  const [busy, setBusy] = useState(false);

  /* ---------- لوحة المزود ---------- */
  const [tab, setTab] = useState("trips");
  const [summary, setSummary] = useState<any>(null);
  const [trips, setTrips] = useState<any[] | null>(null);
  const [bookings, setBookings] = useState<any[] | null>(null);
  const [reviews, setReviews] = useState<any[] | null>(null);
  const [tripModal, setTripModal] = useState<null | any>(null);
  const [replyFor, setReplyFor] = useState<any>(null);
  const [replyText, setReplyText] = useState("");

  const isProvider = !!user && user.role === "provider" && !!provider;

  const reload = () => {
    if (!isProvider) return;
    get("/provider/summary").then(setSummary).catch(() => {});
    get("/provider/trips").then((d) => setTrips(d.trips)).catch(() => {});
    get("/provider/bookings").then((d) => setBookings(d.bookings)).catch(() => {});
    get("/provider/reviews").then((d) => setReviews(d.reviews)).catch(() => {});
  };
  useEffect(reload, [isProvider]);

  const submitAuth = async () => {
    setBusy(true);
    try {
      if (mode === "login") await post("/auth/login", { email: f.email, password: f.password });
      else await post("/auth/provider-register", { ...f, type });
      await refresh();
      toast(mode === "login" ? "أهلاً بعودتك" : "تم استلام طلب انضمامك 🎉");
    } catch (e: any) { toast(e.message, "err"); }
    finally { setBusy(false); }
  };

  const saveTrip = async () => {
    const m = tripModal;
    try {
      const payload = {
        title: m.title, description: m.description, category: m.category, location: m.location,
        price: Number(m.price), childPrice: Number(m.childPrice || 0), durationHours: Number(m.durationHours || 4),
        distanceKm: Number(m.distanceKm || 0), capacity: Number(m.capacity || 20), image: m.image,
        dates: String(m.datesText || "").split(",").map((s: string) => s.trim()).filter(Boolean),
        weekendOffer: m.weekendOffer ? 1 : 0,
      };
      if (m.id) await put(`/provider/trips/${m.id}`, payload);
      else await post("/provider/trips", payload);
      toast(m.id ? "تم تحديث الرحلة" : "أُرسلت الرحلة للاعتماد ✅");
      setTripModal(null);
      reload();
    } catch (e: any) { toast(e.message, "err"); }
  };

  const sendReply = async () => {
    try {
      await post(`/provider/reviews/${replyFor.id}/reply`, { reply: replyText });
      toast("تم إرسال الرد");
      setReplyFor(null); setReplyText("");
      reload();
    } catch (e: any) { toast(e.message, "err"); }
  };

  /* ---------- شاشة التسجيل ---------- */
  if (!isProvider)
    return (
      <div className="px-4 max-w-md mx-auto pt-6 pb-6">
        <div className="text-center mb-5">
          <span className="text-4xl">🏢</span>
          <h1 className="font-black text-xl mt-1 text-gold-600 dark:text-gold-400">بوابة مزودي الخدمة</h1>
          <p className="text-xs font-bold opacity-55 mt-1">انضم إلى نُزه كشركة سياحية أو مرشد سياحي وابدأ باستقبال الحجوزات</p>
        </div>

        {user && (
          <p className="text-xs font-bold rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 mb-4">
            أنت مسجل حالياً بحساب ضيف ({user.name}) — سجل الخروج أولاً من «حسابي» لإنشاء حساب مزود، أو سجل بحساب مزود مختلف.
          </p>
        )}

        <div className="card p-5">
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button onClick={() => setMode("register")} className={`chip justify-center w-full ${mode === "register" ? "chip-active" : ""}`}>تسجيل جديد</button>
            <button onClick={() => setMode("login")} className={`chip justify-center w-full ${mode === "login" ? "chip-active" : ""}`}>دخول المزودين</button>
          </div>

          <div className="space-y-3">
            {mode === "register" && (
              <>
                <div>
                  <span className="label">نوع الحساب</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setType("company")} className={`chip justify-center w-full text-xs ${type === "company" ? "chip-active" : ""}`}>🏢 شركة سياحية</button>
                    <button onClick={() => setType("guide")} className={`chip justify-center w-full text-xs ${type === "guide" ? "chip-active" : ""}`}>🧭 مرشد سياحي</button>
                  </div>
                </div>
                <div>
                  <span className="label">{type === "company" ? "اسم الشركة" : "الاسم الرباعي"}</span>
                  <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="input"
                    placeholder={type === "company" ? "مثال: رحلات الصحراء الملكية" : "الاسم الأول، الأب، الجد، العائلة"} />
                </div>
                <div><span className="label">رقم الجوال</span><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className="input" dir="ltr" placeholder="05xxxxxxxx" /></div>
              </>
            )}
            <div><span className="label">البريد الإلكتروني</span><input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className="input" dir="ltr" /></div>
            <div><span className="label">كلمة المرور</span><input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className="input" dir="ltr" /></div>
            <button onClick={submitAuth} disabled={busy} className="btn-gold w-full py-3">
              {busy ? "لحظات…" : mode === "login" ? "دخول" : "إرسال طلب الانضمام"}
            </button>
            {mode === "register" && <p className="text-[10px] font-bold opacity-50 leading-4">يُراجع الطلب من إدارة نُزه ويُفعّل بعد التحقق من الترخيص السياحي.</p>}
          </div>
        </div>
      </div>
    );

  /* ---------- لوحة المزود ---------- */
  return (
    <div className="px-4 max-w-3xl mx-auto pb-6">
      <div className="card p-4 mt-4 flex items-center gap-3">
        <span className="w-12 h-12 rounded-2xl bg-gold-500/15 flex items-center justify-center text-2xl">{provider!.type === "company" ? "🏢" : "🧭"}</span>
        <div className="flex-1 min-w-0">
          <h1 className="font-black truncate">{provider!.name}</h1>
          <div className="text-[11px] font-bold opacity-55">{provider!.type === "company" ? "شركة سياحية" : "مرشد سياحي"}</div>
        </div>
        <Badge tone={provider!.status === "active" ? "green" : provider!.status === "pending" ? "amber" : "red"}>
          {provider!.status === "active" ? "نشط" : provider!.status === "pending" ? "قيد المراجعة" : "موقوف"}
        </Badge>
      </div>

      {provider!.status === "pending" && (
        <p className="text-xs font-bold rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 mt-3">
          ⏳ حسابك قيد مراجعة إدارة نُزه — يمكنك تجهيز رحلاتك وستُنشر فور التفعيل.
        </p>
      )}

      {summary && (
        <div className="grid grid-cols-4 gap-2 mt-3">
          <StatCard icon="map" label="الرحلات" value={summary.trips} />
          <StatCard icon="ticket" label="الحجوزات" value={summary.bookings} tone="blue" />
          <StatCard icon="wallet" label="الإيرادات" value={SAR(summary.revenue)} tone="green" />
          <StatCard icon="star" label="التقييم" value={summary.rating || "—"} tone="amber" />
        </div>
      )}

      <div className="flex gap-2 mt-4">
        {[["trips", "رحلاتي"], ["bookings", "الحجوزات"], ["reviews", "التقييمات"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`chip text-xs ${tab === k ? "chip-active" : ""}`}>{l}</button>
        ))}
      </div>

      {tab === "trips" && (
        <div className="space-y-3 mt-4">
          <button
            onClick={() => setTripModal({ category: "eco", image: SCENES[0], datesText: "" })}
            className="w-full card !border-dashed !border-gold-500/60 p-4 flex items-center justify-center gap-2 text-gold-600 dark:text-gold-400 font-black text-sm">
            <Icon name="plus" size={18} /> أضف رحلة جديدة
          </button>
          {!trips ? <Spinner /> : trips.length === 0 ? <Empty text="لم تضف رحلات بعد" /> : trips.map((tr) => (
            <div key={tr.id} className="card overflow-hidden">
              <div className="flex">
                <img src={tr.image} className="w-24 object-cover" />
                <div className="p-3 flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-extrabold text-sm truncate">{tr.title}</h3>
                    <Badge tone={tr.status === "active" ? "green" : tr.status === "pending" ? "amber" : "gray"}>
                      {tr.status === "active" ? "منشورة" : tr.status === "pending" ? "بانتظار الاعتماد" : "مخفية"}
                    </Badge>
                  </div>
                  <div className="text-[11px] font-bold opacity-55 mt-0.5">{catLabel(tr.category, lang)} · {SAR(tr.price)} · ⭐ {tr.rating || "—"} · {tr.bookings_count} حجز</div>
                  <div className="flex gap-3 mt-1.5">
                    <button onClick={() => setTripModal({ ...tr, childPrice: tr.child_price, durationHours: tr.duration_hours, distanceKm: tr.distance_km, weekendOffer: tr.weekend_offer, datesText: (tr.dates || []).join(", ") })}
                      className="text-[11px] font-black text-gold-600 dark:text-gold-400 flex items-center gap-1"><Icon name="edit" size={13} /> تعديل</button>
                    <button onClick={async () => { if (window.confirm("حذف الرحلة؟")) { await del(`/provider/trips/${tr.id}`); reload(); } }}
                      className="text-[11px] font-black text-red-500 flex items-center gap-1"><Icon name="trash" size={13} /> حذف</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "bookings" && (
        !bookings ? <Spinner /> : (
          <div className="space-y-2.5 mt-4">
            {bookings.length === 0 ? <Empty text="لا توجد حجوزات بعد" /> : bookings.map((b) => (
              <div key={b.id} className="card p-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm">{b.title}</span>
                  <span className="font-black text-gold-600 dark:text-gold-400 text-sm">{SAR(b.total)}</span>
                </div>
                <div className="text-[11px] font-bold opacity-55 mt-1">👤 {b.user_name} · 📞 {b.user_phone || "—"} · 🗓️ {fmtDate(b.date, lang)} · 👥 {b.adults + b.children}</div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === "reviews" && (
        !reviews ? <Spinner /> : (
          <div className="space-y-2.5 mt-4">
            {reviews.length === 0 ? <Empty text="لا توجد تقييمات بعد" /> : reviews.map((r) => (
              <div key={r.id} className="card p-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm">{r.user_name} — {r.title}</span>
                  <Stars value={r.rating} size={12} />
                </div>
                {r.text && <p className="text-xs opacity-70 mt-1 leading-5">{r.text}</p>}
                {r.reply
                  ? <p className="text-[11px] mt-1.5 rounded-lg bg-gold-500/10 border border-gold-500/30 p-2"><b className="text-gold-600 dark:text-gold-400">ردك:</b> {r.reply}</p>
                  : <button onClick={() => setReplyFor(r)} className="text-[11px] font-black text-gold-600 dark:text-gold-400 mt-1.5">↩️ رد على التقييم</button>}
              </div>
            ))}
          </div>
        )
      )}

      {/* نافذة رحلة */}
      <Modal open={!!tripModal} onClose={() => setTripModal(null)} title={tripModal?.id ? "تعديل الرحلة" : "رحلة جديدة"}>
        {tripModal && (
          <div className="space-y-3">
            <div><span className="label">اسم الرحلة</span><input value={tripModal.title || ""} onChange={(e) => setTripModal({ ...tripModal, title: e.target.value })} className="input" /></div>
            <div><span className="label">الوصف</span><textarea rows={2} value={tripModal.description || ""} onChange={(e) => setTripModal({ ...tripModal, description: e.target.value })} className="input resize-none" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="label">التصنيف</span>
                <select value={tripModal.category} onChange={(e) => setTripModal({ ...tripModal, category: e.target.value })} className="input">
                  {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.ar}</option>)}
                </select>
              </div>
              <div><span className="label">الموقع</span><input value={tripModal.location || ""} onChange={(e) => setTripModal({ ...tripModal, location: e.target.value })} className="input" /></div>
              <div><span className="label">سعر البالغ (ر.س)</span><input type="number" value={tripModal.price || ""} onChange={(e) => setTripModal({ ...tripModal, price: e.target.value })} className="input" /></div>
              <div><span className="label">سعر الطفل (ر.س)</span><input type="number" value={tripModal.childPrice || ""} onChange={(e) => setTripModal({ ...tripModal, childPrice: e.target.value })} className="input" /></div>
              <div><span className="label">المدة (ساعات)</span><input type="number" value={tripModal.durationHours || ""} onChange={(e) => setTripModal({ ...tripModal, durationHours: e.target.value })} className="input" /></div>
              <div><span className="label">المسافة (كم)</span><input type="number" value={tripModal.distanceKm || ""} onChange={(e) => setTripModal({ ...tripModal, distanceKm: e.target.value })} className="input" /></div>
            </div>
            <div>
              <span className="label">الصورة</span>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {SCENES.map((s) => (
                  <button key={s} onClick={() => setTripModal({ ...tripModal, image: s })}
                    className={`shrink-0 rounded-xl overflow-hidden border-2 ${tripModal.image === s ? "border-gold-500" : "border-transparent"}`}>
                    <img src={s} className="w-20 h-12 object-cover" />
                  </button>
                ))}
              </div>
            </div>
            <div><span className="label">التواريخ المتاحة (YYYY-MM-DD مفصولة بفواصل)</span><input value={tripModal.datesText} onChange={(e) => setTripModal({ ...tripModal, datesText: e.target.value })} className="input" dir="ltr" /></div>
            <label className="flex items-center gap-2 text-xs font-extrabold">
              <input type="checkbox" checked={!!tripModal.weekendOffer} onChange={(e) => setTripModal({ ...tripModal, weekendOffer: e.target.checked })} className="accent-[#c9a95c] w-4 h-4" />
              ضمن عروض نهاية الأسبوع
            </label>
            <button onClick={saveTrip} className="btn-gold w-full">{tripModal.id ? "حفظ التعديلات" : "إرسال للاعتماد"}</button>
          </div>
        )}
      </Modal>

      {/* نافذة الرد */}
      <Modal open={!!replyFor} onClose={() => setReplyFor(null)} title="الرد على التقييم">
        <textarea rows={3} value={replyText} onChange={(e) => setReplyText(e.target.value)} className="input resize-none mb-3" placeholder="اكتب ردك…" />
        <button onClick={sendReply} className="btn-gold w-full">إرسال</button>
      </Modal>
    </div>
  );
}
