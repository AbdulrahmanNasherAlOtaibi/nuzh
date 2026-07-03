import { db, now, setSetting } from "./db.ts";
import { hashPassword } from "./auth.ts";

// مولد أرقام شبه عشوائي ثابت حتى تكون البيانات التجريبية مستقرة بين التشغيلات
let rngState = 42;
const rand = () => {
  rngState = (rngState * 1103515245 + 12345) % 2147483648;
  return rngState / 2147483648;
};
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

const iso = (d: Date) => d.toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5);
const daysAhead = (n: number) => new Date(Date.now() + n * 864e5);

function polygonAround(lat: number, lng: number, rKm: number, points = 7): number[][] {
  const poly: number[][] = [];
  for (let i = 0; i < points; i++) {
    const ang = (i / points) * Math.PI * 2;
    const r = rKm * (0.75 + rand() * 0.5);
    poly.push([
      +(lat + (r / 111) * Math.sin(ang)).toFixed(4),
      +(lng + (r / (111 * Math.cos((lat * Math.PI) / 180))) * Math.cos(ang)).toFixed(4),
    ]);
  }
  return poly;
}

export function seedIfEmpty() {
  const count = (db.prepare("SELECT COUNT(*) c FROM users").get() as { c: number }).c;
  if (count > 0) return;

  const t = now();

  // ---------- المستخدمون ----------
  const insUser = db.prepare(
    `INSERT INTO users (name,email,phone,password,role,gender,city,status,email_verified,created_at,last_active)
     VALUES (?,?,?,?,?,?,?,'active',1,?,?)`
  );
  const admin = insUser.run("إدارة نزهة", "admin@nuzha.sa", "0500000000", hashPassword("admin123"), "admin", "", "الرياض", iso(daysAgo(400)), t);
  const mzid = insUser.run("مزيد", "mzid@nuzha.sa", "0555555555", hashPassword("123456"), "user", "ذكر", "الرياض", iso(daysAgo(300)), t);

  const demoUsers = [
    ["نورة السبيعي", "noura@example.com", "أنثى", "الرياض"],
    ["أحمد الغامدي", "ahmed@example.com", "ذكر", "جدة"],
    ["سلطان العنزي", "sultan@example.com", "ذكر", "حفر الباطن"],
    ["ريم الشهري", "reem@example.com", "أنثى", "أبها"],
    ["فهد الدوسري", "fahad@example.com", "ذكر", "الدمام"],
    ["العنود المطيري", "anoud@example.com", "أنثى", "الرياض"],
    ["بدر الحربي", "badr@example.com", "ذكر", "المدينة"],
    ["لطيفة القحطاني", "latifa@example.com", "أنثى", "خميس مشيط"],
  ] as const;
  const userIds: number[] = [Number(mzid.lastInsertRowid)];
  for (const [i, [name, email, gender, city]] of demoUsers.entries()) {
    const r = insUser.run(name, email, `05${String(10000000 + i * 137913).slice(0, 8)}`, hashPassword("123456"), "user", gender, city, iso(daysAgo(30 + Math.floor(rand() * 300))), iso(daysAgo(Math.floor(rand() * 10))));
    userIds.push(Number(r.lastInsertRowid));
  }

  // ---------- مزودو الخدمة ----------
  const insProv = db.prepare("INSERT INTO providers (user_id,type,name,license,bio,status,created_at) VALUES (?,?,?,?,?,?,?)");
  const providers: number[] = [];
  const provData: [string, string, string, string][] = [
    ["company", "رحلات الصحراء الملكية", "TR-1021", "شركة متخصصة في رحلات مشاهدة الحياة الفطرية داخل المحميات الملكية."],
    ["company", "درب السروات", "TR-1187", "مغامرات جبلية ومسارات مشي في جبال السروات وعسير."],
    ["company", "سفاري الربع الخالي", "TR-1250", "رحلات سفاري فاخرة في أكبر صحراء رملية متصلة في العالم."],
    ["company", "واحة العلا للتجارب", "TR-1312", "جولات ثقافية وتاريخية في العلا ومدائن صالح."],
    ["guide", "محمد بن سعد بن ناصر العتيبي", "GD-2044", "مرشد سياحي معتمد — خبرة 12 سنة في المحميات الشمالية."],
    ["guide", "خالد بن عبدالله بن راشد القحطاني", "GD-2101", "مرشد بيئي متخصص في الطيور والحياة الفطرية."],
  ];
  for (const [i, [type, name, license, bio]] of provData.entries()) {
    const u = insUser.run(name, `provider${i + 1}@nuzha.sa`, `053${String(1000000 + i * 111111).slice(0, 7)}`, hashPassword("123456"), "provider", "", "الرياض", iso(daysAgo(200 + i * 20)), t);
    const p = insProv.run(Number(u.lastInsertRowid), type, name, license, bio, i === 5 ? "pending" : "active", iso(daysAgo(200 + i * 20)));
    providers.push(Number(p.lastInsertRowid));
  }

  // ---------- المحميات ----------
  const insReserve = db.prepare(
    "INSERT INTO reserves (name,description,area_km2,animals,center_lat,center_lng,zoom,zones,visitors,best_time) VALUES (?,?,?,?,?,?,?,?,?,?)"
  );
  const r1zones = [
    { name: "منطقة التنزه العائلية", type: "allowed", polygon: polygonAround(25.05, 46.0, 26, 8) },
    { name: "روضة التنزه الشرقية", type: "allowed", polygon: polygonAround(24.88, 46.35, 15, 7) },
    { name: "موائل المها العربي", type: "permit", polygon: polygonAround(25.3, 45.75, 14, 7) },
    { name: "منطقة الإكثار المحمية", type: "forbidden", polygon: polygonAround(25.45, 46.15, 9, 6) },
  ];
  const r2zones = [
    { name: "روضة خريم — التنزه", type: "allowed", polygon: polygonAround(25.38, 47.28, 22, 8) },
    { name: "مسارات المشي البيئية", type: "allowed", polygon: polygonAround(25.1, 47.05, 12, 7) },
    { name: "منطقة التخييم المنظم", type: "permit", polygon: polygonAround(25.6, 47.5, 13, 7) },
    { name: "محمية الطيور الحوامة", type: "forbidden", polygon: polygonAround(25.52, 47.12, 8, 6) },
  ];
  const reserve1 = insReserve.run(
    "محمية الإمام سعود بن عبدالعزيز الملكية",
    "من أكبر المحميات الملكية في المملكة، تتميز بتنوعها البيولوجي الفريد وتضم موائل طبيعية للمها العربي والغزلان والحبارى، مع مواقع مخصصة للتنزه البيئي المنظم.",
    10800, JSON.stringify([{ name: "المها العربي", icon: "🦌" }, { name: "غزال", icon: "🦌" }, { name: "الحبارى", icon: "🦅" }]),
    25.15, 46.05, 8, JSON.stringify(r1zones), 1245, "أكتوبر — مارس"
  );
  const reserve2 = insReserve.run(
    "محمية الإمام عبدالعزيز بن محمد الملكية",
    "تضم روضة خريم الشهيرة وتحتضن برامج إعادة توطين الكائنات الفطرية، وتُعد وجهة مفضلة لعشاق التخييم البيئي ومراقبة الطيور.",
    11300, JSON.stringify([{ name: "المها العربي", icon: "🦌" }, { name: "النعام", icon: "🦤" }, { name: "الصقور", icon: "🦅" }]),
    25.35, 47.25, 8, JSON.stringify(r2zones), 980, "نوفمبر — فبراير"
  );
  const res1 = Number(reserve1.lastInsertRowid);
  const res2 = Number(reserve2.lastInsertRowid);

  // ---------- الرحلات ----------
  const futureDates = () => JSON.stringify([3, 5, 8, 12, 17, 24].map((d) => iso(daysAhead(d)).slice(0, 10)));
  const insTrip = db.prepare(
    `INSERT INTO trips (provider_id,reserve_id,title,description,category,location,price,child_price,duration_hours,distance_km,capacity,image,dates,status,weekend_offer,featured,sort,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'active',?,?,?,?)`
  );
  type TripSeed = [number, number | null, string, string, string, string, number, number, number, number, string, number, number];
  const tripSeeds: TripSeed[] = [
    [providers[0], res1, "رحلة مشاهدة المها العربي", "انطلق في رحلة لا تُنسى لمشاهدة قطعان المها العربي في موطنها الطبيعي مع مرشدين متخصصين وتجربة ضيافة بدوية أصيلة.", "eco", "محمية الإمام سعود بن عبدالعزيز", 150, 75, 4, 120, "/scenes/dunes-sunset.svg", 0, 1],
    [providers[1], null, "مغامرة جبال السروات", "تسلق وهايكنج في أجمل قمم السروات مع إطلالات ساحرة على الضباب والقرى المعلقة.", "adventure", "جبال السروات — عسير", 350, 200, 8, 420, "/scenes/sarawat.svg", 0, 1],
    [providers[3], null, "جولة العلا التاريخية", "جولة فاخرة بين مدائن صالح وجبل الفيل والبلدة القديمة مع مرشد آثار متخصص وعشاء تراثي.", "culture", "العلا", 850, 400, 10, 780, "/scenes/alula.svg", 0, 1],
    [providers[2], null, "سفاري الربع الخالي", "تجربة سفاري استثنائية بين كثبان الربع الخالي الذهبية مع مبيت في مخيم فاخر.", "adventure", "الربع الخالي", 1200, 600, 24, 650, "/scenes/dunes-day.svg", 0, 1],
    [providers[0], res2, "استكشاف وادي الديسة", "مسار بيئي بين النخيل والجداول في أجمل أودية المملكة.", "eco", "وادي الديسة — تبوك", 420, 210, 6, 890, "/scenes/oasis.svg", 0, 0],
    [providers[2], null, "جولة الغروب الصحراوية", "قهوة سعودية وتمر مع أجمل غروب تشاهده في حياتك من قلب الرمال.", "fun", "صحراء الدهناء", 200, 100, 5, 90, "/scenes/dunes-sunset.svg", 1, 0],
    [providers[0], res1, "رحلة تصوير الحياة البرية", "ورشة تصوير احترافية للحياة الفطرية برفقة مصورين متخصصين — عدسات تلفوتو متوفرة.", "eco", "محمية الإمام سعود بن عبدالعزيز", 300, 150, 6, 130, "/scenes/wildlife.svg", 0, 0],
    [providers[2], res2, "ليلة تخييم تحت النجوم", "مخيم بيئي متكامل: تلسكوبات، جلسات نار، وعشاء بري — تجربة نهاية أسبوع مثالية.", "fun", "روضة خريم", 450, 220, 16, 110, "/scenes/night-camp.svg", 1, 0],
    [providers[0], res2, "رحلة عائلية إلى روضة خريم", "يوم عائلي كامل بين خضرة الروضة: ألعاب للأطفال، مسار دراجات، وغداء بري.", "fun", "روضة خريم", 180, 90, 7, 105, "/scenes/oasis.svg", 1, 0],
    [providers[4], res1, "مسار المشي البيئي مع مرشد", "مسار مشي تفسيري 8 كم يتعرّف فيه الضيوف على النباتات المحلية وآثار الحيوانات.", "guided", "محمية الإمام سعود بن عبدالعزيز", 120, 60, 3, 95, "/scenes/sarawat.svg", 0, 0],
    [providers[3], null, "جولة تراثية في الدرعية", "عبق التاريخ في طرقات الطريف — جولة مسائية مع عشاء نجدي.", "culture", "الدرعية — الرياض", 260, 130, 4, 25, "/scenes/alula.svg", 0, 0],
    [providers[5], res2, "أسرار المحمية مع مرشد بيئي", "جولة خاصة مع مرشد متخصص في الطيور: مراقبة الصقور والطيور المهاجرة.", "guided", "محمية الإمام عبدالعزيز بن محمد", 220, 110, 4, 100, "/scenes/wildlife.svg", 0, 0],
    [providers[1], null, "سباق الدراجات الرملية", "أدرينالين خالص: انحدارات رملية ودراجات جبلية مخصصة — لعشاق المغامرة.", "adventure", "نفود الثويرات", 380, 0, 5, 150, "/scenes/dunes-day.svg", 1, 0],
    [providers[4], res1, "ورشة السلوك البيئي للمخيمين", "تعلم أساسيات التخييم منخفض الأثر: لا تترك أثراً إلا خطاك.", "eco", "محمية الإمام سعود بن عبدالعزيز", 90, 45, 3, 95, "/scenes/night-camp.svg", 0, 0],
  ];
  const tripIds: number[] = [];
  for (const [i, s] of tripSeeds.entries()) {
    const r = insTrip.run(s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7], s[8], s[9], 24, s[10], futureDates(), s[11], s[12], i, iso(daysAgo(150 - i * 3)));
    tripIds.push(Number(r.lastInsertRowid));
  }

  // ---------- الحجوزات والمعاملات عبر 12 شهراً ----------
  const insBooking = db.prepare(
    `INSERT INTO bookings (trip_id,user_id,date,adults,children,notes,total,fee,payment_method,status,photos,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  );
  const insTx = db.prepare(
    "INSERT INTO transactions (booking_id,provider_id,amount,fee,method,status,created_at) VALUES (?,?,?,?,?,?,?)"
  );
  const insReview = db.prepare(
    "INSERT INTO reviews (booking_id,trip_id,user_id,rating,text,status,created_at) VALUES (?,?,?,?,?,'published',?)"
  );
  const reviewTexts = [
    "تجربة أسطورية! التنظيم راقي والمرشد ملم بكل التفاصيل.",
    "رحلة تفوق الوصف، شاهدنا المها العربي عن قرب. تستاهل كل ريال.",
    "الضيافة والاهتمام بالتفاصيل شيء ثاني. بالتأكيد سأكرر التجربة.",
    "مكان ساحر وتنظيم ممتاز، لكن أتمنى زيادة وقت التصوير.",
    "من أفضل الرحلات اللي جربتها بحياتي، الأطفال ما ودهم يرجعون.",
    "المرشد قمة في الاحتراف والمعلومات قيمة جداً.",
    "أجواء ولا أروع وقهوة سعودية على الغروب.. ما يعوض!",
    "تنظيم جيد بشكل عام، التأخير البسيط في الانطلاق هو الملاحظة الوحيدة.",
  ];
  const methods = ["mada", "visa", "applepay"];
  const feePercent = 10;

  const providerOfTrip = new Map<number, number>();
  tripSeeds.forEach((s, i) => providerOfTrip.set(tripIds[i], s[0]));
  const priceOfTrip = new Map<number, number>();
  tripSeeds.forEach((s, i) => priceOfTrip.set(tripIds[i], s[6]));

  for (let month = 11; month >= 0; month--) {
    const bookingsThisMonth = 6 + Math.floor(rand() * 10) + (11 - month);
    for (let b = 0; b < bookingsThisMonth; b++) {
      const tripId = pick(tripIds);
      const userId = pick(userIds);
      const adults = 1 + Math.floor(rand() * 3);
      const children = Math.floor(rand() * 3);
      const price = priceOfTrip.get(tripId)!;
      const total = adults * price + children * Math.round(price / 2);
      const fee = Math.round((total * feePercent) / 100);
      const created = daysAgo(month * 30 + Math.floor(rand() * 28));
      const isPast = month > 0 || rand() > 0.4;
      const roll = rand();
      const status = isPast ? (roll > 0.15 ? "completed" : roll > 0.05 ? "cancelled" : "refunded") : (roll > 0.3 ? "confirmed" : "pending");
      const date = isPast ? iso(new Date(created.getTime() + 5 * 864e5)).slice(0, 10) : iso(daysAhead(2 + Math.floor(rand() * 20))).slice(0, 10);
      const method = pick(methods);
      const bk = insBooking.run(tripId, userId, date, adults, children, "", total, fee, method, status, "[]", iso(created));
      if (status !== "pending") {
        insTx.run(Number(bk.lastInsertRowid), providerOfTrip.get(tripId)!, total, fee, method,
          status === "cancelled" || status === "refunded" ? "refunded" : "paid", iso(created));
      }
      if (status === "completed" && rand() > 0.45) {
        const rating = rand() > 0.25 ? (rand() > 0.5 ? 5 : 4) : rand() > 0.5 ? 3 : 2;
        insReview.run(Number(bk.lastInsertRowid), tripId, userId, rating, pick(reviewTexts), iso(new Date(created.getTime() + 7 * 864e5)));
      }
    }
  }

  // حجوزات "مزيد" — سابقة وقادمة حتى تظهر شاشة رحلاتي كاملة
  const mzidId = Number(mzid.lastInsertRowid);
  const mzidPast: [number, number, number][] = [[tripIds[0], 60, 5], [tripIds[5], 34, 4], [tripIds[7], 15, 5]];
  for (const [tripId, ago, rating] of mzidPast) {
    const price = priceOfTrip.get(tripId)!;
    const bk = insBooking.run(tripId, mzidId, iso(daysAgo(ago)).slice(0, 10), 2, 1, "", price * 2 + price / 2, Math.round(price * 0.25), "mada", "completed", "[]", iso(daysAgo(ago + 6)));
    insTx.run(Number(bk.lastInsertRowid), providerOfTrip.get(tripId)!, price * 2.5, Math.round(price * 0.25), "mada", "paid", iso(daysAgo(ago + 6)));
    if (rating) insReview.run(Number(bk.lastInsertRowid), tripId, mzidId, rating, pick(reviewTexts), iso(daysAgo(ago - 1)));
  }
  for (const [tripId, ahead] of [[tripIds[2], 6], [tripIds[8], 12]] as [number, number][]) {
    const price = priceOfTrip.get(tripId)!;
    const bk = insBooking.run(tripId, mzidId, iso(daysAhead(ahead)).slice(0, 10), 2, 0, "", price * 2, Math.round(price * 0.2), "applepay", "confirmed", "[]", iso(daysAgo(2)));
    insTx.run(Number(bk.lastInsertRowid), providerOfTrip.get(tripId)!, price * 2, Math.round(price * 0.2), "applepay", "paid", iso(daysAgo(2)));
  }

  // ---------- الشكاوى ----------
  const insComplaint = db.prepare(
    "INSERT INTO complaints (user_id,provider_id,type,description,priority,status,reply,created_at) VALUES (?,?,?,?,?,?,?,?)"
  );
  insComplaint.run(userIds[2], providers[2], "تأخير في الانطلاق", "تأخرت الرحلة ساعتين عن الموعد المحدد دون إشعار مسبق.", "high", "processing", "", iso(daysAgo(3)));
  insComplaint.run(userIds[4], providers[1], "اختلاف الخدمة عن الوصف", "الوصف يذكر وجبة غداء ولم تُقدم خلال الرحلة.", "medium", "new", "", iso(daysAgo(1)));
  insComplaint.run(userIds[1], null, "مشكلة في الدفع", "خُصم المبلغ مرتين عند الحجز ببطاقة مدى.", "high", "closed", "تم التحقق واسترجاع المبلغ المكرر خلال 3 أيام عمل. نعتذر عن الإزعاج.", iso(daysAgo(12)));
  insComplaint.run(userIds[6], providers[0], "نظافة موقع التخييم", "الموقع يحتاج عناية أكبر بالنظافة عند نقطة التجمع.", "low", "new", "", iso(daysAgo(2)));

  // ---------- الإعلانات (الكاروسيل) ----------
  const insAd = db.prepare("INSERT INTO ads (title,subtitle,image,link,sort,active) VALUES (?,?,?,?,?,1)");
  insAd.run("اكتشف جمال محمياتنا", "رحلات بيئية فريدة في قلب الطبيعة", "/scenes/dunes-sunset.svg", "/explore", 0);
  insAd.run("عروض نهاية الأسبوع", "خصم حتى 20% على رحلات مختارة — كود WEEKEND20", "/scenes/night-camp.svg", "/explore?filter=weekend", 1);
  insAd.run("موسم مشاهدة المها العربي", "أفضل وقت لمشاهدة قطعان المها في المحميات الملكية", "/scenes/wildlife.svg", "/trips/1", 2);
  insAd.run("انضم كمزود خدمة", "شركة سياحية أو مرشد؟ سجل وابدأ باستقبال الحجوزات", "/scenes/sarawat.svg", "/provider", 3);

  // ---------- محتوى التوعية البيئية ----------
  const insContent = db.prepare("INSERT INTO contents (kind,title,body,image,author,created_at) VALUES (?,?,?,?,?,?)");
  insContent.run("article", "المها العربي.. حكاية عودة من حافة الانقراض", "انقرض المها العربي من البرية عام 1972، لكن برامج الإكثار في المملكة أعادته اليوم ليجوب محمياته الطبيعية بأعداد تتجاوز الآلاف. تعرف على قصة النجاح السعودية في إعادة التوطين، ودور المحميات الملكية في حماية هذا الرمز الوطني.", "/scenes/wildlife.svg", "د. عبدالله الحربي", iso(daysAgo(8)));
  insContent.run("article", "لماذا تُعد المحميات الملكية رئة المملكة البيئية؟", "تغطي المحميات الملكية أكثر من 13% من مساحة المملكة، وتلعب دوراً محورياً في استعادة الغطاء النباتي، وتثبيت الكثبان الرملية، وإعادة الكائنات الفطرية إلى موائلها. في هذا المقال نستعرض أثرها على جودة الحياة والسياحة البيئية.", "/scenes/oasis.svg", "فريق نزهة", iso(daysAgo(15)));
  insContent.run("article", "دليلك لمراقبة الطيور المهاجرة في الشتاء", "تمر بسماء المملكة ملايين الطيور المهاجرة سنوياً. تعرف على أفضل المواقع والأوقات وآداب المراقبة التي تحفظ للطيور هدوءها.", "/scenes/sarawat.svg", "خالد القحطاني", iso(daysAgo(22)));
  insContent.run("snapshot", "قطيع مها يعبر الكثبان عند الغروب", "لقطة استثنائية وثقها أحد ضيوف رحلة التصوير الأسبوع الماضي في محمية الإمام سعود بن عبدالعزيز الملكية.", "/scenes/dunes-sunset.svg", "عدسة: فهد الدوسري", iso(daysAgo(4)));
  insContent.run("snapshot", "غزال الريم في روضة خريم", "صغير غزال ريم يظهر لأول مرة أمام زوار المحمية — من توثيق فريق الرصد البيئي.", "/scenes/wildlife.svg", "فريق الرصد", iso(daysAgo(9)));
  insContent.run("snapshot", "درب الضباب في السروات", "مسار المشي الجبلي صباحاً حين يعانق الضباب قمم السروات.", "/scenes/sarawat.svg", "عدسة: ريم الشهري", iso(daysAgo(13)));
  insContent.run("report", "تقرير محمية الإمام سعود بن عبدالعزيز — الربع الأخير", "ارتفاع أعداد المها العربي 12% وتسجيل 3 أعشاش جديدة للحبارى. زوار هذا الربع: 1,245 زائراً بنسبة التزام بيئي 96%.", "/scenes/dunes-day.svg", "إدارة المحمية", iso(daysAgo(20)));
  insContent.run("report", "تقرير محمية الإمام عبدالعزيز بن محمد — الربع الأخير", "اكتمال برنامج تثبيت الكثبان في القطاع الشرقي وإطلاق 40 طائر حبارى. زوار هذا الربع: 980 زائراً.", "/scenes/oasis.svg", "إدارة المحمية", iso(daysAgo(18)));
  insContent.run("behavior", "لا تترك أثراً إلا خطاك", "خذ كل مخلفاتك معك عند مغادرة موقع التنزه، وافرز ما يمكن تدويره. الطبيعة أمانة.", "/scenes/night-camp.svg", "فريق نزهة", iso(daysAgo(30)));
  insContent.run("behavior", "حافظ على مسافة آمنة من الحياة الفطرية", "لا تقترب من الحيوانات ولا تطعمها؛ فالاقتراب يسبب لها التوتر ويغير سلوكها الطبيعي. استخدم العدسات المقربة.", "/scenes/wildlife.svg", "فريق نزهة", iso(daysAgo(30)));
  insContent.run("behavior", "التزم بالمسارات المحددة", "الخروج عن المسارات يدمر الغطاء النباتي الهش ويزعج مواطن الكائنات. المسارات صُممت لحمايتك وحمايتها.", "/scenes/sarawat.svg", "فريق نزهة", iso(daysAgo(30)));
  insContent.run("behavior", "أشعل النار في الأماكن المخصصة فقط", "استخدم مواقد التخييم المخصصة وتأكد من إطفاء الجمر تماماً قبل المغادرة.", "/scenes/night-camp.svg", "فريق نزهة", iso(daysAgo(30)));
  insContent.run("behavior", "خفض الصوت.. من آداب البرية", "الضجيج يزعج الكائنات ويفسد تجربة الآخرين. استمتع بأصوات الطبيعة نفسها.", "/scenes/oasis.svg", "فريق نزهة", iso(daysAgo(30)));

  // ---------- التصاريح ----------
  const insPermit = db.prepare("INSERT INTO permits (user_id,reserve_id,permit_no,from_date,to_date,status,created_at) VALUES (?,?,?,?,?,?,?)");
  insPermit.run(mzidId, res1, "13456", iso(daysAgo(5)).slice(0, 10), iso(daysAhead(25)).slice(0, 10), "active", iso(daysAgo(7)));
  insPermit.run(mzidId, res2, "97904", iso(daysAhead(10)).slice(0, 10), iso(daysAhead(40)).slice(0, 10), "review", iso(daysAgo(1)));

  // ---------- الترويجات ----------
  const insPromo = db.prepare("INSERT INTO promotions (name,code,kind,value,starts,ends,max_uses,used,active) VALUES (?,?,?,?,?,?,?,?,1)");
  insPromo.run("خصم نهاية الأسبوع", "WEEKEND20", "percent", 20, iso(daysAgo(10)).slice(0, 10), iso(daysAhead(50)).slice(0, 10), 500, 137, );
  insPromo.run("أهلاً بك في نزهة", "NUZHA50", "fixed", 50, iso(daysAgo(30)).slice(0, 10), iso(daysAhead(90)).slice(0, 10), 1000, 342);
  insPromo.run("العائلة أولاً", "FAMILY10", "percent", 10, iso(daysAgo(5)).slice(0, 10), iso(daysAhead(30)).slice(0, 10), 300, 58);

  // ---------- الإنجازات ----------
  const insAch = db.prepare("INSERT INTO achievements (code,title,description,icon,metric,target) VALUES (?,?,?,?,?,?)");
  const achievements: [string, string, string, string, string, number][] = [
    ["first_trip", "الخطوة الأولى", "أكمل رحلتك الأولى مع نزهة", "🥾", "trips", 1],
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

  // ---------- الموظفون ----------
  const insStaff = db.prepare("INSERT INTO staff (name,email,role,active,created_at) VALUES (?,?,?,1,?)");
  insStaff.run("عبدالرحمن العتيبي", "abdulrahman@nuzha.sa", "مدير المنصة", iso(daysAgo(400)));
  insStaff.run("سارة المالكي", "sara@nuzha.sa", "مشرفة الشكاوى", iso(daysAgo(200)));
  insStaff.run("ناصر الشمري", "nasser@nuzha.sa", "محاسب", iso(daysAgo(150)));

  // ---------- الإعدادات ----------
  setSetting("general", {
    name: "نُزهة",
    nameEn: "Nuzha",
    tagline: "السياحة البيئية في المحميات",
    email: "support@nuzha.sa",
    phone: "920012345",
    address: "الرياض — حي الملقا، طريق الملك فهد",
  });
  setSetting("payment", {
    feePercent: 10,
    methods: { mada: true, visa: true, applepay: true },
    banks: [{ bank: "الراجحي", iban: "SA03 8000 0000 6080 1016 7519", name: "شركة نزهة للسياحة البيئية" }],
  });
  setSetting("security", { twoFactor: false, sessionDays: 30 });
  setSetting("platformAchievements", [
    { icon: "🎖️", title: "تكريم من قِبل معالي وزير الداخلية", body: "كُرّمت منصة نزهة من قِبل معالي وزير الداخلية ضمن مبادرات تعزيز السياحة الآمنة." },
    { icon: "🏆", title: "ضمن أفضل 15 فكرة في هاكاثون أبشر طويق", body: "برعاية صاحب السمو الملكي وزير الداخلية، اختيرت نزهة ضمن أفضل 15 فكرة على مستوى المملكة." },
    { icon: "🥇", title: "تكريم صاحب السمو محافظ حفر الباطن", body: "تكريم خاص لفريق نزهة على أثر المشروع في السياحة البيئية المحلية." },
    { icon: "🤝", title: "دعم واحتضان الكراج", body: "حصلت نزهة على دعم واحتضان من الكراج، أكبر حاضنة تقنية في المملكة." },
  ]);
  setSetting("about", "نُزهة منصة سعودية تربط عشاق الطبيعة بالمحميات الملكية عبر رحلات بيئية منظمة ومرخصة، بالشراكة مع شركات سياحية ومرشدين معتمدين. رسالتنا: سياحة بيئية مستدامة تحفظ للبراري جمالها وللأجيال حقها.");
  setSetting("faq", [
    { q: "كيف أحجز رحلة؟", a: "اختر الرحلة المناسبة من الصفحة الرئيسية أو صفحة استكشف، حدد التاريخ وعدد الأشخاص، ثم أكمل الدفع الإلكتروني بأمان." },
    { q: "هل أحتاج تصريحاً لدخول المحمية؟", a: "بعض مناطق المحميات تتطلب تصريحاً مسبقاً — تظهر لك المناطق على الخريطة ملونة حسب التصنيف، ويمكنك طلب التصريح من قسم رحلاتي > التصاريح." },
    { q: "هل يمكنني إلغاء حجزي؟", a: "نعم، يمكنك الإلغاء قبل 48 ساعة من موعد الرحلة واسترداد كامل المبلغ." },
    { q: "كيف أقيّم رحلة؟", a: "التقييم متاح فقط للرحلات التي حجزتها وأكملتها فعلياً — من رحلاتي > السابقة، وهذا يضمن مصداقية التقييمات." },
    { q: "كيف أنضم كمزود خدمة؟", a: "من بوابة مزودي الخدمة سجل كشركة سياحية أو مرشد سياحي، وبعد مراجعة الطلب تستطيع نشر رحلاتك واستقبال الحجوزات." },
  ]);
  setSetting("userGuide", [
    { icon: "🧭", title: "استكشف", body: "تصفح الرحلات حسب التصنيف: بيئية، ثقافية، ترفيهية، مغامرات، أو مع مرشد سياحي." },
    { icon: "🗺️", title: "الخريطة", body: "تعرف على مناطق التنزه: الأخضر مسموح، الأصفر يتطلب تصريحاً، الأحمر ممنوع." },
    { icon: "🎫", title: "احجز", body: "حدد التاريخ والأشخاص وادفع إلكترونياً — تصلك التفاصيل فوراً." },
    { icon: "⭐", title: "قيّم", body: "بعد اكتمال رحلتك شارك تجربتك وصورك وحصّل الإنجازات." },
  ]);

  db.prepare("INSERT INTO activity_log (actor, action, created_at) VALUES (?,?,?)").run("النظام", "تم تجهيز البيانات التجريبية للمنصة", t);
  console.log("✅ تم تجهيز البيانات التجريبية");
}
