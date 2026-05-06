// Trip data: SFO -> HND, 9 days, with side trip to Kansai via Shinkansen
window.TRIP = {
  title: "Tokyo, slowly.",
  origin: "SFO",
  passport: "United States",
  start: "2026-02-07",
  end: "2026-02-16",
  travelers: 2,
  budget: 6500,
  spent: 5200,
  // map coords are in the SVG's 1200x720 viewBox space
  places: {
    SFO: { name: "San Francisco", code: "SFO", x: 130, y: 280, kind: "airport" },
    HND: { name: "Tokyo Haneda", code: "HND", x: 940, y: 320, kind: "airport" },
    KIX: { name: "Osaka Kansai", code: "KIX", x: 800, y: 380, kind: "airport" },
    SHIB: { name: "Shibuya", x: 935, y: 332, kind: "city" },
    KYO: { name: "Kyoto", x: 822, y: 372, kind: "city" },
    NARA: { name: "Nara", x: 808, y: 388, kind: "city" },
    HAKO: { name: "Hakone", x: 905, y: 348, kind: "city" },
  },
  days: [
    {
      date: "2026-02-07", dow: "Sat", num: 7, where: "In transit · SFO → Tokyo",
      items: [
        { id: "checkpoint-1", kind: "checkpoint", title: "Pre-flight checklist", time: "—", sub: "Open flowchart · 13 items", linkPlace: null },
        { id: "f1", kind: "flight", title: "SFO → HND", time: "11:25", sub: "ANA NH107 · Boeing 787-9 · 11h 5m", badges: ["Window 24A", "Booked"], linkPlace: "SFO" },
        { id: "f1b", kind: "flight", title: "Land at Haneda", time: "15:30+1", sub: "Terminal 3 International · Customs ~30m", linkPlace: "HND" },
      ]
    },
    {
      date: "2026-02-08", dow: "Sun", num: 8, where: "Shibuya, Tokyo",
      items: [
        { id: "t1", kind: "transit", title: "Limousine bus to hotel", time: "16:40", sub: "Haneda T3 → Shibuya Excel · 55m", linkPlace: "SHIB" },
        { id: "h1", kind: "hotel", title: "Check in · Hotel Koé", time: "17:50", sub: "Shibuya · 4 nights", badges: ["Confirmed"], linkPlace: "SHIB" },
        { id: "a1", kind: "activity", title: "Dinner · Yakitori Toriki", time: "19:30", sub: "Walk · 12 min · ¥4,800/pp", linkPlace: "SHIB" },
      ]
    },
    {
      date: "2026-02-09", dow: "Mon", num: 9, where: "Tokyo · Harajuku & Shimokita",
      items: [
        { id: "a2", kind: "activity", title: "teamLab Borderless", time: "10:00", sub: "Azabudai Hills · pre-booked", badges: ["Tickets"], linkPlace: "SHIB" },
        { id: "a3", kind: "activity", title: "Shimokitazawa thrifting", time: "14:30", sub: "Self-guided", linkPlace: "SHIB" },
        { id: "a4", kind: "activity", title: "Bar Trench", time: "21:00", sub: "Reservation for 2", linkPlace: "SHIB" },
      ]
    },
    {
      date: "2026-02-10", dow: "Tue", num: 10, where: "Tokyo · Asakusa day",
      items: [
        { id: "a5", kind: "activity", title: "Senso-ji at sunrise", time: "06:30", sub: "Avoid crowds · 90 min", linkPlace: "SHIB" },
        { id: "a6", kind: "activity", title: "Tsukiji outer market", time: "09:30", sub: "Walk-in food crawl", linkPlace: "SHIB" },
      ]
    },
    {
      date: "2026-02-11", dow: "Wed", num: 11, where: "Tokyo → Hakone",
      items: [
        { id: "t2", kind: "transit", title: "Romancecar to Hakone-Yumoto", time: "08:42", sub: "Shinjuku → Hakone · 85m · seats 4A/4B", badges: ["JR Pass"], linkPlace: "HAKO" },
        { id: "a7", kind: "activity", title: "Hakone Open-Air Museum", time: "11:30", sub: "Picasso pavilion + foot bath", linkPlace: "HAKO" },
        { id: "h2", kind: "hotel", title: "Ryokan Hakone Ginyu", time: "16:00", sub: "1 night · onsen · kaiseki dinner", badges: ["Confirmed"], linkPlace: "HAKO" },
      ]
    },
    {
      date: "2026-02-12", dow: "Thu", num: 12, where: "Hakone → Kyoto",
      items: [
        { id: "checkpoint-2", kind: "checkpoint", title: "Domestic transit checklist", time: "—", sub: "Train · 4 items · 100% done", linkPlace: null },
        { id: "t3", kind: "transit", title: "Shinkansen Hikari 503", time: "10:18", sub: "Odawara → Kyoto · 2h 16m · car 7", badges: ["JR Pass"], linkPlace: "KYO" },
        { id: "h3", kind: "hotel", title: "Check in · Nōl Kyoto Sanjō", time: "13:30", sub: "Sanjō · 3 nights", badges: ["Confirmed"], linkPlace: "KYO" },
        { id: "a8", kind: "activity", title: "Pontochō stroll", time: "18:00", sub: "Riverside lanterns · self-guided", linkPlace: "KYO" },
      ]
    },
    {
      date: "2026-02-13", dow: "Fri", num: 13, where: "Kyoto · Higashiyama",
      items: [
        { id: "a9", kind: "activity", title: "Fushimi Inari pre-dawn", time: "05:30", sub: "Full torii loop · ~2h", linkPlace: "KYO" },
        { id: "a10", kind: "activity", title: "Tea at Ippodō", time: "13:00", sub: "Reserve flight · seasonal matcha", linkPlace: "KYO" },
      ]
    },
    {
      date: "2026-02-14", dow: "Sat", num: 14, where: "Day trip · Nara",
      items: [
        { id: "t4", kind: "transit", title: "Local train to Nara", time: "09:10", sub: "Kyoto → Nara · 45m · IC card", linkPlace: "NARA" },
        { id: "a11", kind: "activity", title: "Nara Park + Tōdai-ji", time: "10:00", sub: "Deer + Great Buddha · half day", linkPlace: "NARA" },
      ]
    },
    {
      date: "2026-02-15", dow: "Sun", num: 15, where: "Kyoto → Tokyo → SFO",
      items: [
        { id: "checkpoint-3", kind: "checkpoint", title: "Return-flight checklist", time: "—", sub: "USA re-entry · 6 items", linkPlace: null },
        { id: "t5", kind: "transit", title: "Shinkansen Nozomi 222", time: "07:33", sub: "Kyoto → Shinagawa · 2h 14m · car 9", badges: ["JR Pass"], linkPlace: "SHIB" },
        { id: "f2", kind: "flight", title: "HND → SFO", time: "16:55", sub: "ANA NH108 · Boeing 787-9 · 9h 30m", badges: ["Window 26K", "Booked"], linkPlace: "HND" },
      ]
    },
  ],

  // Hotel options
  hotels: [
    { id: "h-koe", name: "Hotel Koé Tokyo", area: "Shibuya · 7 min walk to crossing", price: 248, nights: 4, stars: 4.6, walk: 92, picked: true, color: "lavender", code: "SHIBUYA / 4N" },
    { id: "h-ginyu", name: "Ryokan Hakone Ginyu", area: "Hakone · onsen, mountain view", price: 480, nights: 1, stars: 4.9, walk: 78, picked: true, color: "default", code: "HAKONE / 1N" },
    { id: "h-nol", name: "Nōl Kyoto Sanjō", area: "Kyoto · 4 min to Sanjō stn", price: 196, nights: 3, stars: 4.7, walk: 95, picked: true, color: "ocean", code: "KYOTO / 3N" },
  ],

  // Top-level docs (right rail summary)
  docs: [
    { id: "d-passport", title: "US Passport · valid 6+ months past return", sub: "Expires Aug 2029 · ✓ valid", state: "done" },
    { id: "d-visa", title: "Japan: Visa-exempt for US passport", sub: "Up to 90 days · no action needed", state: "done", link: "mofa.go.jp" },
    { id: "d-visit", title: "Visit Japan Web · QR for arrival", sub: "Submit 6h before landing · not started", state: "warn", link: "vjw.digital.go.jp" },
    { id: "d-insurance", title: "Travel insurance", sub: "World Nomads Explorer · $89", state: "done" },
    { id: "d-driving", title: "International driving permit", sub: "Not driving — skipped", state: "skipped" },
    { id: "d-medication", title: "Medication import declaration", sub: "Required for ADHD meds · Yakkan Shoumei", state: "warn", link: "mhlw.go.jp" },
  ],

  // Flowchart definition — a real graph, with positions on a 2400x2000 canvas.
  // Edges link nodes; decision nodes have multiple outgoing edges (one per choice).
  // The "active path" is determined by the user's current selections + done state.
  flow: {
    startId: "start",
    endId: "end",
    nodes: [
      { id: "start", kind: "start", x: 1140, y: 60, w: 200,
        label: "Pre-flight", title: "Begin checklist · SFO → HND", next: "n-pass" },

      // Identity branch
      { id: "n-pass", kind: "info", x: 1130, y: 200,
        label: "Identity · auto",
        title: "US Passport · valid Aug 2029",
        desc: "Japan requires 6 months past return — you have 3+ years. ✓ passed.",
        meta: "Auto-checked from profile",
        done: true, next: "n-visa" },

      { id: "n-visa", kind: "decision", x: 1120, y: 360,
        label: "Decision · Entry",
        title: "Need a Japan visa?",
        desc: "US passport, 9-night stay → visa-exempt up to 90 days.",
        choices: [
          { id: "no", label: "No · exempt", on: true, to: "n-vjw" },
          { id: "yes", label: "Yes · apply", to: "n-visa-apply" },
        ],
        done: true },

      { id: "n-visa-apply", kind: "action", x: 1500, y: 520,
        label: "Action · 4-6 weeks",
        title: "Apply for tourist visa",
        desc: "Visit your Japanese embassy or consulate in person. Bring itinerary, financial proof, and 2 passport photos.",
        link: { label: "embassy-japan.go.jp", href: "#" },
        done: false },

      { id: "n-vjw", kind: "action", x: 1100, y: 520,
        label: "Action · Required",
        title: "Submit Visit Japan Web (T-6h)",
        desc: "Generates a QR for immigration + customs. Saves ~25 min on arrival.",
        link: { label: "vjw.digital.go.jp", href: "#" },
        meta: "Due Feb 7 · 05:25 PT",
        done: false,
        next: "n-meds" },

      // Health branch
      { id: "n-meds", kind: "decision", x: 1100, y: 720,
        label: "Decision · Health",
        title: "Bringing prescription meds?",
        desc: "Some controlled substances (incl. ADHD stimulants) require a Yakkan Shoumei import certificate.",
        choices: [
          { id: "yes-controlled", label: "Yes · controlled", on: true, to: "n-yakkan" },
          { id: "yes-common", label: "Yes · common", to: "n-meds-pack" },
          { id: "no", label: "No", to: "n-kids" },
        ],
        done: true },

      { id: "n-yakkan", kind: "action", x: 720, y: 880,
        label: "Action · 14-day lead",
        title: "File Yakkan Shoumei",
        desc: "Email PDF + prescription scan to the regional MHLW office. Print and carry the approval at customs.",
        link: { label: "MHLW import procedure", href: "#" },
        meta: "Submitted Jan 24 · Approved Feb 1",
        done: true,
        next: "n-kids" },

      { id: "n-meds-pack", kind: "action", x: 1100, y: 880,
        label: "Action · Pack carry-on",
        title: "Pack meds in carry-on, in original bottles",
        desc: "Keep prescriptions accessible. <30 day supply allowed without certificate.",
        done: false,
        next: "n-kids" },

      // Travelers branch
      { id: "n-kids", kind: "decision", x: 1100, y: 1060,
        label: "Decision · Travelers",
        title: "Traveling with children under 18?",
        choices: [
          { id: "no", label: "No", on: true, to: "n-drive" },
          { id: "yes", label: "Yes", to: "n-kid-docs" },
        ],
        done: true },

      { id: "n-kid-docs", kind: "action", x: 1500, y: 1180,
        label: "Action · Custody letter",
        title: "Notarized consent + child's passport",
        desc: "If only one parent travels, bring a notarized letter of consent from the non-traveling parent and the child's birth certificate.",
        link: { label: "travel.state.gov · minors", href: "#" },
        done: false,
        next: "n-drive" },

      // Mobility
      { id: "n-drive", kind: "decision", x: 1100, y: 1240,
        label: "Decision · Mobility",
        title: "Driving in Japan?",
        desc: "Japan only accepts the 1949 Geneva-convention IDP — not the 1968 version.",
        choices: [
          { id: "no", label: "No · trains only", on: true, to: "n-jrpass" },
          { id: "yes", label: "Yes", to: "n-idp" },
        ],
        done: true },

      { id: "n-idp", kind: "action", x: 1500, y: 1400,
        label: "Action · AAA · 2 weeks",
        title: "Get International Driving Permit",
        desc: "$20 from any AAA branch. Bring your US license + 2 passport photos.",
        link: { label: "aaa.com/idp", href: "#" },
        done: false,
        next: "n-jrpass" },

      { id: "n-jrpass", kind: "action", x: 1100, y: 1420,
        label: "Action · Time-sensitive",
        title: "Activate JR Pass at HND",
        desc: "Voucher must be exchanged within 90 days at the JR East Travel Service Center.",
        link: { label: "Reserve seats online", href: "#" },
        done: false,
        next: "n-cash" },

      { id: "n-cash", kind: "action", x: 1100, y: 1580,
        label: "Action · Recommended",
        title: "Order ¥40,000 cash",
        desc: "Many small restaurants and shrines are cash-only. Wise card for the rest.",
        done: false,
        next: "n-bag" },

      { id: "n-bag", kind: "info", x: 1100, y: 1720,
        label: "Packing",
        title: "Carry-on weight check",
        desc: "ANA economy: 10 kg total carry-on. Personal item under seat.",
        done: false,
        next: "end" },

      { id: "end", kind: "end", x: 1140, y: 1880, w: 220,
        label: "Done", title: "Ready to fly · 36h before HND" },
    ],
  },
};
