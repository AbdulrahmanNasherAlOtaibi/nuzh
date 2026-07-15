import crypto from "node:crypto";
import { db, now, getSetting, setSetting } from "./db.ts";
import { hashPassword } from "./auth.ts";

function polygon(points: [number, number][]): number[][] {
  return points.map(([lat, lng]) => [+lat.toFixed(4), +lng.toFixed(4)]);
}

/**
 * تهيئة الإطلاق: لا بيانات وهمية.
 * يُنشأ فقط: حساب الأدمن، المحميتان (بيانات مرجعية للخريطة)، كتالوج الإنجازات،
 * الشركاء، محتوى السلوك البيئي، وإعدادات المنصة.
 */
export function seedIfEmpty() {
  ensureAdmin();

  // علامة زرع مستقلة عن جدول المستخدمين — تمنع إعادة الزرع المزدوج عند كل تشغيل
  if (getSetting("seededAt", "")) return;

  const t = now();

  // ---------- المحميات (بيانات مرجعية للخريطة — حدّثها من قاعدة البيانات عند توفر الإحداثيات الرسمية) ----------
  const insReserve = db.prepare(
    "INSERT INTO reserves (name,description,area_km2,animals,center_lat,center_lng,zoom,zones,visitors,best_time) VALUES (?,?,?,?,?,?,?,?,?,?)"
  );
  insReserve.run(
    "محمية الإمام سعود بن عبدالعزيز الملكية",
    "من أكبر المحميات الملكية في المملكة، تتميز بتنوعها البيولوجي الفريد وتضم موائل طبيعية للمها العربي والغزلان والحبارى، مع مواقع مخصصة للتنزه البيئي المنظم.",
    10800,
    JSON.stringify([{ name: "المها العربي", icon: "🦌" }, { name: "غزال الريم", icon: "🦌" }, { name: "الحبارى", icon: "🦅" }]),
    25.15, 46.05, 8,
    JSON.stringify([
      { name: "منطقة التنزه العائلية", type: "allowed", polygon: polygon([[25.28, 45.82], [25.3, 46.1], [25.12, 46.25], [24.95, 46.12], [24.9, 45.85], [25.08, 45.72]]) },
      { name: "موائل المها العربي", type: "permit", polygon: polygon([[25.42, 45.62], [25.46, 45.85], [25.3, 45.95], [25.2, 45.78], [25.28, 45.6]]) },
      { name: "منطقة الإكثار المحمية", type: "forbidden", polygon: polygon([[25.5, 46.05], [25.52, 46.22], [25.4, 46.3], [25.33, 46.15], [25.4, 46.02]]) },
    ]),
    0, "أكتوبر — مارس"
  );
  insReserve.run(
    "محمية الإمام عبدالعزيز بن محمد الملكية",
    "تضم روضة خريم الشهيرة وتحتضن برامج إعادة توطين الكائنات الفطرية، وتُعد وجهة مفضلة لعشاق التخييم البيئي ومراقبة الطيور.",
    11300,
    JSON.stringify([{ name: "المها العربي", icon: "🦌" }, { name: "النعام", icon: "🦤" }, { name: "الصقور", icon: "🦅" }]),
    25.35, 47.25, 8,
    JSON.stringify([
      { name: "روضة خريم — التنزه", type: "allowed", polygon: polygon([[25.48, 47.1], [25.5, 47.4], [25.32, 47.5], [25.18, 47.32], [25.25, 47.08]]) },
      { name: "منطقة التخييم المنظم", type: "permit", polygon: polygon([[25.62, 47.4], [25.66, 47.6], [25.52, 47.68], [25.45, 47.5], [25.53, 47.36]]) },
      { name: "محمية الطيور الحوامة", type: "forbidden", polygon: polygon([[25.58, 47.02], [25.6, 47.18], [25.48, 47.24], [25.42, 47.1], [25.5, 46.98]]) },
    ]),
    0, "نوفمبر — فبراير"
  );

  // ---------- إعلانات افتتاحية (يديرها الأدمن من لوحة التحكم) ----------
  const insAd = db.prepare("INSERT INTO ads (title,subtitle,image,link,sort,active) VALUES (?,?,?,?,?,1)");
  insAd.run("اكتشف جمال محمياتنا", "رحلات بيئية فريدة في قلب الطبيعة", "/scenes/dunes-sunset.svg", "/explore", 0);
  insAd.run("انضم كمزود خدمة", "شركة سياحية أو مرشد؟ سجل وابدأ باستقبال الحجوزات", "/scenes/sarawat.svg", "/provider", 1);

  // ---------- محتوى السلوك البيئي الصحيح ----------
  const insContent = db.prepare("INSERT INTO contents (kind,title,body,image,author,created_at) VALUES (?,?,?,?,?,?)");
  insContent.run("behavior", "لا تترك أثراً إلا خطاك", "خذ كل مخلفاتك معك عند مغادرة موقع التنزه، وافرز ما يمكن تدويره. الطبيعة أمانة.", "/scenes/night-camp.svg", "فريق نُزه", t);
  insContent.run("behavior", "حافظ على مسافة آمنة من الحياة الفطرية", "لا تقترب من الحيوانات ولا تطعمها؛ فالاقتراب يسبب لها التوتر ويغير سلوكها الطبيعي. استخدم العدسات المقربة.", "/scenes/wildlife.svg", "فريق نُزه", t);
  insContent.run("behavior", "التزم بالمسارات المحددة", "الخروج عن المسارات يدمر الغطاء النباتي الهش ويزعج مواطن الكائنات. المسارات صُممت لحمايتك وحمايتها.", "/scenes/sarawat.svg", "فريق نُزه", t);
  insContent.run("behavior", "أشعل النار في الأماكن المخصصة فقط", "استخدم مواقد التخييم المخصصة وتأكد من إطفاء الجمر تماماً قبل المغادرة.", "/scenes/night-camp.svg", "فريق نُزه", t);
  insContent.run("behavior", "خفض الصوت.. من آداب البرية", "الضجيج يزعج الكائنات ويفسد تجربة الآخرين. استمتع بأصوات الطبيعة نفسها.", "/scenes/oasis.svg", "فريق نُزه", t);

  // ---------- كتالوج الإنجازات ----------
  const insAch = db.prepare("INSERT INTO achievements (code,title,description,icon,metric,target) VALUES (?,?,?,?,?,?)");
  const achievements: [string, string, string, string, string, number][] = [
    ["first_trip", "الخطوة الأولى", "أكمل رحلتك الأولى مع نُزه", "🥾", "trips", 1],
    ["five_trips", "رحّالة نشيط", "أكمل 5 رحلات", "🎒", "trips", 5],
    ["ten_trips", "مستكشف محترف", "أكمل 10 رحلات", "🏆", "trips", 10],
    ["twenty_trips", "أسطورة البراري", "أكمل 20 رحلة", "👑", "trips", 20],
    ["km_100", "على الدرب", "اقطع 100 كم في رحلاتك", "🛤️", "distance", 100],
    ["km_500", "قاهر المسافات", "اقطع 500 كم في رحلاتك", "🧭", "distance", 500],
    ["km_2000", "جوّاب آفاق", "اقطع 2000 كم في رحلاتك", "🌍", "distance", 2000],
    ["first_review", "صوتك يفرق", "اكتب تقييمك الأول", "⭐", "reviews", 1],
    ["five_reviews", "ناقد معتمد", "اكتب 5 تقييمات", "✍️", "reviews", 5],
    ["first_photo", "عدسة البرية", "ارفع صورة من إحدى رحلاتك", "📸", "photos", 1],
    ["ten_photos", "مصور الحياة الفطرية", "ارفع 10 صور من رحلاتك", "🎞️", "photos", 10],
    ["two_reserves", "سفير المحميات", "زر محميتين مختلفتين", "🏞️", "reserves", 2],
    ["family_trip", "العائلة أولاً", "احجز رحلة تضم أطفالاً", "👨‍👩‍👧‍👦", "children", 1],
    ["early_bird", "الطائر المبكر", "احجز رحلة قبل موعدها بأسبوعين", "🐦", "early", 1],
    ["all_categories", "ذواقة التجارب", "جرب 3 تصنيفات مختلفة من الرحلات", "🎯", "categories", 3],
    ["eco_reader", "صديق البيئة", "اطلع على 5 مواد من التوعية البيئية", "🌱", "articles", 5],
  ];
  for (const a of achievements) insAch.run(...a);

  // ---------- الشركاء ----------
  const insPartner = db.prepare("INSERT INTO partners (name,kind,logo,sort) VALUES (?,?,?,?)");
  insPartner.run("مؤسسة وقاد", "شريك النجاح", "🔥", 0);
  insPartner.run("الكراج", "داعم رسمي", "🏗️", 1);

  // ---------- الإعدادات ----------
  setSetting("general", {
    name: "نُزه",
    nameEn: "Nuzh",
    tagline: "السياحة البيئية في المحميات",
    email: "support@nuzh.sa",
    phone: "920012345",
    address: "الرياض، المملكة العربية السعودية",
  });
  setSetting("payment", {
    feePercent: 10,
    methods: { mada: true, visa: true, applepay: true },
    banks: [{ bank: "", iban: "", name: "منصة نُزه" }],
  });
  setSetting("security", { twoFactor: false, sessionDays: 30 });
  setSetting("platformAchievements", [
    { icon: "🎖️", title: "تكريم من قِبل معالي وزير الداخلية", body: "كُرّمت منصة نُزه من قِبل معالي وزير الداخلية ضمن مبادرات تعزيز السياحة الآمنة." },
    { icon: "🏆", title: "ضمن أفضل 15 فكرة في هاكاثون أبشر طويق", body: "برعاية صاحب السمو الملكي وزير الداخلية، اختيرت نُزه ضمن أفضل 15 فكرة على مستوى المملكة." },
    { icon: "🥇", title: "تكريم صاحب السمو محافظ حفر الباطن", body: "تكريم خاص لفريق نُزه على أثر المشروع في السياحة البيئية المحلية." },
    { icon: "🤝", title: "دعم واحتضان الكراج", body: "حصلت نُزه على دعم واحتضان من الكراج، أكبر حاضنة تقنية في المملكة." },
  ]);
  setSetting("about", "نُزه منصة سعودية تربط عشاق الطبيعة بالمحميات الملكية عبر رحلات بيئية منظمة ومرخصة، بالشراكة مع شركات سياحية ومرشدين معتمدين. رسالتنا: سياحة بيئية مستدامة تحفظ للبراري جمالها وللأجيال حقها.");
  setSetting("faq", [
    { q: "كيف أحجز رحلة؟", a: "اختر الرحلة المناسبة من الصفحة الرئيسية أو صفحة استكشف، ثم اضغط «احجز الآن» — يفتح لك واتساب مباشرة لإتمام الحجز مع فريق نُزه." },
    { q: "هل أحتاج تصريحاً لدخول المحمية؟", a: "بعض مناطق المحميات تتطلب تصريحاً مسبقاً — تظهر لك المناطق على الخريطة ملونة حسب التصنيف، ويمكنك طلب التصريح من قسم رحلاتي > التصاريح." },
    { q: "هل يمكنني إلغاء حجزي؟", a: "نعم، تواصل معنا عبر واتساب قبل 48 ساعة من موعد الرحلة لإلغاء الحجز واسترداد كامل المبلغ." },
    { q: "كيف أقيّم رحلة؟", a: "التقييم متاح فقط للرحلات التي حجزتها وأكملتها فعلياً — من رحلاتي > السابقة، وهذا يضمن مصداقية التقييمات." },
    { q: "كيف أنضم كمزود خدمة؟", a: "من بوابة مزودي الخدمة سجل كشركة سياحية أو مرشد سياحي، وبعد مراجعة الطلب تستطيع نشر رحلاتك واستقبال الحجوزات." },
  ]);
  setSetting("userGuide", [
    { icon: "🧭", title: "استكشف", body: "تصفح الرحلات حسب التصنيف: بيئية، ثقافية، ترفيهية، مغامرات، أو مع مرشد سياحي." },
    { icon: "🗺️", title: "الخريطة", body: "تعرف على مناطق التنزه: الأخضر مسموح، الأصفر يتطلب تصريحاً، الأحمر ممنوع." },
    { icon: "🎫", title: "احجز", body: "اضغط «احجز الآن» — يفتح لك واتساب مباشرة لتأكيد التاريخ والتفاصيل مع فريقنا." },
    { icon: "⭐", title: "قيّم", body: "بعد اكتمال رحلتك شارك تجربتك وصورك وحصّل الإنجازات." },
  ]);

  db.prepare("INSERT INTO activity_log (actor, action, created_at) VALUES (?,?,?)").run("النظام", "تم تجهيز المنصة للإطلاق", t);
  setSetting("seededAt", t);
  console.log("✅ تم تجهيز قاعدة البيانات (بدون بيانات تجريبية)");
}

