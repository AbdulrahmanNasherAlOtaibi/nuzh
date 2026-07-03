import { useEffect, useState } from "react";
import { get } from "../lib/api";
import { useApp } from "../lib/store";
import { Icon } from "../components/ui";

export default function Help() {
  const { t } = useApp();
  const [pub, setPub] = useState<any>(null);
  useEffect(() => { get("/public-settings").then(setPub).catch(() => {}); }, []);

  return (
    <div className="px-4 max-w-3xl mx-auto pb-6">
      <div className="card p-5 mt-4 text-center">
        <span className="w-14 h-14 mx-auto rounded-2xl bg-gold-500/15 text-gold-600 dark:text-gold-400 flex items-center justify-center"><Icon name="shield" size={28} /></span>
        <h1 className="font-black text-lg mt-2">مركز المساعدة</h1>
        <p className="text-xs font-bold opacity-55 mt-1">فريقنا جاهز لخدمتك على مدار الساعة</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <a href={`tel:${pub?.general?.phone || ""}`} className="card p-4 text-center">
          <Icon name="phone" size={24} className="mx-auto text-gold-500 mb-1.5" />
          <div className="font-extrabold text-sm">اتصل بنا</div>
          <div className="text-[11px] opacity-55 font-bold" dir="ltr">{pub?.general?.phone}</div>
        </a>
        <a href={`mailto:${pub?.general?.email || ""}`} className="card p-4 text-center">
          <Icon name="mail" size={24} className="mx-auto text-gold-500 mb-1.5" />
          <div className="font-extrabold text-sm">راسلنا</div>
          <div className="text-[11px] opacity-55 font-bold" dir="ltr">{pub?.general?.email}</div>
        </a>
      </div>

      <h2 className="font-extrabold text-gold-600 dark:text-gold-400 text-sm mt-6 mb-2">{t("faq")}</h2>
      <div className="space-y-2.5">
        {pub?.faq?.map((f: any, i: number) => (
          <details key={i} className="card p-3.5">
            <summary className="font-extrabold text-sm cursor-pointer">{f.q}</summary>
            <p className="text-xs leading-6 opacity-75 mt-2">{f.a}</p>
          </details>
        ))}
      </div>

      <h2 className="font-extrabold text-gold-600 dark:text-gold-400 text-sm mt-6 mb-2">{t("userGuide")}</h2>
      <div className="card p-4 space-y-3.5">
        {pub?.userGuide?.map((g: any, i: number) => (
          <div key={i} className="flex gap-3 items-start">
            <span className="text-2xl">{g.icon}</span>
            <div><div className="font-extrabold text-sm">{g.title}</div><p className="text-xs opacity-70 leading-5">{g.body}</p></div>
          </div>
        ))}
      </div>
    </div>
  );
}
