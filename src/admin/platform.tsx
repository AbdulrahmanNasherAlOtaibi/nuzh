import { useEffect, useState } from "react";
import { get, put, post, del } from "../lib/api";
import { useApp } from "../lib/store";
import { Spinner, Badge, Modal } from "../components/ui";
import { Table, SectionHead } from "./AdminApp";
import { MAP_STYLES } from "../pages/MapPage";

/* 1️⃣1️⃣ الخريطة والمحميات + الشركاء + الإنجازات — تحكم كامل ببيانات المنصة */

const ZONE_TYPES = [
  ["allowed", "🟢 مسموح"],
  ["permit", "🟡 تصريح"],
  ["forbidden", "🔴 ممنوع"],
] as const;

const METRICS = ["trips", "distance", "reviews", "photos", "reserves", "children", "early", "categories", "articles"];

export function PlatformSection() {
  const { toast } = useApp();
  const [tab, setTab] = useState<"reserves" | "partners" | "achievements">("reserves");
  const [data, setData] = useState<any>(null);
  const [mapStyle, setMapStyle] = useState("satellite");
  const [reserveModal, setReserveModal] = useState<any>(null);
  const [zonesText, setZonesText] = useState("");
  const [animalsText, setAnimalsText] = useState("");
  const [partnerModal, setPartnerModal] = useState<any>(null);
  const [achModal, setAchModal] = useState<any>(null);

  const load = () =>
    Promise.all([get("/admin/reserves"), get("/admin/partners"), get("/admin/achievements")])
      .then(([r, p, a]) => {
        setData({ reserves: r.reserves, partners: p.partners, achievements: a.achievements });
        setMapStyle(r.map?.style || "satellite");
      })
      .catch(() => {});
  useEffect(() => { load(); }, []);
  if (!data) return <Spinner />;

  const openReserve = (r: any) => {
    setReserveModal(r);
    setZonesText(JSON.stringify(r.zones ?? [], null, 2));
    setAnimalsText(JSON.stringify(r.animals ?? [], null, 2));
  };

  const saveReserve = async () => {
    let zones: any, animals: any;
    try { zones = JSON.parse(zonesText); } catch { return toast("صيغة المناطق (JSON) غير صحيحة", "err"); }
    try { animals = JSON.parse(animalsText); } catch { return toast("صيغة الحيوانات (JSON) غير صحيحة", "err"); }
    const body = { ...reserveModal, zones, animals };
    try {
      if (reserveModal.id) await put(`/admin/reserves/${reserveModal.id}`, body);
      else await post("/admin/reserves", body);
      toast("حُفظت المحمية وستظهر على الخريطة فوراً");
      setReserveModal(null); load();
    } catch (e: any) { toast(e.message, "err"); }
  };

  const saveMapStyle = async (k: string) => {
    setMapStyle(k);
    try { await put("/admin/settings/map", { style: k }); toast("حُفظ النمط الافتراضي للخريطة"); }
    catch (e: any) { toast(e.message, "err"); }
  };

  const savePartner = async () => {
    try {
      if (partnerModal.id) await put(`/admin/partners/${partnerModal.id}`, partnerModal);
      else await post("/admin/partners", partnerModal);
      toast("حُفظ الشريك"); setPartnerModal(null); load();
    } catch (e: any) { toast(e.message, "err"); }
  };

  const saveAch = async () => {
    try {
      if (achModal.id) await put(`/admin/achievements/${achModal.id}`, achModal);
      else await post("/admin/achievements", achModal);
      toast("حُفظ الإنجاز"); setAchModal(null); load();
    } catch (e: any) { toast(e.message, "err"); }
  };

  return (
    <div>
      <SectionHead title="الخريطة والمحميات" sub="تحكم كامل: المحميات ومناطقها على الخريطة، نمط الخريطة، الشركاء، وكتالوج الإنجازات">
        {[["reserves", "🏞️ المحميات والخريطة"], ["partners", "🤝 الشركاء"], ["achievements", "🏅 الإنجازات"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as any)} className={`chip text-xs ${tab === k ? "chip-active" : ""}`}>{l}</button>
        ))}
      </SectionHead>

      {tab === "reserves" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="font-extrabold text-sm mb-2">🗺️ النمط الافتراضي للخريطة (لكل الزوار)</h3>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(MAP_STYLES).map(([k, s]) => (
                <button key={k} onClick={() => saveMapStyle(k)} className={`chip text-xs ${mapStyle === k ? "chip-active" : ""}`}>{s.label}</button>
              ))}
            </div>
            <p className="text-[10px] font-bold opacity-50 mt-2">الزائر يقدر يبدل النمط لنفسه من الخريطة — هذا يحدد النمط الأول اللي يستقبله.</p>
          </div>

          <button onClick={() => openReserve({ name: "", description: "", area_km2: 0, center_lat: 24.9, center_lng: 46.6, zoom: 8, visitors: 0, best_time: "", zones: [], animals: [] })} className="btn-gold text-xs">+ محمية جديدة</button>

          <Table
            headers={["المحمية", "المساحة كم²", "الزوار الحاليون", "المناطق", "أفضل وقت", "إجراءات"]}
            rows={data.reserves.map((r: any) => [
              <span className="font-extrabold">{r.name}</span>,
              r.area_km2.toLocaleString("en"),
              r.visitors.toLocaleString("en"),
              <div className="flex gap-1 flex-wrap">
                {r.zones.map((z: any, i: number) => (
                  <Badge key={i} tone={z.type === "allowed" ? "green" : z.type === "permit" ? "gold" : "red"}>{z.name}</Badge>
                ))}
              </div>,
              r.best_time || "—",
              <div className="flex gap-1">
                <button onClick={() => openReserve(r)} className="text-[10px] font-black rounded-lg border border-gold-500/50 text-gold-600 px-2 py-1">تعديل</button>
                <button onClick={async () => { if (window.confirm(`حذف ${r.name}؟ ستختفي من الخريطة فوراً.`)) { await del(`/admin/reserves/${r.id}`); load(); } }} className="text-[10px] font-black rounded-lg border border-red-500/50 text-red-500 px-2 py-1">حذف</button>
              </div>,
            ])}
          />
        </div>
      )}

      {tab === "partners" && (
        <div>
          <button onClick={() => setPartnerModal({ name: "", kind: "شريك نجاح", logo: "", sort: data.partners.length })} className="btn-gold text-xs mb-3">+ شريك جديد</button>
          <Table
            headers={["الشعار", "الاسم", "الصفة", "الترتيب", "إجراءات"]}
            rows={data.partners.map((p: any) => [
              <span className="text-xl">{p.logo}</span>, p.name, p.kind, p.sort,
              <div className="flex gap-1">
                <button onClick={() => setPartnerModal(p)} className="text-[10px] font-black rounded-lg border border-gold-500/50 text-gold-600 px-2 py-1">تعديل</button>
                <button onClick={async () => { if (window.confirm("حذف الشريك؟")) { await del(`/admin/partners/${p.id}`); load(); } }} className="text-[10px] font-black rounded-lg border border-red-500/50 text-red-500 px-2 py-1">حذف</button>
              </div>,
            ])}
          />
        </div>
      )}

      {tab === "achievements" && (
        <div>
          <button onClick={() => setAchModal({ code: "", title: "", description: "", icon: "🏅", metric: "trips", target: 1 })} className="btn-gold text-xs mb-3">+ إنجاز جديد</button>
          <Table
            headers={["الأيقونة", "الإنجاز", "الوصف", "المقياس", "الهدف", "إجراءات"]}
            rows={data.achievements.map((a: any) => [
              <span className="text-xl">{a.icon}</span>,
              <span className="font-extrabold">{a.title}</span>,
              <span className="text-xs opacity-70">{a.description}</span>,
              <Badge tone="gold">{a.metric}</Badge>, a.target,
              <div className="flex gap-1">
                <button onClick={() => setAchModal(a)} className="text-[10px] font-black rounded-lg border border-gold-500/50 text-gold-600 px-2 py-1">تعديل</button>
                <button onClick={async () => { if (window.confirm("حذف الإنجاز؟")) { await del(`/admin/achievements/${a.id}`); load(); } }} className="text-[10px] font-black rounded-lg border border-red-500/50 text-red-500 px-2 py-1">حذف</button>
              </div>,
            ])}
          />
        </div>
      )}

      {/* ---------- نافذة المحمية ---------- */}
      <Modal open={!!reserveModal} onClose={() => setReserveModal(null)} title={reserveModal?.id ? `تعديل: ${reserveModal.name}` : "محمية جديدة"}>
        {reserveModal && (
          <div className="space-y-3">
            <div><span className="label">اسم المحمية</span><input value={reserveModal.name} onChange={(e) => setReserveModal({ ...reserveModal, name: e.target.value })} className="input" /></div>
            <div><span className="label">الوصف</span><textarea value={reserveModal.description} onChange={(e) => setReserveModal({ ...reserveModal, description: e.target.value })} rows={2} className="input resize-none" /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><span className="label">المساحة كم²</span><input type="number" value={reserveModal.area_km2} onChange={(e) => setReserveModal({ ...reserveModal, area_km2: Number(e.target.value) })} className="input" /></div>
              <div><span className="label">الزوار الحاليون</span><input type="number" value={reserveModal.visitors} onChange={(e) => setReserveModal({ ...reserveModal, visitors: Number(e.target.value) })} className="input" /></div>
              <div><span className="label">أفضل وقت</span><input value={reserveModal.best_time} onChange={(e) => setReserveModal({ ...reserveModal, best_time: e.target.value })} className="input" /></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><span className="label">مركز الخريطة Lat</span><input type="number" step="0.01" value={reserveModal.center_lat} onChange={(e) => setReserveModal({ ...reserveModal, center_lat: Number(e.target.value) })} className="input" dir="ltr" /></div>
              <div><span className="label">Lng</span><input type="number" step="0.01" value={reserveModal.center_lng} onChange={(e) => setReserveModal({ ...reserveModal, center_lng: Number(e.target.value) })} className="input" dir="ltr" /></div>
              <div><span className="label">Zoom</span><input type="number" value={reserveModal.zoom} onChange={(e) => setReserveModal({ ...reserveModal, zoom: Number(e.target.value) })} className="input" dir="ltr" /></div>
            </div>
            <div>
              <span className="label">المناطق على الخريطة (JSON) — التصنيفات: {ZONE_TYPES.map(([k, l]) => `${k}=${l}`).join("، ")}</span>
              <textarea value={zonesText} onChange={(e) => setZonesText(e.target.value)} rows={8} className="input resize-y !font-mono !text-[11px]" dir="ltr" spellCheck={false} />
              <p className="text-[10px] font-bold opacity-50 mt-1">كل منطقة: {"{ \"name\": \"...\", \"type\": \"allowed\", \"polygon\": [[lat,lng], ...] }"} — بحد أدنى 3 نقاط</p>
            </div>
            <div>
              <span className="label">الحيوانات (JSON)</span>
              <textarea value={animalsText} onChange={(e) => setAnimalsText(e.target.value)} rows={3} className="input resize-y !font-mono !text-[11px]" dir="ltr" spellCheck={false} />
              <p className="text-[10px] font-bold opacity-50 mt-1">مثال: {"[{ \"name\": \"المها العربي\", \"icon\": \"🦌\" }]"}</p>
            </div>
            <button onClick={saveReserve} className="btn-gold w-full">حفظ المحمية</button>
          </div>
        )}
      </Modal>

      {/* ---------- نافذة الشريك ---------- */}
      <Modal open={!!partnerModal} onClose={() => setPartnerModal(null)} title={partnerModal?.id ? "تعديل شريك" : "شريك جديد"}>
        {partnerModal && (
          <div className="space-y-3">
            <div><span className="label">الاسم</span><input value={partnerModal.name} onChange={(e) => setPartnerModal({ ...partnerModal, name: e.target.value })} className="input" /></div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2"><span className="label">الصفة</span><input value={partnerModal.kind} onChange={(e) => setPartnerModal({ ...partnerModal, kind: e.target.value })} className="input" /></div>
              <div><span className="label">الشعار (إيموجي)</span><input value={partnerModal.logo} onChange={(e) => setPartnerModal({ ...partnerModal, logo: e.target.value })} className="input text-center" /></div>
            </div>
            <div><span className="label">الترتيب</span><input type="number" value={partnerModal.sort} onChange={(e) => setPartnerModal({ ...partnerModal, sort: Number(e.target.value) })} className="input !w-24" /></div>
            <button onClick={savePartner} className="btn-gold w-full">حفظ</button>
          </div>
        )}
      </Modal>

      {/* ---------- نافذة الإنجاز ---------- */}
      <Modal open={!!achModal} onClose={() => setAchModal(null)} title={achModal?.id ? "تعديل إنجاز" : "إنجاز جديد"}>
        {achModal && (
          <div className="space-y-3">
            {!achModal.id && (
              <div><span className="label">الكود (إنجليزي فريد)</span><input value={achModal.code} onChange={(e) => setAchModal({ ...achModal, code: e.target.value.replace(/[^a-z0-9_]/g, "") })} className="input" dir="ltr" placeholder="first_trip" /></div>
            )}
            <div className="grid grid-cols-4 gap-2">
              <div className="col-span-3"><span className="label">العنوان</span><input value={achModal.title} onChange={(e) => setAchModal({ ...achModal, title: e.target.value })} className="input" /></div>
              <div><span className="label">الأيقونة</span><input value={achModal.icon} onChange={(e) => setAchModal({ ...achModal, icon: e.target.value })} className="input text-center" /></div>
            </div>
            <div><span className="label">الوصف</span><input value={achModal.description} onChange={(e) => setAchModal({ ...achModal, description: e.target.value })} className="input" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="label">المقياس</span>
                <select value={achModal.metric} onChange={(e) => setAchModal({ ...achModal, metric: e.target.value })} className="input">
                  {METRICS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div><span className="label">الهدف</span><input type="number" value={achModal.target} onChange={(e) => setAchModal({ ...achModal, target: Number(e.target.value) })} className="input" /></div>
            </div>
            <button onClick={saveAch} className="btn-gold w-full">حفظ</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
