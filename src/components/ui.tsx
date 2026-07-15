import { type ReactNode, useEffect } from "react";

/* ---------- أيقونات SVG خطية ---------- */
const PATHS: Record<string, ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5" />,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m14.8 9.2-1.8 4.6-4.6 1.8 1.8-4.6z" /></>,
  map: <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zm0 0v14m6-12v14" />,
  trips: <><path d="M4 17h16M6 17V9a6 6 0 0 1 12 0v8" /><path d="M12 3v2" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 5-5.5 8-5.5s6.5 1.5 8 5.5" /></>,
  shield: <path d="M12 3 5 6v5c0 5 3 8.5 7 10 4-1.5 7-5 7-10V6l-7-3z" />,
  star: <path d="m12 3 2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 16.8 6.4 20l1.3-6.2L3 9.5l6.3-.7L12 3z" />,
  heart: <path d="M12 20.5C6 16 3 12.7 3 9.3 3 6.9 4.9 5 7.3 5c1.7 0 3.4.9 4.7 2.9C13.3 5.9 15 5 16.7 5 19.1 5 21 6.9 21 9.3c0 3.4-3 6.7-9 11.2z" />,
  back: <path d="m9 5 7 7-7 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  share: <><circle cx="6" cy="12" r="2.5" /><circle cx="17" cy="6" r="2.5" /><circle cx="17" cy="18" r="2.5" /><path d="m8.3 10.8 6.4-3.6m-6.4 6.6 6.4 3.6" /></>,
  camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4V8z" /><circle cx="12" cy="13" r="3.5" /></>,
  bell: <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6zm4 9a2 2 0 0 0 4 0" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  pin: <><path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  ticket: <path d="M4 8a2 2 0 0 0 2-2h12a2 2 0 0 0 2 2v3a2 2 0 0 0 0 2v3a2 2 0 0 0-2 2H6a2 2 0 0 0-2-2v-3a2 2 0 0 0 0-2V8zm9-2v12" />,
  qr: <><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" /><path d="M14 14h3v3h-3zM19 14h1M14 19h1M17 17h3v3h-3z" /></>,
  logout: <path d="M15 4h4v16h-4M10 8l-4 4 4 4m-4-4h10" />,
  check: <path d="m5 13 4 4L19 7" />,
  x: <path d="m6 6 12 12M18 6 6 18" />,
  moon: <path d="M20 13A8 8 0 1 1 11 4a6.5 6.5 0 0 0 9 9z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  phone: <path d="M6 3h4l1.5 5L9 10a12 12 0 0 0 5 5l2-2.5L21 14v4a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
  leaf: <path d="M5 19C5 9 12 4 20 4c0 8-5 15-15 15zm0 0c2-5 6-9 11-11" />,
  edit: <path d="M4 20h4L19 9a2.5 2.5 0 0 0-4-3.5L4 16v4z" />,
  trash: <path d="M5 7h14m-9-3h4M7 7l1 13h8l1-13m-7 4v6m4-6v6" />,
  eye: <><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="2.8" /></>,
  chart: <path d="M4 20V10m6 10V4m6 16v-7m4 7H2" />,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c1-3.5 4-4.8 6.5-4.8s5.5 1.3 6.5 4.8" /><circle cx="17" cy="9" r="2.8" /><path d="M15.7 15.4c2.7.2 5 1.5 5.8 4.6" /></>,
  building: <path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16m0-11h4a1 1 0 0 1 1 1v10M2 21h20M8 8h3m-3 4h3m-3 4h3" />,
  wallet: <path d="M3 7a2 2 0 0 1 2-2h13v4h3v10H5a2 2 0 0 1-2-2V7zm14 7h.01" />,
  gift: <path d="M4 11h16v10H4zM2 7h20v4H2zm10 0v14m0-14s-1-4-4-4a2 2 0 0 0 0 4m4 0s1-4 4-4a2 2 0 0 1 0 4" />,
  doc: <path d="M6 3h9l4 4v14H6V3zm9 0v4h4M9 12h6m-6 4h6" />,
  cog: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9l2.1 2.1m10 10 2.1 2.1M4.9 19.1l2.1-2.1m10-10 2.1-2.1" /></>,
  msg: <path d="M4 5h16v11H8l-4 4V5z" />,
  send: <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />,
  download: <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" />,
  filter: <path d="M3 5h18l-7 8v6l-4-2v-4L3 5z" />,
  wifi: <path d="M2 9a15 15 0 0 1 20 0M6 13a9.5 9.5 0 0 1 12 0m-9 3.5a5 5 0 0 1 6 0M12 20h.01" />,
};

export function Icon({ name, size = 22, className = "", filled = false }: { name: string; size?: number; className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className}
      fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 1.8}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {PATHS[name] || null}
    </svg>
  );
}

export function Logo({ size = 52 }: { size?: number }) {
  return <img src="/logo.png" width={size} height={size} alt="نُزه" className="drop-shadow" />;
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-gold-500" dir="ltr">
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name="star" size={size} filled={i <= Math.round(value)} className={i <= Math.round(value) ? "" : "opacity-30"} />
      ))}
    </span>
  );
}

