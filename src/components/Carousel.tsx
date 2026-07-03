import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

export interface Ad { id: number; title: string; subtitle: string; image: string; link: string }

export function AdsCarousel({ ads }: { ads: Ad[] }) {
  const [idx, setIdx] = useState(0);
  const [, nav] = useLocation();
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    if (ads.length < 2) return;
    timer.current = setInterval(() => setIdx((i) => (i + 1) % ads.length), 4500);
    return () => clearInterval(timer.current);
  }, [ads.length]);

  if (!ads.length) return null;
  return (
    <div className="relative rounded-3xl overflow-hidden h-56 mt-3 gold-frame">
      {ads.map((ad, i) => (
        <button
          key={ad.id}
          onClick={() => ad.link?.startsWith("/") && nav(ad.link)}
          className={`absolute inset-0 transition-opacity duration-700 ${i === idx ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        >
          <img src={ad.image} alt={ad.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-night-950/85 via-night-950/20 to-transparent" />
          <div className="absolute bottom-8 inset-x-0 px-5 text-center">
            <h2 className="text-white text-xl font-black drop-shadow">{ad.title}</h2>
            <p className="text-sand-100/85 text-xs font-bold mt-1">{ad.subtitle}</p>
          </div>
        </button>
      ))}
      <div className="absolute bottom-2.5 inset-x-0 flex justify-center gap-1.5">
        {ads.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className={`h-2 rounded-full transition-all ${i === idx ? "w-5 bg-gold-400" : "w-2 bg-white/40"}`}
          />
        ))}
      </div>
    </div>
  );
}
