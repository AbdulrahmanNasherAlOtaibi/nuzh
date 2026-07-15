import { useState } from "react";
import { post } from "../lib/api";
import { useApp } from "../lib/store";
import { Modal } from "./ui";

/**
 * إدارة التحقق الثنائي (OTP عبر تطبيق مصادقة) — تُستخدم في «حسابي» ولوحة الأدمن.
 * التفعيل: توليد سر → إضافته لتطبيق المصادقة → تأكيد برمز.
 * التعطيل: كلمة المرور + رمز حالي.
 */
export function TwoFactorCard() {
  const { user, refresh, toast } = useApp();
  const [setup, setSetup] = useState<{ secret: string; otpauth: string } | null>(null);
  const [code, setCode] = useState("");
  const [disableOpen, setDisableOpen] = useState(false);
  const [disableForm, setDisableForm] = useState({ password: "", code: "" });
  const [busy, setBusy] = useState(false);

  if (!user) return null;
  const enabled = !!user.totpEnabled;

  const start = async () => {
    setBusy(true);
    try { setSetup(await post("/auth/2fa/setup")); setCode(""); }
    catch (e: any) { toast(e.message, "err"); }
    finally { setBusy(false); }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      await post("/auth/2fa/enable", { code });
      toast("تم تفعيل التحقق الثنائي ✅ حسابك أكثر أماناً الآن");
      setSetup(null); setCode("");
      await refresh();
    } catch (e: any) { toast(e.message, "err"); }
    finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await post("/auth/2fa/disable", disableForm);
      toast("تم تعطيل التحقق الثنائي");
      setDisableOpen(false); setDisableForm({ password: "", code: "" });
      await refresh();
    } catch (e: any) { toast(e.message, "err"); }
    finally { setBusy(false); }
  };

  const copySecret = () => {
    navigator.clipboard?.writeText(setup!.secret).then(() => toast("نُسخ المفتاح 📋"));
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-extrabold text-sm">🔐 التحقق الثنائي (OTP)</h3>
          <p className="text-[11px] font-bold opacity-55 mt-0.5">
            {enabled ? "مفعل — يُطلب رمز من تطبيق المصادقة عند كل دخول" : "طبقة حماية إضافية عبر تطبيق مصادقة (Google Authenticator وغيره)"}
          </p>
        </div>
        {enabled ? (
          <button onClick={() => setDisableOpen(true)} className="btn-outline text-xs whitespace-nowrap">تعطيل</button>
        ) : (
          <button onClick={start} disabled={busy} className="btn-gold text-xs whitespace-nowrap">تفعيل</button>
        )}
      </div>

      {/* نافذة الإعداد */}
      <Modal open={!!setup} onClose={() => setSetup(null)} title="تفعيل التحقق الثنائي">
        {setup && (
          <div className="space-y-4">
            <ol className="text-xs font-bold opacity-75 space-y-1.5 list-decimal ps-4 leading-5">
              <li>حمّل تطبيق مصادقة على جوالك (Google Authenticator أو Microsoft Authenticator أو Authy)</li>
              <li>من الجوال اضغط الزر أدناه لإضافة الحساب مباشرة، أو أدخل المفتاح يدوياً</li>
              <li>أدخل الرمز المكون من 6 أرقام الذي يظهر في التطبيق</li>
            </ol>
            <a href={setup.otpauth} className="btn-gold w-full block text-center text-sm">📲 إضافة إلى تطبيق المصادقة</a>
            <div>
              <span className="label">أو أدخل المفتاح يدوياً</span>
              <button onClick={copySecret} className="input !font-mono text-center tracking-wider break-all text-xs" dir="ltr" title="اضغط للنسخ">
                {setup.secret}
              </button>
            </div>
            <div>
              <span className="label">رمز التأكيد من التطبيق</span>
              <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="input text-center !text-xl tracking-[0.4em] font-black" dir="ltr" inputMode="numeric" placeholder="000000" />
            </div>
            <button onClick={confirm} disabled={busy || code.length !== 6} className="btn-gold w-full py-3">
              {busy ? "جارٍ التفعيل…" : "تأكيد التفعيل"}
            </button>
          </div>
        )}
      </Modal>

      {/* نافذة التعطيل */}
      <Modal open={disableOpen} onClose={() => setDisableOpen(false)} title="تعطيل التحقق الثنائي">
        <div className="space-y-3">
          <p className="text-xs font-bold opacity-60 leading-5">⚠️ تعطيل التحقق الثنائي يقلل أمان حسابك. للتأكيد أدخل كلمة المرور ورمزاً حالياً من التطبيق.</p>
          <div><span className="label">كلمة المرور</span><input type="password" value={disableForm.password} onChange={(e) => setDisableForm({ ...disableForm, password: e.target.value })} className="input" dir="ltr" /></div>
          <div><span className="label">رمز التحقق</span><input value={disableForm.code} onChange={(e) => setDisableForm({ ...disableForm, code: e.target.value.replace(/\D/g, "").slice(0, 6) })} className="input text-center tracking-[0.4em] font-black" dir="ltr" inputMode="numeric" placeholder="000000" /></div>
          <button onClick={disable} disabled={busy || !disableForm.password || disableForm.code.length !== 6} className="btn-outline w-full py-2.5 !border-red-500/50 !text-red-500">
            {busy ? "لحظات…" : "تعطيل التحقق الثنائي"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