/**
 * إنشاء حساب الأدمن — يعمل عند كل تشغيل (وليس مرة واحدة فقط):
 * إن وُجد ADMIN_EMAIL ولا يوجد أي أدمن بالنظام، يُنشأ الحساب.
 * لا بيانات دخول ثابتة بالكود إطلاقاً.
 */
function ensureAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const admins = (db.prepare("SELECT COUNT(*) c FROM users WHERE role='admin'").get() as { c: number }).c;
  if (admins > 0) return;
  if (!adminEmail) {
    console.warn(
      "⚠️  لم يُنشأ أي حساب أدمن — عرّف ADMIN_EMAIL (و ADMIN_PASSWORD اختيارياً) في متغيرات البيئة ثم أعد التشغيل."
    );
    return;
  }
  const exists = db.prepare("SELECT id FROM users WHERE email=?").get(adminEmail);
  if (exists) {
    console.warn(`⚠️  البريد ${adminEmail} مسجّل لحساب غير إداري — استخدم بريداً آخر للأدمن.`);
    return;
  }
  const t = now();
  const generatedPassword = !process.env.ADMIN_PASSWORD;
  const adminPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString("base64url");
  db.prepare(
    `INSERT INTO users (name,email,phone,password,role,city,status,email_verified,must_change_password,created_at,last_active)
     VALUES (?,?,?,?, 'admin','', 'active',1,?,?,?)`
  ).run("إدارة نُزه", adminEmail, "", hashPassword(adminPassword), generatedPassword ? 1 : 0, t, t);
  console.log(`✅ تم إنشاء حساب الأدمن: ${adminEmail}`);
  if (generatedPassword) {
    console.log(`🔑 كلمة مرور مؤقتة (لن تُطبع مرة أخرى): ${adminPassword}`);
    console.log("   سيُطلب تغييرها إلزامياً فور أول تسجيل دخول.");
  }
}
