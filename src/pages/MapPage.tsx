import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { get } from "../lib/api";
import { useApp } from "../lib/store";
import { Icon } from "../components/ui";

interface Zone { name: string; type: "allowed" | "permit" | "forbidden"; polygon: [number, number][] }
interface Reserve {
  id: number; name: string; description: string; area_km2: number; visitors: number;
  center_lat: number; center_lng: number; zoom: number; zones: Zone[]; best_time: string;
  animals: { name: string; icon: string }[];
}

const ZONE_STYLE: Record<string, { color: string; fill: string; label: string }> = {
  allowed: { color: "#2e7d32", fill: "#4CAF50", label: "مسموح الدخول" },
  permit: { color: "#b58900", fill: "#FFC107", label: "يتطلب تصريحاً" },
  forbidden: { color: "#c62828", fill: "#F44336", label: "ممنوع الدخول" },
};

export default function MapPage() {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useApp();
  const [reserves, setReserves] = useState<Reserve[]>([]);
  const [selected, setSelected] = useState<{ zone: Zone; reserve: Reserve } | null>(null);
  const [legendOpen, setLegendOpen] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>("");

  useEffect(() => { get("/reserves").then((d) => setReserves(d.reserves)).catch(() => {}); }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false }).setView([24.9, 46.6], 7);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { maxZoom: 18 }).addTo(map);
    L.control.zoom({ position: "bottomleft" }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // رسم المناطق
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !reserves.length) return;
    const layers: L.Layer[] = [];
    for (const reserve of reserves) {
      for (const zone of reserve.zones) {
        if (activeFilter && zone.type !== activeFilter) continue;
        const s = ZONE_STYLE[zone.type];
        const poly = L.polygon(zone.polygon as any, {
          color: s.color, weight: 2, fillColor: s.fill, fillOpacity: 0.35,
        }).addTo(map);
        poly.on("click", () => setSelected({ zone, reserve }));
        layers.push(poly);
      }
      const marker = L.marker([reserve.center_lat, reserve.center_lng], {
        icon: L.divIcon({
          className: "",
          html: `<div style="background:#12291b;color:#e8d5a3;border:1.5px solid #c9a95c;border-radius:12px;padding:3px 10px;font-weight:800;font-size:11px;white-space:nowrap;font-family:Cairo,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.35)">🏞️ ${reserve.name.replace("محمية ", "")}</div>`,
          iconAnchor: [60, 14],
        }),
      }).addTo(map);
      marker.on("click", () => map.setView([reserve.center_lat, reserve.center_lng], 9));
      layers.push(marker);
    }
    return () => layers.forEach((l) => map.removeLayer(l));
  }, [reserves, activeFilter]);

  const locate = () => {
    const map = mapRef.current;
    if (!map) return;
    navigator.geolocation?.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      L.circleMarker([latitude, longitude], { radius: 9, color: "#1976D2", fillColor: "#2196F3", fillOpacity: 0.9 }).addTo(map);
      map.setView([latitude, longitude], 10);
    });
  };

  return (
    <div className="relative h-[calc(100dvh-8.6rem)] max-w-3xl mx-auto w-full overflow-hidden">
      {/* بطاقة العنوان والدليل */}
      <div className="absolute top-3 inset-x-3 z-[1000]">
        <div className="bg-white/95 dark:bg-night-800/95 backdrop-blur rounded-2xl shadow-lg p-3.5 text-night-900 dark:text-sand-50">
          <h1 className="text-center font-black text-base">{t("mapTitle")}</h1>
          {legendOpen && (
            <div className="flex items-center justify-center gap-3 mt-2.5 text-[11px] font-extrabold flex-wrap">
              <button onClick={() => setActiveFilter("")} className={`flex items-center gap-1.5 ${!activeFilter ? "" : "opacity-50"}`}>
                <span className="w-3 h-3 rounded-full bg-[#2196F3]" /> {t("myLocation")}
              </button>
              {(["allowed", "permit", "forbidden"] as const).map((k) => (
                <button key={k} onClick={() => setActiveFilter(activeFilter === k ? "" : k)}
                  className={`flex items-center gap-1.5 ${!activeFilter || activeFilter === k ? "" : "opacity-40"}`}>
                  <span className="w-3 h-3 rounded-full" style={{ background: ZONE_STYLE[k].fill }} />
                  {k === "allowed" ? t("allowed") : k === "permit" ? t("permitNeeded") : t("forbidden")}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setLegendOpen(!legendOpen)} className="mx-auto block mt-1 opacity-50">
            <Icon name="back" size={15} className={legendOpen ? "rotate-90" : "-rotate-90"} />
          </button>
        </div>
        {/* أقسام المحميتين */}
        <div className="flex gap-2 mt-2">
          {reserves.map((r) => (
            <button key={r.id}
              onClick={() => mapRef.current?.setView([r.center_lat, r.center_lng], 9)}
              className="flex-1 bg-night-900/90 text-sand-100 border border-gold-500/50 backdrop-blur rounded-xl px-2 py-2 text-[10px] font-extrabold leading-tight">
              🏞️ {r.name.replace("محمية ", "")}
            </button>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* زر موقعي */}
      <button onClick={locate} className="absolute bottom-24 end-3 z-[1000] w-11 h-11 rounded-full bg-white dark:bg-night-800 shadow-lg flex items-center justify-center text-sky-500">
        <Icon name="pin" size={20} />
      </button>

      {/* بطاقة المنطقة المحددة — تظهر فوراً عند الضغط */}
      {selected && (
        <div className="absolute bottom-3 inset-x-3 z-[1000]">
          <div className="bg-white/97 dark:bg-night-800/97 backdrop-blur rounded-2xl shadow-xl p-4 text-night-900 dark:text-sand-50">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: ZONE_STYLE[selected.zone.type].fill }} />
                  <span className="font-black text-sm">{selected.zone.name}</span>
                </div>
                <div className="text-[11px] font-bold opacity-60 mt-0.5">{selected.reserve.name}</div>
              </div>
              <button onClick={() => setSelected(null)} className="opacity-50"><Icon name="x" size={18} /></button>
            </div>
            <div className="flex items-center gap-2 mt-2.5 flex-wrap text-[11px] font-extrabold">
              <span className={`rounded-full px-2.5 py-1 text-white`} style={{ background: ZONE_STYLE[selected.zone.type].color }}>
                {ZONE_STYLE[selected.zone.type].label}
              </span>
              <span className="rounded-full px-2.5 py-1 bg-gold-500/15 text-gold-700 dark:text-gold-300">👥 عدد الزوار الحالي: {selected.reserve.visitors.toLocaleString("en")}</span>
              <span className="rounded-full px-2.5 py-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">🗓️ أفضل وقت: {selected.reserve.best_time}</span>
            </div>
            <div className="flex gap-1.5 mt-2">
              {selected.reserve.animals.map((a) => (
                <span key={a.name} className="text-[10px] font-bold rounded-full border border-gold-500/40 px-2 py-0.5">{a.icon} {a.name}</span>
              ))}
            </div>
            {selected.zone.type === "permit" && (
              <a href="/my-trips?tab=permits" className="btn-gold w-full mt-3 block text-center text-sm">🎫 طلب تصريح دخول</a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
