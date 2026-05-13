// Demo trip data for the Destify organizer dashboard.
// Coordinates are real (lat/lng) so the Leaflet map can geocode pins from data.
// Future: this will be persisted per-user in a database; the shape here is the
// in-memory representation that the React tree consumes.

export type PlaceKind = "airport" | "city" | "neighborhood" | "landmark";

export type Place = {
  id: string;
  name: string;
  code?: string;
  lat: number;
  lng: number;
  kind: PlaceKind;
};

export type ItemKind =
  | "flight"
  | "hotel"
  | "activity"
  | "transit"
  | "checkpoint";

export type ItineraryItem = {
  id: string;
  kind: ItemKind;
  title: string;
  time: string;
  sub?: string;
  badges?: string[];
  placeId?: string | null;
  /** When kind === "checkpoint", which flow does it open? */
  flowId?: string;
};

export type TripDay = {
  date: string; // ISO yyyy-mm-dd
  dow: string; // 3-char day-of-week
  num: number; // day-of-month
  where: string;
  items: ItineraryItem[];
};

export type Hotel = {
  id: string;
  name: string;
  area: string;
  price: number; // USD per night
  nights: number;
  stars: number;
  walkScore: number;
  picked: boolean;
  swatch: "lavender" | "sand" | "ocean";
  code: string;
};

export type DocState = "done" | "warn" | "skipped" | "pending";

export type DocItem = {
  id: string;
  title: string;
  sub: string;
  state: DocState;
  link?: { label: string; href: string };
};

export type FlowChoice = { id: string; label: string; on?: boolean; to: string };

export type FlowNode = {
  id: string;
  kind: "start" | "end" | "decision" | "action" | "info";
  x: number;
  y: number;
  w?: number;
  label: string;
  title: string;
  desc?: string;
  meta?: string;
  link?: { label: string; href: string };
  choices?: FlowChoice[];
  next?: string;
  done?: boolean;
};

export type FlowGraph = {
  id: string;
  title: string;
  subtitle: string;
  startId: string;
  endId: string;
  nodes: FlowNode[];
};

export type Trip = {
  id: string;
  title: string;
  origin: string;
  passport: string;
  start: string;
  end: string;
  travelers: number;
  budget: number;
  spent: number;
  routeSummary: string;
  fromFlag: string;
  toFlag: string;
  places: Record<string, Place>;
  days: TripDay[];
  hotels: Hotel[];
  docs: DocItem[];
  flows: Record<string, FlowGraph>;
};

// ─── Demo: Tokyo trip ─────────────────────────────────────────────────
const PLACES = {
  SFO: { id: "SFO", name: "San Francisco", code: "SFO", lat: 37.6213, lng: -122.379, kind: "airport" as const },
  HND: { id: "HND", name: "Tokyo Haneda", code: "HND", lat: 35.5494, lng: 139.7798, kind: "airport" as const },
  KIX: { id: "KIX", name: "Osaka Kansai", code: "KIX", lat: 34.4347, lng: 135.244, kind: "airport" as const },
  SHIB: { id: "SHIB", name: "Shibuya", lat: 35.658, lng: 139.7016, kind: "neighborhood" as const },
  KYO: { id: "KYO", name: "Kyoto", lat: 35.0116, lng: 135.7681, kind: "city" as const },
  NARA: { id: "NARA", name: "Nara", lat: 34.6851, lng: 135.8048, kind: "city" as const },
  HAKO: { id: "HAKO", name: "Hakone", lat: 35.2329, lng: 139.1067, kind: "city" as const },
} as const;

