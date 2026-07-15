import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { get, SAR, fmtDate, catLabel } from "../lib/api";
import { useApp } from "../lib/store";
import { Icon, Stars, RatingBadge, Spinner, Badge } from "../components/ui";
import type { Trip } from "../components/TripCard";

interface Review { id: number; user_name: string; rating: number; text: string; reply: string; created_at: string }

const WHATSAPP_NUMBER = "966557517267";

export default function TripDetails() {
  const [, params] = useRoute("/trips/:id");
  const [, nav] = useLocation();
  const { t, lang } = useApp();
  const [data, setData] = useState<{ trip: Trip & { child_price: number; capacity: number }; reviews: Review[]; reserve: any } | null>(null);

  useEffect(() => {
    get(`/trips/${params?.id}`).then(setData).catch(() => nav("/"));
  }, [params?.id]);

  if (!data) return <Spinner />;
  const { trip, reviews, reserve } = data;
  const childPrice = trip.child_price || Math.round(trip.price / 2);
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`مرحباً، أبي أحجز رحلة: ${trip.title}`)}`;

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
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn-gold px-8">{t("bookNow")}</a>
        </div>

        {/* التقييمات */}
        <h2 className="font-extrabold text-gold-600 dark:text-gold-400 mt-6 mb-2">التقييمات ({reviews.length})</h2>
        <p className="text-[11px] opacity-50 font-bold mb-3">✅ التقييمات موثقة — لا يُقيّم إلا ضيف حجز الرحلة فعلياً عبر نُزه</p>
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
    </div>
  );
}
