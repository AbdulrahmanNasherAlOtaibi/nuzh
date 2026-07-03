import { useLocation } from "wouter";
import { SAR } from "../lib/api";
import { useApp } from "../lib/store";
import { Icon, RatingBadge } from "./ui";
import { useState } from "react";

export interface Trip {
  id: number; title: string; description: string; category: string; location: string;
  price: number; duration_hours: number; distance_km: number; image: string;
  rating: number; reviews_count: number; bookings_count: number;
  provider_name: string; weekend_offer: number; featured: number; dates: string[];
}

export function TripCard({ trip, badge }: { trip: Trip; badge?: string }) {
  const [, nav] = useLocation();
  const { t } = useApp();
  const [liked, setLiked] = useState(false);
  return (
    <button
      onClick={() => nav(`/trips/${trip.id}`)}
      className="card overflow-hidden text-start w-[240px] shrink-0 snap-start active:scale-[0.985] transition"
    >
      <div className="relative h-36">
        <img src={trip.image} alt={trip.title} className="w-full h-full object-cover" loading="lazy" />
        {badge && (
          <span className="absolute top-2 start-2 rounded-lg bg-gold-500/95 text-night-950 text-[10px] font-black px-2 py-1">{badge}</span>
        )}
        <span
          role="button"
          onClick={(e) => { e.stopPropagation(); setLiked(!liked); }}
          className="absolute top-2 end-2 w-8 h-8 rounded-full bg-sand-100/80 dark:bg-night-950/60 backdrop-blur flex items-center justify-center text-gold-600 dark:text-gold-300"
        >
          <Icon name="heart" size={16} filled={liked} className={liked ? "text-red-500" : ""} />
        </span>
        <span className="absolute bottom-2 start-2">
          <RatingBadge rating={trip.rating} count={trip.reviews_count} />
        </span>
      </div>
      <div className="p-3">
        <h3 className="font-extrabold text-sm truncate">{trip.title}</h3>
        <div className="flex items-center gap-1 text-[11px] opacity-55 mt-0.5">
          <Icon name="pin" size={12} />
          <span className="truncate">{trip.location}</span>
        </div>
        <div className="flex items-end justify-between mt-2">
          <span className="text-[11px] opacity-55">{t("startsFrom")}</span>
          <span className="text-gold-600 dark:text-gold-400 font-black">{SAR(trip.price)}</span>
        </div>
      </div>
    </button>
  );
}

export function TripRow({ trips, badge }: { trips: Trip[]; badge?: (t: Trip) => string | undefined }) {
  return (
    <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x pb-1 -mx-4 px-4">
      {trips.map((tr) => (
        <TripCard key={tr.id} trip={tr} badge={badge?.(tr)} />
      ))}
    </div>
  );
}
