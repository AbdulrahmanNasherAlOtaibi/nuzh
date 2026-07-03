import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { get, post, SAR, fmtDate, catLabel } from "../lib/api";
import { useApp } from "../lib/store";
import { Icon, Stars, RatingBadge, Spinner, Badge, Modal } from "../components/ui";
import type { Trip } from "../components/TripCard";

interface Review { id: number; user_name: string; rating: number; text: string; reply: string; created_at: string }

export default function TripDetails() {
  const [, params] = useRoute("/trips/:id");
  const [, nav] = useLocation();
  const { user, t, lang, toast } = useApp();
  const [data, setData] = useState<{ trip: Trip & { child_price: number; capacity: number }; reviews: Review[]; reserve: any } | null>(null);
  const [booking, setBooking] = useState(false);

  // نموذج الحجز
  const [date, setDate] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [notes, setNotes] = useState("");
  const [method, setMethod] = useState("mada");
  const [promo, setPromo] = useState("");
  const [promoInfo, setPromoInfo] = useState<{ code: string; kind: string; value: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  useEffect(() => {
    get(`/trips/${params?.id}`).then((d) => { setData(d); setDate(d.trip.dates?.[0] || ""); }).catch(() => nav("/"));
  }, [params?.id]);

  if (!data) return <Spinner />;
  const { trip, reviews, reserve } = data;
  const childPrice = trip.child_price || Math.round(trip.price / 2);
  let total = adults * trip.price + children * childPrice;
  let discount = 0;
  if (promoInfo) {
    discount = promoInfo.kind === "percent" ? Math.round((total * promoInfo.value) / 100) : promoInfo.value;
    total = Math.max(0, total - discount);
  }

  const applyPromo = async () => {
    try {
      const d = await post("/promo/validate", { code: promo });
      setPromoInfo(d.promo);
      toast("تم تطبيق الكود ✅");
    } catch (e: any) {
      setPromoInfo(null);
      toast(e.message, "err");
    }
  };

  const confirm = async () => {
    if (!user) return nav(`/auth?next=/trips/${trip.id}`);
    if (!date) return toast("اختر تاريخ الرحلة", "err");
    setBusy(true);
    try {
      const d = await post("/bookings", { tripId: trip.id, date, adults, children, notes, paymentMethod: method, promoCode: promoInfo?.code || "" });
      setDone(d.bookingId);
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-6">
      {/* الغلاف */}
      <div className="relative h-64">
        <img src={trip.image} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-night-950/90 via-transparent to-night-950/30" />
        <button onClick={() => history.back()} className="absolute top-3 start-3 w-9 h-9 rounded-full bg-night-950/60 text-sand-50 backdrop-blur flex items-center justify-center">
          <Icon name="back" size={18} />
        </button>
        <div className="absolute bottom-3 inset-x-0 px-4 flex items-end justify-between">
          <div>
            <Badge tone="gold">{catLabel(trip.category, lang)}</Badge>
            <h1 className="text-white text-xl font-black mt-1 drop-shadow">{trip.title}</h1>
            <div className="flex items-center gap-1 text-sand-100/80 text-xs font-bold"><Icon name="pin" size={13} /> {trip.location}</div>
          </div>
          <RatingBadge rating={trip.rating} count={trip.reviews_count} />
        </div>
      </div>

      <div className="px-4">
        {/* مؤشرات سريعة */}
        <div className="grid grid-cols-3 gap-2.5 mt-4">
          <div className="card p-3 text-center"><div className="text-lg">⏱️</div><div className="text-[10px] opacity-55 font-bold">المدة</div><div className="text-sm font-black">{trip.duration_hours} ساعات</div></div>
          <div className="card p-3 text-center"><div className="text-lg">🧭</div><div className="text-[10px] opacity-55 font-bold">المسافة</div><div className="text-sm font-black">{trip.distance_km} كم</div></div>
          <div className="card p-3 text-center"><div className="text-lg">👥</div><div className="text-[10px] opacity-55 font-bold">السعة</div><div className="text-sm font-black">{trip.capacity} شخص</div></div>
        </div>

        {/* الوصف */}
        <div className="card p-4 mt-3">
          <h2 className="font-extrabold text-sm text-gold-600 dark:text-gold-400 mb-1.5">عن الرحلة</h2>
          <p className="text-sm leading-6 opacity-85">{trip.description}</p>
          <div className="text-xs font-bold opacity-60 mt-2 flex items-center gap-1.5"><Icon name="building" size={14} /> المزود: {trip.provider_name}</div>
          {reserve && (
            <div className="mt-2 text-xs font-bold rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 p-2.5">
              🏞️ داخل {reserve.name} — أفضل وقت للزيارة: {reserve.best_time}
            </div>
          )}
        </div>

        {/* السعر + زر الحجز */}
        <div className="card p-4 mt-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] opacity-55 font-bold">{t("startsFrom")}</div>
            <div className="text-2xl font-black text-gold-600 dark:text-gold-400">{SAR(trip.price)}</div>
            <div className="text-[10px] opacity-45 font-bold">الأطفال: {SAR(childPrice)}</div>
          </div>
          <button onClick={() => setBooking(true)} className="btn-gold px-8">{t("bookNow")}</button>
        </div>

        {/* التقييمات */}
        <h2 className="font-extrabold text-gold-600 dark:text-gold-400 mt-6 mb-2">التقييمات ({reviews.length})</h2>
        <p className="text-[11px] opacity-50 font-bold mb-3">✅ التقييمات موثقة — لا يُقيّم إلا ضيف حجز الرحلة فعلياً عبر نزهة</p>
        {reviews.length === 0 && <div className="card p-4 text-sm opacity-60 font-bold">لا توجد تقييمات بعد — كن أول من يجرب!</div>}
        <div className="space-y-2.5">
          {reviews.map((r) => (
            <div key={r.id} className="card p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-sm">{r.user_name}</span>
                <Stars value={r.rating} />
              </div>
              {r.text && <p className="text-xs leading-5 opacity-75 mt-1.5">{r.text}</p>}
              {r.reply && (
                <div className="mt-2 rounded-lg bg-gold-500/10 border border-gold-500/30 p-2 text-[11px]">
                  <span className="font-black text-gold-600 dark:text-gold-400">رد {trip.provider_name}: </span>{r.reply}
                </div>
              )}
              <div className="text-[10px] opacity-40 mt-1.5">{fmtDate(r.created_at, lang)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* نافذة الحجز */}
      <Modal open={booking} onClose={() => { setBooking(false); setDone(null); }} title={done ? "" : `حجز: ${trip.title}`}>
        {done ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center mb-3"><Icon name="check" size={34} /></div>
            <h3 className="font-black text-lg">تم تأكيد حجزك 🎉</h3>
            <p className="text-sm opacity-60 font-bold mt-1">رقم الحجز #{done} — تجده في «رحلاتي»</p>
            <button onClick={() => nav("/my-trips")} className="btn-gold w-full mt-5">الذهاب إلى رحلاتي</button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* التاريخ */}
            <div>
              <span className="label">اختر التاريخ</span>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {trip.dates.map((d) => (
                  <button key={d} onClick={() => setDate(d)}
                    className={`chip !px-3 text-xs ${date === d ? "chip-active" : ""}`}>
                    {fmtDate(d, lang)}
                  </button>
                ))}
              </div>
            </div>
            {/* الأشخاص */}
            <div className="grid grid-cols-2 gap-3">
              {[{ label: "بالغين", value: adults, set: setAdults, min: 1 }, { label: "أطفال (أقل من 12)", value: children, set: setChildren, min: 0 }].map((row) => (
                <div key={row.label} className="card !rounded-xl p-3 flex items-center justify-between">
                  <span className="text-xs font-extrabold opacity-70">{row.label}</span>
                  <div className="flex items-center gap-2.5">
                    <button onClick={() => row.set(Math.max(row.min, row.value - 1))} className="w-7 h-7 rounded-lg border border-gold-500/50 text-gold-500 flex items-center justify-center"><Icon name="minus" size={14} /></button>
                    <span className="font-black w-5 text-center">{row.value}</span>
                    <button onClick={() => row.set(row.value + 1)} className="w-7 h-7 rounded-lg border border-gold-500/50 text-gold-500 flex items-center justify-center"><Icon name="plus" size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
            {/* ملاحظات */}
            <div>
              <span className="label">ملاحظات خاصة</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="هل لديك أي متطلبات إضافية أو صحية؟" className="input resize-none" />
            </div>
            {/* كود الخصم */}
            <div className="flex gap-2">
              <input value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="كود الخصم (اختياري)" className="input flex-1" />
              <button onClick={applyPromo} className="btn-outline text-xs whitespace-nowrap">تطبيق</button>
            </div>
            {/* ملخص الدفع */}
            <div className="card !rounded-xl p-3.5 text-sm space-y-1.5">
              <div className="flex justify-between"><span className="opacity-60 font-bold">بالغين × {adults}</span><span className="font-black">{SAR(adults * trip.price)}</span></div>
              {children > 0 && <div className="flex justify-between"><span className="opacity-60 font-bold">أطفال × {children}</span><span className="font-black">{SAR(children * childPrice)}</span></div>}
              {discount > 0 && <div className="flex justify-between text-emerald-600 dark:text-emerald-400"><span className="font-bold">خصم ({promoInfo!.code})</span><span className="font-black">-{SAR(discount)}</span></div>}
              <div className="border-t border-gold-500/30 pt-1.5 flex justify-between text-gold-600 dark:text-gold-400"><span className="font-black">المجموع</span><span className="font-black text-lg">{SAR(total)}</span></div>
            </div>
            {/* طريقة الدفع */}
            <div>
              <span className="label">طريقة الدفع</span>
              <div className="grid grid-cols-3 gap-2">
                {[{ k: "mada", l: "مدى", i: "💳" }, { k: "visa", l: "Visa", i: "💳" }, { k: "applepay", l: "Apple Pay", i: "" }].map((m) => (
                  <button key={m.k} onClick={() => setMethod(m.k)}
                    className={`chip justify-center text-xs w-full ${method === m.k ? "chip-active" : ""}`}>
                    {m.i} {m.l}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={confirm} disabled={busy} className="btn-gold w-full py-3">
              {busy ? "جارٍ التأكيد…" : user ? `تأكيد الحجز — ${SAR(total)}` : "سجل الدخول لإتمام الحجز"}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