export function RatingBadge({ rating, count }: { rating: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-night-950/80 text-gold-300 px-2.5 py-1 text-xs font-bold backdrop-blur">
      <Icon name="star" size={12} filled /> {Number(rating || 0).toFixed(1)}
      {count != null && <span className="opacity-75">({count})</span>}
    </span>
  );
}

export function Badge({ children, tone = "gold" }: { children: ReactNode; tone?: "gold" | "green" | "red" | "gray" | "blue" | "amber" }) {
  const tones: Record<string, string> = {
    gold: "bg-gold-500/15 text-gold-600 dark:text-gold-300 border-gold-500/40",
    green: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
    red: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40",
    gray: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300 border-zinc-500/40",
    blue: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/40",
    amber: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${tones[tone]}`}>{children}</span>;
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between mt-7 mb-3">
      <h2 className="text-lg font-extrabold text-gold-600 dark:text-gold-400">{title}</h2>
      {action && (
        <button onClick={onAction} className="text-xs font-bold border border-gold-500/50 rounded-lg px-3 py-1.5 text-gold-600 dark:text-gold-300">
          {action}
        </button>
      )}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", fn);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", fn); document.body.style.overflow = ""; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div
        className={`card w-full ${wide ? "max-w-3xl" : "max-w-md"} max-h-[92vh] overflow-y-auto rounded-b-none sm:rounded-b-2xl p-5`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-base">{title}</h3>
          <button onClick={onClose} className="opacity-60 hover:opacity-100 p-1"><Icon name="x" size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center py-14">
      <div className="w-9 h-9 rounded-full border-[3px] border-gold-500/30 border-t-gold-500 animate-spin" />
    </div>
  );
}

export function Empty({ icon = "leaf", text }: { icon?: string; text: string }) {
  return (
    <div className="text-center py-12 opacity-60">
      <Icon name={icon} size={44} className="mx-auto mb-3 text-gold-500" />
      <p className="text-sm font-bold">{text}</p>
    </div>
  );
}

export function StatCard({ icon, label, value, sub, tone = "gold" }: { icon: string; label: string; value: ReactNode; sub?: string; tone?: string }) {
  const tones: Record<string, string> = {
    gold: "text-gold-500", green: "text-emerald-500", red: "text-red-500", blue: "text-sky-500", amber: "text-amber-500",
  };
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon name={icon} size={18} className={tones[tone] || tones.gold} />
        <span className="text-[11px] font-bold opacity-60">{label}</span>
      </div>
      <div className="text-xl font-black">{value}</div>
      {sub && <div className="text-[11px] opacity-50 mt-0.5">{sub}</div>}
    </div>
  );
}

/* ---------- رسوم بيانية SVG خفيفة ---------- */
export function BarChart({ data, height = 150, color = "#c9a95c" }: { data: { label: string; value: number }[]; height?: number; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="w-full overflow-x-auto no-scrollbar" dir="ltr">
      <svg width="100%" height={height + 26} viewBox={`0 0 ${data.length * 40} ${height + 26}`} preserveAspectRatio="none" className="min-w-[300px]">
        {data.map((d, i) => {
          const h = Math.max(3, (d.value / max) * height);
          return (
            <g key={i}>
              <rect x={i * 40 + 9} y={height - h} width={22} height={h} rx={5} fill={color} opacity={0.9} />
              <text x={i * 40 + 20} y={height + 16} textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.55">{d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function LineChart({ data, height = 150, color = "#4CAF50" }: { data: { label: string; value: number }[]; height?: number; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = data.length * 40;
  const pts = data.map((d, i) => [i * 40 + 20, height - (d.value / max) * (height - 12) - 4] as const);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
  return (
    <div className="w-full overflow-x-auto no-scrollbar" dir="ltr">
      <svg width="100%" height={height + 26} viewBox={`0 0 ${w} ${height + 26}`} preserveAspectRatio="none" className="min-w-[300px]">
        <path d={`${path} L${pts[pts.length - 1][0]},${height} L20,${height} Z`} fill={color} opacity="0.12" />
        <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={color} />)}
        {data.map((d, i) => (
          <text key={i} x={i * 40 + 20} y={height + 16} textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.55">{d.label}</text>
        ))}
      </svg>
    </div>
  );
}

export function Donut({ data, size = 150 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = Math.max(1, data.reduce((n, d) => n + d.value, 0));
  let acc = 0;
  const R = 40, C = 2 * Math.PI * R;
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <svg width={size} height={size} viewBox="0 0 100 100" className="-rotate-90">
        {data.map((d, i) => {
          const frac = d.value / total;
          const el = (
            <circle key={i} cx="50" cy="50" r={R} fill="none" stroke={d.color} strokeWidth="14"
              strokeDasharray={`${frac * C} ${C}`} strokeDashoffset={-acc * C} />
          );
          acc += frac;
          return el;
        })}
      </svg>
      <div className="space-y-1.5 text-xs font-bold">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ background: d.color }} />
            <span className="opacity-70">{d.label}</span>
            <span className="opacity-50">({Math.round((d.value / total) * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}