const tokyoTrip: Trip = {
  id: "tokyo-2026",
  title: "Tokyo, slowly.",
  origin: "SFO",
  passport: "United States",
  start: "2026-02-07",
  end: "2026-02-16",
  travelers: 2,
  budget: 6500,
  spent: 5200,
  routeSummary: "SFO ⇢ HND ⇢ KIX ⇢ HND ⇢ SFO · ANA + Shinkansen",
  fromFlag: "🇺🇸",
  toFlag: "🇯🇵",
  places: PLACES,
  days: [
    {
      date: "2026-02-07", dow: "Sat", num: 7, where: "In transit · SFO → Tokyo",
      items: [
        { id: "checkpoint-1", kind: "checkpoint", title: "Pre-flight checklist", time: "—", sub: "Open flowchart · 13 items", flowId: "preflight-jp" },
        { id: "f1", kind: "flight", title: "SFO → HND", time: "11:25", sub: "ANA NH107 · Boeing 787-9 · 11h 5m", badges: ["Window 24A", "Booked"], placeId: "SFO" },
        { id: "f1b", kind: "flight", title: "Land at Haneda", time: "15:30+1", sub: "Terminal 3 International · Customs ~30m", placeId: "HND" },
      ],
    },
    {
      date: "2026-02-08", dow: "Sun", num: 8, where: "Shibuya, Tokyo",
      items: [
        { id: "t1", kind: "transit", title: "Limousine bus to hotel", time: "16:40", sub: "Haneda T3 → Shibuya Excel · 55m", placeId: "SHIB" },
        { id: "h1", kind: "hotel", title: "Check in · Hotel Koé", time: "17:50", sub: "Shibuya · 4 nights", badges: ["Confirmed"], placeId: "SHIB" },
        { id: "a1", kind: "activity", title: "Dinner · Yakitori Toriki", time: "19:30", sub: "Walk · 12 min · ¥4,800/pp", placeId: "SHIB" },
      ],
    },
    {
      date: "2026-02-09", dow: "Mon", num: 9, where: "Tokyo · Harajuku & Shimokita",
      items: [
        { id: "a2", kind: "activity", title: "teamLab Borderless", time: "10:00", sub: "Azabudai Hills · pre-booked", badges: ["Tickets"], placeId: "SHIB" },
        { id: "a3", kind: "activity", title: "Shimokitazawa thrifting", time: "14:30", sub: "Self-guided", placeId: "SHIB" },
        { id: "a4", kind: "activity", title: "Bar Trench", time: "21:00", sub: "Reservation for 2", placeId: "SHIB" },
      ],
    },
    {
      date: "2026-02-10", dow: "Tue", num: 10, where: "Tokyo · Asakusa day",
      items: [
        { id: "a5", kind: "activity", title: "Senso-ji at sunrise", time: "06:30", sub: "Avoid crowds · 90 min", placeId: "SHIB" },
        { id: "a6", kind: "activity", title: "Tsukiji outer market", time: "09:30", sub: "Walk-in food crawl", placeId: "SHIB" },
      ],
    },
    {
      date: "2026-02-11", dow: "Wed", num: 11, where: "Tokyo → Hakone",
      items: [
        { id: "t2", kind: "transit", title: "Romancecar to Hakone-Yumoto", time: "08:42", sub: "Shinjuku → Hakone · 85m · seats 4A/4B", badges: ["JR Pass"], placeId: "HAKO" },
        { id: "a7", kind: "activity", title: "Hakone Open-Air Museum", time: "11:30", sub: "Picasso pavilion + foot bath", placeId: "HAKO" },
        { id: "h2", kind: "hotel", title: "Ryokan Hakone Ginyu", time: "16:00", sub: "1 night · onsen · kaiseki dinner", badges: ["Confirmed"], placeId: "HAKO" },
      ],
    },
    {
      date: "2026-02-12", dow: "Thu", num: 12, where: "Hakone → Kyoto",
      items: [
        { id: "checkpoint-2", kind: "checkpoint", title: "Domestic transit checklist", time: "—", sub: "Train · 4 items · 100% done", flowId: "domestic-jp" },
        { id: "t3", kind: "transit", title: "Shinkansen Hikari 503", time: "10:18", sub: "Odawara → Kyoto · 2h 16m · car 7", badges: ["JR Pass"], placeId: "KYO" },
        { id: "h3", kind: "hotel", title: "Check in · Nōl Kyoto Sanjō", time: "13:30", sub: "Sanjō · 3 nights", badges: ["Confirmed"], placeId: "KYO" },
        { id: "a8", kind: "activity", title: "Pontochō stroll", time: "18:00", sub: "Riverside lanterns · self-guided", placeId: "KYO" },
      ],
    },
    {
      date: "2026-02-13", dow: "Fri", num: 13, where: "Kyoto · Higashiyama",
      items: [
        { id: "a9", kind: "activity", title: "Fushimi Inari pre-dawn", time: "05:30", sub: "Full torii loop · ~2h", placeId: "KYO" },
        { id: "a10", kind: "activity", title: "Tea at Ippodō", time: "13:00", sub: "Reserve flight · seasonal matcha", placeId: "KYO" },
      ],
    },
    {
      date: "2026-02-14", dow: "Sat", num: 14, where: "Day trip · Nara",
      items: [
        { id: "t4", kind: "transit", title: "Local train to Nara", time: "09:10", sub: "Kyoto → Nara · 45m · IC card", placeId: "NARA" },
        { id: "a11", kind: "activity", title: "Nara Park + Tōdai-ji", time: "10:00", sub: "Deer + Great Buddha · half day", placeId: "NARA" },
      ],
    },
    {
      date: "2026-02-15", dow: "Sun", num: 15, where: "Kyoto → Tokyo → SFO",
      items: [
        { id: "checkpoint-3", kind: "checkpoint", title: "Return-flight checklist", time: "—", sub: "USA re-entry · 6 items", flowId: "return-jp" },
        { id: "t5", kind: "transit", title: "Shinkansen Nozomi 222", time: "07:33", sub: "Kyoto → Shinagawa · 2h 14m · car 9", badges: ["JR Pass"], placeId: "SHIB" },
        { id: "f2", kind: "flight", title: "HND → SFO", time: "16:55", sub: "ANA NH108 · Boeing 787-9 · 9h 30m", badges: ["Window 26K", "Booked"], placeId: "HND" },
      ],
    },
  ],

  hotels: [
    { id: "h-koe", name: "Hotel Koé Tokyo", area: "Shibuya · 7 min walk to crossing", price: 248, nights: 4, stars: 4.6, walkScore: 92, picked: true, swatch: "lavender", code: "SHIBUYA / 4N" },
    { id: "h-ginyu", name: "Ryokan Hakone Ginyu", area: "Hakone · onsen, mountain view", price: 480, nights: 1, stars: 4.9, walkScore: 78, picked: true, swatch: "sand", code: "HAKONE / 1N" },
    { id: "h-nol", name: "Nōl Kyoto Sanjō", area: "Kyoto · 4 min to Sanjō stn", price: 196, nights: 3, stars: 4.7, walkScore: 95, picked: true, swatch: "ocean", code: "KYOTO / 3N" },
  ],

  docs: [
    { id: "d-passport", title: "US Passport · valid 6+ months past return", sub: "Expires Aug 2029 · ✓ valid", state: "done" },
    { id: "d-visa", title: "Japan: Visa-exempt for US passport", sub: "Up to 90 days · no action needed", state: "done", link: { label: "mofa.go.jp", href: "https://www.mofa.go.jp/j_info/visit/visa/short/novisa.html" } },
    { id: "d-visit", title: "Visit Japan Web · QR for arrival", sub: "Submit 6h before landing · not started", state: "warn", link: { label: "vjw.digital.go.jp", href: "https://www.vjw.digital.go.jp/" } },
    { id: "d-insurance", title: "Travel insurance", sub: "World Nomads Explorer · $89", state: "done" },
    { id: "d-driving", title: "International driving permit", sub: "Not driving — skipped", state: "skipped" },
    { id: "d-medication", title: "Medication import declaration", sub: "Required for ADHD meds · Yakkan Shoumei", state: "warn", link: { label: "mhlw.go.jp", href: "https://www.mhlw.go.jp/english/policy/health-medical/pharmaceuticals/01.html" } },
  ],

  flows: {
    "preflight-jp": {
      id: "preflight-jp",
      title: "Before you fly to Japan",
      subtitle: "Pre-flight checklist · 36 hours before SFO → HND",
      startId: "start",
      endId: "end",
      nodes: [
        { id: "start", kind: "start", x: 1140, y: 60, w: 200, label: "Pre-flight", title: "Begin checklist · SFO → HND", next: "n-pass" },
        { id: "n-pass", kind: "info", x: 1130, y: 220, label: "Identity", title: "Identity · pending", desc: "Auto-checks once your profile loads.", meta: "", done: false, next: "n-visa" },
        { id: "n-visa", kind: "decision", x: 1120, y: 420, label: "Decision · Entry", title: "Need a Japan visa?", desc: "US passport, 9-night stay → visa-exempt up to 90 days.", choices: [
          { id: "no", label: "No · exempt", on: true, to: "n-vjw" },
          { id: "yes", label: "Yes · apply", to: "n-visa-apply" },
        ], done: true },
        { id: "n-visa-apply", kind: "action", x: 1500, y: 600, label: "Action · 4-6 weeks", title: "Apply for tourist visa", desc: "Visit your Japanese embassy or consulate in person. Bring itinerary, financial proof, and 2 passport photos.", link: { label: "embassy-japan.go.jp", href: "https://www.us.emb-japan.go.jp/itpr_en/visit.html" }, done: false },
        { id: "n-vjw", kind: "action", x: 1100, y: 600, label: "Action · Required", title: "Submit Visit Japan Web (T-6h)", desc: "Generates a QR for immigration + customs. Saves ~25 min on arrival.", link: { label: "vjw.digital.go.jp", href: "https://www.vjw.digital.go.jp/" }, meta: "Due Feb 7 · 05:25 PT", done: false, next: "n-meds" },
        { id: "n-meds", kind: "decision", x: 1100, y: 820, label: "Decision · Health", title: "Bringing prescription meds?", desc: "Some controlled substances (incl. ADHD stimulants) require a Yakkan Shoumei import certificate.", choices: [
          { id: "yes-controlled", label: "Yes · controlled", on: true, to: "n-yakkan" },
          { id: "yes-common", label: "Yes · common", to: "n-meds-pack" },
          { id: "no", label: "No", to: "n-kids" },
        ], done: true },
        { id: "n-yakkan", kind: "action", x: 720, y: 1000, label: "Action · 14-day lead", title: "File Yakkan Shoumei", desc: "Email PDF + prescription scan to the regional MHLW office. Print and carry the approval at customs.", link: { label: "MHLW import procedure", href: "https://www.mhlw.go.jp/english/policy/health-medical/pharmaceuticals/01.html" }, meta: "Submitted Jan 24 · Approved Feb 1", done: true, next: "n-kids" },
        { id: "n-meds-pack", kind: "action", x: 1100, y: 1000, label: "Action · Pack carry-on", title: "Pack meds in carry-on, in original bottles", desc: "Keep prescriptions accessible. Under 30-day supply allowed without certificate.", done: false, next: "n-kids" },
        { id: "n-kids", kind: "decision", x: 1100, y: 1200, label: "Decision · Travelers", title: "Traveling with children under 18?", choices: [
          { id: "no", label: "No", on: true, to: "n-drive" },
          { id: "yes", label: "Yes", to: "n-kid-docs" },
        ], done: true },
        { id: "n-kid-docs", kind: "action", x: 1500, y: 1340, label: "Action · Custody letter", title: "Notarized consent + child's passport", desc: "If only one parent travels, bring a notarized letter of consent from the non-traveling parent and the child's birth certificate.", link: { label: "travel.state.gov · minors", href: "https://travel.state.gov/content/travel/en/passports/need-passport/under-16.html" }, done: false, next: "n-drive" },
        { id: "n-drive", kind: "decision", x: 1100, y: 1400, label: "Decision · Mobility", title: "Driving in Japan?", desc: "Japan only accepts the 1949 Geneva-convention IDP — not the 1968 version.", choices: [
          { id: "no", label: "No · trains only", on: true, to: "n-jrpass" },
          { id: "yes", label: "Yes", to: "n-idp" },
        ], done: true },
        { id: "n-idp", kind: "action", x: 1500, y: 1580, label: "Action · AAA · 2 weeks", title: "Get International Driving Permit", desc: "$20 from any AAA branch. Bring your US license + 2 passport photos.", link: { label: "aaa.com/idp", href: "https://www.aaa.com/vacation/idpf.html" }, done: false, next: "n-jrpass" },
        { id: "n-jrpass", kind: "action", x: 1100, y: 1600, label: "Action · Time-sensitive", title: "Activate JR Pass at HND", desc: "Voucher must be exchanged within 90 days at the JR East Travel Service Center.", link: { label: "Reserve seats online", href: "https://www.japanrailpass.net/en/" }, done: false, next: "n-cash" },
        { id: "n-cash", kind: "action", x: 1100, y: 1780, label: "Action · Recommended", title: "Order ¥40,000 cash", desc: "Many small restaurants and shrines are cash-only. Wise card for the rest.", done: false, next: "n-bag" },
        { id: "n-bag", kind: "info", x: 1100, y: 1940, label: "Packing", title: "Carry-on weight check", desc: "ANA economy: 10 kg total carry-on. Personal item under seat.", done: false, next: "end" },
        { id: "end", kind: "end", x: 1140, y: 2120, w: 220, label: "Done", title: "Ready to fly · 36h before HND" },
      ],
    },
  },
};

export const TRIP = tokyoTrip;
