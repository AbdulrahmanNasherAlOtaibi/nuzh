import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { get, post, SAR, fmtDate } from "../lib/api";
import { useApp } from "../lib/store";
import { Icon, Stars, Spinner, Empty, Modal, Badge, StatCard } from "../components/ui";

interface Booking {
  id: number; trip_id: number; title: string; image: string; location: string; date: string;
  adults: number; children: number; total: number; status: string; photos: string[];
  my_rating: number | null; provider_name: string; duration_hours: number; distance_km: number;
}

const STATUS_AR: Record<string, { label: string; tone: any }> = {
  pending: { label: "بانتظار التأكيد", tone: "amber" },
  confirmed: { label: "مؤكد", tone: "green" },
  completed: { label: "مكتملة", tone: "blue" },
  cancelled: { label: "ملغية", tone: "gray" },
  refunded: { label: "مستردة", tone: "gray" },
  disputed: { label: "نزاع", tone: "red" },
};

function resizeImage(file: File, maxW = 1000): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export default function MyTrips() {
  const { user, t, lang, toast } = useApp();
  const [, nav] = useLocation();
  const search = useSearch();
  const initialTab = useMemo(() => new URLSearchParams(search).get("tab") || "upcoming", [search]);
  const [tab, setTab] = useState(initialTab);
  useEffect(() => setTab(initialTab), [initialTab]);

  const [data, setData] = useState<{ upcoming: Booking[]; past: Booking[] } | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [permits, setPermits] = useState<any[] | null>(null);
  const [reserves, setReserves] = useState<any[]>([]);
  const [reviewFor, setReviewFor] = useState<Booking | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [permitModal, setPermitModal] = useState(false);
  const [permitForm, setPermitForm] = useState({ reserveId: "", from: "", to: "" });

  const reload = () => {
    if (!user) return;
    get("/my/bookings").then(setData).catch(() => {});
    get("/my/stats").then(setStats).catch(() => {});
    get("/my/permits").then((d) => setPermits(d.permits)).catch(() => {});
    get("/reserves").then((d) => setReserves(d.reserves)).catch(() => {});
  };
  useEffect(reload, [user?.id]);

  if (!user)
    return (
      <div className="px-4 max-w-3xl mx-auto text-center py-16">
        <Icon name="trips" size={48} className="mx-auto text-gold-500 mb-4" />
        <h2 className="font-black text-lg">سجل دخولك لعرض رحلاتك</h2>
        <p className="text-sm opacity-60 font-bold mt-1">تابع حجوزاتك القادمة والسابقة وإحصائياتك وإنجازاتك</p>
        <button onClick={() => nav("/auth?next=/my-trips")} className="btn-gold mt-5 px-10">{t("login")}</button>
      </div>
    );

  const submitReview = async () => {
    try {
      await post("/reviews", { bookingId: reviewFor!.id, rating, text: reviewText });
      toast("شكراً لتقييمك ⭐");
      setReviewFor(null); setReviewText("");
      reload();
    } catch (e: any) { toast(e.message, "err"); }
  };

  const uploadPhoto = async (b: Booking, file: File) => {
    try {
      const photo = await resizeImage(file);
      await post(`/my/bookings/${b.id}/photos`, { photo });
      toast("تم رفع الصورة 📸");
      reload();
    } catch (e: any) { toast(e.message, "err"); }
  };

  const share = (b: Booking) => {
    const text = `جربت «${b.title}» عبر منصة نُزه 🌿 — أنصحكم فيها!`;
    if (navigator.share) navigator.share({ title: "نُزه", text, url: location.origin + `/trips/${b.trip_id}` }).catch(() => {});
    else { navigator.clipboard.writeText(text + " " + location.origin + `/trips/${b.trip_id}`); toast("نُسخ رابط المشاركة"); }
  };

  const cancelBooking = async (b: Booking) => {
    if (!window.confirm("هل أنت متأكد من إلغاء الحجز؟ سيُسترد المبلغ كاملاً.")) return;
    try { await post(`/my/bookings/${b.id}/cancel`); toast("تم الإلغاء والاسترداد"); reload(); }
    catch (e: any) { toast(e.message, "err"); }
  };

  const requestPermit = async () => {
    try {
      const d = await post("/my/permits", permitForm);
      toast(`تم إرسال طلب التصريح #${d.permitNo}`);
      setPermitModal(false);
      reload();
    } catch (e: any) { toast(e.message, "err"); }
  };

  const TABS = [
    { k: "upcoming", l: t("upcoming") }, { k: "past", l: t("past") },
    { k: "stats", l: t("stats") }, { k: "permits", l: t("permits") },
  ];

  const BookingCard = ({ b, past }: { b: Booking; past?: boolean }) => (
    <div className="card overflow-hidden">
      <div className="flex">
        <img src={b.image} className="w-28 object-cover" />
        <div className="p-3 flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-extrabold text-sm truncate">{b.title}</h3>
            <Badge tone={STATUS_AR[b.status]?.tone || "gray"}>{STATUS_AR[b.status]?.label || b.status}</Badge>
          </div>
          <div className="text-[11px] opacity-55 font-bold mt-1">🗓️ {fmtDate(b.date, lang)} · 👥 {b.adults + b.children} أشخاص</div>
          <div className="text-[11px] opacity-55 font-bold">🏢 {b.provider_name}</div>
          <div className="font-black text-gold-600 dark:text-gold-400 mt-1">{SAR(b.total)}</div>
        </div>
      </div>
      {past && b.status === "completed" ? (
        <div className="border-t border-sand-200 dark:border-night-600/50 px-3 py-2 flex items-center gap-2 flex-wrap">
          {b.my_rating ? (
            <span className="flex items-center gap-1 text-[11px] font-bold opacity-70">تقييمك: <Stars value={b.my_rating} size={12} /></span>
          ) : (
            <button onClick={() => { setReviewFor(b); setRating(5); }} className="text-[11px] font-black text-gold-600 dark:text-gold-400 flex items-center gap-1">
              <Icon name="star" size={13} /> قيّم الرحلة
            </button>
          )}
          <label className="text-[11px] font-black text-gold-600 dark:text-gold-400 flex items-center gap-1 cursor-pointer">
            <Icon name="camera" size={14} /> أرفق صورة
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPhoto(b, e.target.files[0])} />
          </label>
          <button onClick={() => share(b)} className="text-[11px] font-black text-gold-600 dark:text-gold-400 flex items-center gap-1">
            <Icon name="share" size={13} /> شارك
          </button>
          {b.photos.length > 0 && (
            <div className="w-full flex gap-1.5 mt-1 overflow-x-auto no-scrollbar">
              {b.photos.map((p, i) => <img key={i} src={p} className="h-14 w-20 object-cover rounded-lg" />)}
            </div>
          )}
        </div>
      ) : !past && ["pending", "confirmed"].includes(b.status) ? (
        <div className="border-t border-sand-200 dark:border-night-600/50 px-3 py-2 flex justify-between items-center">
          <span className="text-[11px] font-bold opacity-50">إلغاء مجاني قبل 48 ساعة</span>
          <button onClick={() => cancelBooking(b)} className="text-[11px] font-black text-red-500">إلغاء الحجز</button>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="px-4 max-w-3xl mx-auto pb-6">
      <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
        {TABS.map((x) => (
          <button key={x.k} onClick={() => setTab(x.k)} className={`chip text-xs ${tab === x.k ? "chip-active" : ""}`}>{x.l}</button>
        ))}
      </div>

      {/* القادمة */}
      {tab === "upcoming" && (
        !data ? <Spinner /> : (
          <div className="space-y-3 mt-4">
            <button onClick={() => nav("/explore")} className="w-full card !border-dashed !border-gold-500/60 p-4 flex items-center justify-center gap-2 text-gold-600 dark:text-gold-400 font-black text-sm">
              <Icon name="plus" size={18} /> {t("planNewTrip")}
            </button>
            {data.upcoming.length === 0
              ? <Empty icon="compass" text="لا توجد رحلات قادمة — خطط لمغامرتك الجاية!" />
              : data.upcoming.map((b) => <BookingCard key={b.id} b={b} />)}
          </div>
        )
      )}

      {/* السابقة */}
      {tab === "past" && (
        !data ? <Spinner /> : (
          <div className="space-y-3 mt-4">
            {data.past.length === 0
              ? <Empty text="لا توجد رحلات سابقة بعد" />
              : data.past.map((b) => <BookingCard key={b.id} b={b} past />)}
          </div>
        )
      )}

      {/* الإحصائيات */}
      {tab === "stats" && (
        !stats ? <Spinner /> : (
          <div className="mt-4">
            {/* نظرة عامة + تقييم الحساب */}
            <div className="card p-4 text-center">
              <div className="text-[11px] font-bold opacity-55">تقييم حسابك كرحّالة</div>
              <div className="flex justify-center mt-1"><Stars value={stats.score} size={26} /></div>
              <div className="font-black text-2xl text-gold-600 dark:text-gold-400 mt-1">{stats.score} / 5</div>
            </div>
            <div className="grid grid-cols-3 gap-2.5 mt-3">
              <StatCard icon="trips" label="إجمالي الرحلات" value={stats.completedCount} />
              <StatCard icon="map" label="المسافة المقطوعة" value={`${stats.distance.toLocaleString("en")} كم`} tone="green" />
              <StatCard icon="heart" label="الرحلة المفضلة" value={<span className="text-xs leading-tight block">{stats.favorite}</span>} tone="red" />
            </div>

            {/* الإنجازات */}
            <h3 className="font-extrabold text-gold-600 dark:text-gold-400 mt-6 mb-2">{t("achievements")} ({stats.achievements.filter((a: any) => a.unlocked).length}/{stats.achievements.length})</h3>
            <div className="grid grid-cols-2 gap-2.5">
              {stats.achievements.map((a: any) => (
                <div key={a.id} className={`card p-3 ${a.unlocked ? "!border-gold-500/70" : "opacity-60"}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl ${a.unlocked ? "" : "grayscale"}`}>{a.icon}</span>
                    <div className="min-w-0">
                      <div className="font-extrabold text-xs truncate">{a.title}</div>
                      <div className="text-[10px] opacity-55 font-bold leading-tight">{a.description}</div>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-sand-200 dark:bg-night-600/60 overflow-hidden">
                    <div className="h-full bg-gold-500 rounded-full transition-all" style={{ width: `${(a.progress / a.target) * 100}%` }} />
                  </div>
                  <div className="text-[9px] font-bold opacity-45 mt-1 text-end">{a.progress}/{a.target}</div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* التصاريح */}
      {tab === "permits" && (
        !permits ? <Spinner /> : (
          <div className="space-y-3 mt-4">
            <p className="text-[11px] font-bold opacity-55 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
              🎫 التصاريح تصدر بالتكامل مع المركز الوطني لتنمية الحياة الفطرية — بعض مناطق المحميات يلزمها تصريح دخول (المناطق الصفراء على الخريطة).
            </p>
            {permits.map((p) => (
              <div key={p.id} className="card p-4 flex gap-3 items-center">
                <div className="w-16 h-16 rounded-xl border-2 border-night-900 dark:border-sand-100 flex items-center justify-center shrink-0">
                  <Icon name="qr" size={40} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm">تصريح #{p.permit_no}</span>
                    <Badge tone={p.status === "active" ? "green" : p.status === "review" ? "amber" : "gray"}>
                      {p.status === "active" ? "ساري" : p.status === "review" ? "قيد المراجعة" : p.status === "expired" ? "منتهي" : "مرفوض"}
                    </Badge>
                  </div>
                  <div className="text-[11px] font-bold opacity-60 mt-0.5 truncate">{p.reserve_name}</div>
                  <div className="text-[10px] font-bold opacity-45">من {fmtDate(p.from_date, lang)} إلى {fmtDate(p.to_date, lang)}</div>
                </div>
              </div>
            ))}
            <button onClick={() => setPermitModal(true)} className="btn-gold w-full">طلب تصريح جديد</button>
          </div>
        )
      )}

      {/* نافذة التقييم */}
      <Modal open={!!reviewFor} onClose={() => setReviewFor(null)} title={`تقييم: ${reviewFor?.title || ""}`}>
        <p className="text-[11px] font-bold opacity-55 mb-3">تقييمك موثوق لأنك حجزت هذه الرحلة فعلياً عبر نُزه ✅</p>
        <div className="flex justify-center gap-1 mb-4" dir="ltr">
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} onClick={() => setRating(i)} className={i <= rating ? "text-gold-500" : "text-gold-500 opacity-25"}>
              <Icon name="star" size={34} filled />
            </button>
          ))}
        </div>
        <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} rows={3} placeholder="اكتب تجربتك (اختياري)…" className="input resize-none mb-4" />
        <button onClick={submitReview} className="btn-gold w-full">إرسال التقييم</button>
      </Modal>

      {/* نافذة طلب تصريح */}
      <Modal open={permitModal} onClose={() => setPermitModal(false)} title="طلب تصريح دخول">
        <div className="space-y-3">
          <div>
            <span className="label">المحمية</span>
            <select value={permitForm.reserveId} onChange={(e) => setPermitForm({ ...permitForm, reserveId: e.target.value })} className="input">
              <option value="">اختر المحمية…</option>
              {reserves.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><span className="label">من تاريخ</span><input type="date" value={permitForm.from} onChange={(e) => setPermitForm({ ...permitForm, from: e.target.value })} className="input" /></div>
            <div><span className="label">إلى تاريخ</span><input type="date" value={permitForm.to} onChange={(e) => setPermitForm({ ...permitForm, to: e.target.value })} className="input" /></div>
          </div>
          <button onClick={requestPermit} disabled={!permitForm.reserveId || !permitForm.from || !permitForm.to} className="btn-gold w-full">إرسال الطلب</button>
        </div>
      </Modal>
    </div>
  );
}
