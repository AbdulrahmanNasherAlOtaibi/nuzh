import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { get, CATEGORIES, AWARENESS } from "../lib/api";
import { useApp } from "../lib/store";
import { AdsCarousel, type Ad } from "../components/Carousel";
import { TripCard, type Trip } from "../components/TripCard";
import { Icon, SectionTitle, Spinner, Empty } from "../components/ui";

const TILES = [
  { key: "permits", ar: "التصاريح", en: "Permits", icon: "🎫" },
  ...CATEGORIES.map((c) => ({ key: c.key, ar: c.ar, en: c.en, icon: c.icon })).reverse(),
];

export default function Explore() {
  const search = useSearch();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const [, nav] = useLocation();
  const { t, lang } = useApp();
  const [ads, setAds] = useState<Ad[]>([]);
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [q, setQ] = useState("");

  const category = params.get("category") || "";
  const filter = params.get("filter") || "";
  const sort = params.get("sort") || "";

  useEffect(() => { get("/home").then((d) => setAds(d.ads)).catch(() => {}); }, []);
  useEffect(() => {
    setTrips(null);
    const qs = new URLSearchParams();
    if (category) qs.set("category", category);
    if (filter) qs.set("filter", filter);
    if (sort) qs.set("sort", sort);
    if (q) qs.set("q", q);
    get(`/trips?${qs}`).then((d) => setTrips(d.trips)).catch(() => setTrips([]));
  }, [category, filter, sort, q]);

  return (
    <div className="px-4 max-w-3xl mx-auto pb-6">
      {/* شبكة التصنيفات الستة أعلى الصفحة */}
      <div className="grid grid-cols-3 gap-2.5 mt-3">
        {TILES.map((tile) => {
          const active = tile.key === category || (tile.key === "permits" && false);
          return (
            <button
              key={tile.key}
              onClick={() => tile.key === "permits" ? nav("/my-trips?tab=permits") : nav(`/explore?category=${tile.key === category ? "" : tile.key}`)}
              className={`card p-3 flex flex-col items-center gap-1.5 active:scale-[0.97] transition ${active ? "!border-gold-500 ring-1 ring-gold-500/50" : ""}`}
            >
              <span className="text-2xl">{tile.icon}</span>
              <span className="text-[11px] font-extrabold text-center leading-tight">{lang === "en" ? tile.en : tile.ar}</span>
            </button>
          );
        })}
      </div>

      {/* التوعية البيئية */}
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-4 px-4 mt-4">
        {AWARENESS.map((c) => (
          <button key={c.key} onClick={() => nav(`/awareness/${c.key}`)} className="chip flex items-center gap-1.5 !py-1.5 text-xs">
            <span>{c.icon}</span> {lang === "en" ? c.en : c.ar}
          </button>
        ))}
      </div>

      <div className="mt-4"><AdsCarousel ads={ads} /></div>

      {/* البحث والفرز */}
      <div className="flex gap-2 mt-5">
        <div className="relative flex-1">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className="input ps-9" />
          <Icon name="search" size={16} className="absolute start-3 top-1/2 -translate-y-1/2 opacity-40" />
        </div>
        <select
          value={sort}
          onChange={(e) => { const p = new URLSearchParams(search); e.target.value ? p.set("sort", e.target.value) : p.delete("sort"); nav(`/explore?${p}`); }}
          className="input !w-auto text-xs font-bold"
        >
          <option value="">الأحدث</option>
          <option value="rating">الأعلى تقييماً</option>
          <option value="price">الأقل سعراً</option>
        </select>
      </div>

      <SectionTitle
        title={
          filter === "weekend" ? t("weekendOffers")
            : category ? `رحلات ${CATEGORIES.find((c) => c.key === category)?.[lang === "en" ? "en" : "ar"] || ""}`
            : t("exploreTrips")
        }
      />
      {!trips ? (
        <Spinner />
      ) : trips.length === 0 ? (
        <Empty text="لا توجد رحلات مطابقة حالياً" />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {trips.map((tr) => (
            <div key={tr.id} className="[&>button]:w-full">
              <TripCard trip={tr} badge={tr.weekend_offer ? "عرض 🔥" : undefined} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
