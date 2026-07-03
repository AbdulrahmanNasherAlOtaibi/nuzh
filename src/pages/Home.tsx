import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { get, CATEGORIES, AWARENESS } from "../lib/api";
import { useApp } from "../lib/store";
import { AdsCarousel, type Ad } from "../components/Carousel";
import { TripRow, type Trip } from "../components/TripCard";
import { SectionTitle, Spinner } from "../components/ui";
import { PartnersFooter } from "../components/layout";

interface HomeData {
  ads: Ad[]; loved: Trip[]; topRated: Trip[]; weekend: Trip[];
  partners: { id: number; name: string; kind: string; logo: string }[];
}

export default function Home() {
  const [data, setData] = useState<HomeData | null>(null);
  const [, nav] = useLocation();
  const { t, lang } = useApp();

  useEffect(() => { get("/home").then(setData).catch(() => {}); }, []);
  if (!data) return <Spinner />;

  return (
    <div className="px-4 max-w-3xl mx-auto pb-6">
      <AdsCarousel ads={data.ads} />

      {/* التصنيفات الرئيسية */}
      <SectionTitle title={t("mainCategories")} />
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
        {CATEGORIES.map((c) => (
          <button key={c.key} onClick={() => nav(`/explore?category=${c.key}`)} className="chip flex items-center gap-2">
            <span className="text-lg">{c.icon}</span>
            {lang === "en" ? c.en : c.ar}
          </button>
        ))}
      </div>

      {/* التوعية البيئية */}
      <SectionTitle title={t("ecoAwareness")} />
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
        {AWARENESS.map((c) => (
          <button key={c.key} onClick={() => nav(`/awareness/${c.key}`)} className="chip flex items-center gap-2">
            <span className="text-lg">{c.icon}</span>
            {lang === "en" ? c.en : c.ar}
          </button>
        ))}
      </div>

      {/* رحلات يحبها الضيوف */}
      {data.loved.length > 0 && (
        <>
          <SectionTitle title={t("lovedTrips")} action={t("viewAll")} onAction={() => nav("/explore")} />
          <TripRow trips={data.loved} badge={(tr) => (tr.id === data.loved[0]?.id && tr.bookings_count > 0 ? t("mostBooked") : undefined)} />
        </>
      )}

      {/* أعلى الرحلات تقييماً */}
      {data.topRated.length > 0 && (
        <>
          <SectionTitle title={t("topRated")} action={t("viewAll")} onAction={() => nav("/explore?sort=rating")} />
          <TripRow trips={data.topRated} badge={(tr) => (tr.rating >= 4.9 ? t("featured") : undefined)} />
        </>
      )}

      {/* عروض نهاية الأسبوع */}
      {data.weekend.length > 0 && (
        <>
          <SectionTitle title={t("weekendOffers")} action={t("viewAll")} onAction={() => nav("/explore?filter=weekend")} />
          <TripRow trips={data.weekend} />
        </>
      )}

      {data.loved.length === 0 && (
        <div className="card p-6 mt-7 text-center">
          <div className="text-3xl mb-2">🌿</div>
          <h3 className="font-black">الرحلات قادمة قريباً</h3>
          <p className="text-xs font-bold opacity-60 mt-1 leading-5">
            نستقبل الآن انضمام الشركات السياحية والمرشدين المعتمدين — وأول ما تُعتمد رحلاتهم ستجدها هنا.
          </p>
          <button onClick={() => nav("/provider")} className="btn-outline mt-4 text-xs">🏢 سجّل كمزود خدمة</button>
        </div>
      )}

      <button onClick={() => nav("/explore")} className="btn-outline w-full mt-7">{t("exploreTrips")}</button>

      <PartnersFooter partners={data.partners} />
    </div>
  );
}
