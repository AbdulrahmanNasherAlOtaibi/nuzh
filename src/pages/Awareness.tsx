import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { get, AWARENESS, fmtDate } from "../lib/api";
import { useApp } from "../lib/store";
import { Spinner, Empty, Modal } from "../components/ui";

interface Item { id: number; kind: string; title: string; body: string; image: string; author: string; created_at: string }

export default function Awareness() {
  const [, params] = useRoute("/awareness/:kind");
  const { lang } = useApp();
  const [kind, setKind] = useState(params?.kind || "article");
  const [items, setItems] = useState<Item[] | null>(null);
  const [open, setOpen] = useState<Item | null>(null);

  useEffect(() => { if (params?.kind) setKind(params.kind); }, [params?.kind]);
  useEffect(() => {
    setItems(null);
    get(`/content?kind=${kind}`).then((d) => {
      setItems(d.items);
      // إنجاز «صديق البيئة» — عدّاد قراءة محلي
      const read = Number(localStorage.getItem("nuzh_reads") || 0);
      localStorage.setItem("nuzh_reads", String(read + 1));
    }).catch(() => setItems([]));
  }, [kind]);

  return (
    <div className="px-4 max-w-3xl mx-auto pb-6">
      <h1 className="font-black text-lg text-gold-600 dark:text-gold-400 mt-4">التوعية البيئية</h1>
      <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar -mx-4 px-4">
        {AWARENESS.map((c) => (
          <button key={c.key} onClick={() => setKind(c.key)} className={`chip text-xs flex items-center gap-1.5 ${kind === c.key ? "chip-active" : ""}`}>
            <span>{c.icon}</span> {lang === "en" ? c.en : c.ar}
          </button>
        ))}
      </div>

      {!items ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Empty text="لا يوجد محتوى بعد" />
      ) : (
        <div className="space-y-3 mt-4">
          {items.map((it) => (
            <button key={it.id} onClick={() => setOpen(it)} className="card w-full overflow-hidden text-start flex">
              <img src={it.image} className="w-28 object-cover" />
              <div className="p-3.5 flex-1 min-w-0">
                <h3 className="font-extrabold text-sm leading-snug">{it.title}</h3>
                <p className="text-[11px] opacity-60 font-bold leading-5 mt-1 line-clamp-2">{it.body}</p>
                <div className="text-[10px] opacity-40 font-bold mt-1.5">{it.author} · {fmtDate(it.created_at, lang)}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      <Modal open={!!open} onClose={() => setOpen(null)} title="">
        {open && (
          <div>
            <img src={open.image} className="w-full h-44 object-cover rounded-xl" />
            <h2 className="font-black text-lg mt-3">{open.title}</h2>
            <div className="text-[11px] opacity-50 font-bold mt-0.5">{open.author} · {fmtDate(open.created_at, lang)}</div>
            <p className="text-sm leading-7 opacity-85 mt-3">{open.body}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
