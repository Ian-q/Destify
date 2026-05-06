(() => {
  const T = window.TRIP;
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const el = (tag, attrs={}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k,v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    for (const k of kids.flat()) {
      if (k == null || k === false) continue;
      e.append(k.nodeType ? k : document.createTextNode(k));
    }
    return e;
  };

  // ICONS
  const I = {
    flight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.33 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" style="display:none"/><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" fill="currentColor" stroke="none"/></svg>',
    hotel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-6h6v6"/><circle cx="12" cy="11" r="1.2" fill="currentColor"/></svg>',
    activity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 14.5 8.5 21 9.5l-5 4.5 1.5 7L12 17l-5.5 4 1.5-7-5-4.5 6.5-1z"/></svg>',
    transit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="14" rx="2"/><path d="M5 11h14M9 17l-2 4M15 17l2 4"/><circle cx="9" cy="7" r=".8" fill="currentColor"/><circle cx="15" cy="7" r=".8" fill="currentColor"/></svg>',
    checkpoint: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>',
  };

  // STATE
  const state = {
    selectedDay: 1, // index in T.days
    activeId: null,
    mapView: 'all',
    docs: Object.fromEntries(T.docs.map(d => [d.id, d.state])),
    flow: Object.fromEntries(T.flow.nodes.map(n => [n.id, !!n.done])),
    flowChoices: Object.fromEntries(T.flow.nodes.filter(n => n.choices).map(n => {
      const on = n.choices.find(c => c.on);
      return [n.id, on ? on.id : n.choices[0].id];
    })),
    flowView: { x: 0, y: 0, scale: 0.62 },
  };

  // ——— DAY PICKER ———
  const dayPickerEl = $('#day-picker');
  function renderDayPicker() {
    dayPickerEl.innerHTML = '';
    T.days.forEach((d, i) => {
      const dots = el('div', { class: 'dots' });
      d.items.forEach(it => {
        const cls = it.kind === 'flight' ? 'f' : it.kind === 'hotel' ? 'h' : it.kind === 'activity' ? 'a' : '';
        if (cls) dots.append(el('span', { class: cls }));
      });
      const btn = el('button', { class: 'day' + (i === state.selectedDay ? ' on' : ''),
        onclick: () => { state.selectedDay = i; renderDayPicker(); renderTimeline(); renderMap(); }
      },
        el('div', { class: 'dow' }, d.dow),
        el('div', { class: 'num' }, String(d.num)),
        dots,
      );
      dayPickerEl.append(btn);
    });
  }

  // ——— TIMELINE ———
  const tlEl = $('#timeline');
  function renderTimeline() {
    tlEl.innerHTML = '';
    T.days.forEach((d, di) => {
      const head = el('div', { class: 'timeline-day-head' },
        el('div', {},
          el('div', { class: 'day-label' }, `${d.dow.toUpperCase()} · ${monthDay(d.date)}`),
          el('div', { class: 'day-where' }, d.where),
        ),
        el('div', { class: 'pill', style: 'font-size:11px;' }, d.items.length + ' stops')
      );
      tlEl.append(head);

      d.items.forEach(it => {
        const isActive = state.activeId === it.id;
        const card = it.kind === 'checkpoint'
          ? renderCheckpointCard(it)
          : renderItemCard(it, isActive);

        const item = el('div', { class: 'tl-item' },
          el('div', { class: 'tl-line' }),
          el('div', { class: `tl-icon ${it.kind}`, html: I[it.kind] || I.activity }),
          card,
        );
        tlEl.append(item);
      });
    });
  }

  function renderItemCard(it, isActive) {
    const badges = (it.badges || []).map(b => {
      const cls = b.toLowerCase().includes('book') || b.toLowerCase().includes('confirm') ? 'ok'
                 : b.toLowerCase().includes('pass') ? 'ok' : '';
      return el('span', { class: 'badge ' + cls }, b);
    });
    const card = el('div', { class: 'tl-card' + (isActive ? ' active' : ''),
      onclick: () => { state.activeId = it.id; renderTimeline(); flashOnMap(it.linkPlace); updateSelectedOverlay(it); },
      onmouseenter: () => highlightMap(it.linkPlace),
      onmouseleave: () => unhighlightMap(),
    },
      el('div', { class: 'tl-card-head' },
        el('div', { class: 'tl-card-title' }, it.title),
        el('div', { class: 'tl-card-time' }, it.time),
      ),
      el('div', { class: 'tl-card-sub' },
        it.sub,
        ...(badges.length ? [el('span', { style: 'flex-grow:1' }), ...badges] : []),
      ),
    );
    return card;
  }

  function renderCheckpointCard(it) {
    const active = activeFlowNodes();
    const total = active.length;
    const done = active.filter(n => state.flow[n.id]).length;
    const pct = total ? Math.round(done * 100 / total) : 0;
    return el('div', { class: 'tl-card checkpoint-card', onclick: openFlow },
      el('div', { class: 'tl-card-head' },
        el('div', { class: 'tl-card-title' }, it.title),
        el('div', { class: 'tl-card-time' }, `${done}/${total}`),
      ),
      el('div', { class: 'tl-card-sub' }, it.sub, el('span', { style: 'flex-grow:1' }), el('span', { class: 'badge', style: 'background:rgba(253,251,247,.12);color:var(--cream);border-color:rgba(253,251,247,.2);' }, 'Open flowchart →')),
      el('div', { class: 'checkpoint-progress' }, el('span', { style: `width:${pct}%` })),
    );
  }

  function monthDay(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // ——— MAP ———
  const mapSvg = $('#map-svg');

  function renderMap() {
    mapSvg.innerHTML = '';
    const NS = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(NS, 'g');

    // Background ocean shading
    const bg = document.createElementNS(NS, 'rect');
    bg.setAttribute('width', 1200); bg.setAttribute('height', 720); bg.setAttribute('fill', 'url(#oc)');
    const defs = document.createElementNS(NS, 'defs');
    defs.innerHTML = `
      <linearGradient id="oc" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#E0EAF2"/><stop offset="1" stop-color="#F1E8DA"/>
      </linearGradient>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M40 0H0V40" fill="none" stroke="rgba(45,90,123,.06)" stroke-width="1"/>
      </pattern>
      <pattern id="dots" width="14" height="14" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1" fill="rgba(45,90,123,.07)"/>
      </pattern>
    `;
    mapSvg.append(defs);
    mapSvg.append(bg);

    // Faux-continent landmasses (stylized blobs)
    const usa = document.createElementNS(NS, 'path');
    usa.setAttribute('d', 'M -50 200 C 0 160, 80 160, 140 190 C 200 220, 240 230, 280 250 C 290 280, 260 320, 200 340 C 140 360, 60 360, 0 340 C -40 320, -60 260, -50 200 Z');
    usa.setAttribute('fill', '#E8E0CF'); usa.setAttribute('stroke', 'rgba(148,139,130,.3)'); usa.setAttribute('stroke-width', '1');
    mapSvg.append(usa);

    const asia = document.createElementNS(NS, 'path');
    asia.setAttribute('d', 'M 600 180 C 680 150, 780 160, 860 180 C 940 200, 1020 220, 1080 260 C 1130 320, 1100 380, 1040 420 C 970 460, 880 460, 820 440 C 760 420, 720 400, 680 380 C 640 360, 600 320, 580 280 C 580 240, 580 200, 600 180 Z');
    asia.setAttribute('fill', '#E8E0CF'); asia.setAttribute('stroke', 'rgba(148,139,130,.3)'); asia.setAttribute('stroke-width', '1');
    mapSvg.append(asia);

    // Japan island (smaller, more specific)
    const japan = document.createElementNS(NS, 'path');
    japan.setAttribute('d', 'M 770 360 C 790 340, 820 350, 830 380 C 850 380, 870 360, 900 340 C 920 320, 940 310, 950 320 C 960 340, 945 360, 925 370 C 940 380, 950 400, 940 410 C 920 420, 900 410, 880 400 C 860 410, 840 410, 820 400 C 800 390, 780 380, 770 360 Z');
    japan.setAttribute('fill', '#D9CFB7'); japan.setAttribute('stroke', 'rgba(148,139,130,.4)'); japan.setAttribute('stroke-width', '1');
    mapSvg.append(japan);

    // Grid overlay (subtle)
    const grid = document.createElementNS(NS, 'rect');
    grid.setAttribute('width', 1200); grid.setAttribute('height', 720); grid.setAttribute('fill', 'url(#grid)');
    mapSvg.append(grid);

    // Compass / scale text
    const compass = document.createElementNS(NS, 'g');
    compass.setAttribute('transform', 'translate(60 640)');
    compass.innerHTML = `
      <text x="0" y="0" font-family="JetBrains Mono, monospace" font-size="9" fill="#948B82" letter-spacing="2">N 35.6°  E 139.6°</text>
      <text x="0" y="14" font-family="JetBrains Mono, monospace" font-size="9" fill="#948B82" letter-spacing="2">PACIFIC PROJECTION · 1:8M</text>
      <line x1="0" y1="22" x2="60" y2="22" stroke="#948B82" stroke-width="1"/>
      <text x="0" y="36" font-family="JetBrains Mono, monospace" font-size="8" fill="#948B82">500 km</text>
    `;
    mapSvg.append(compass);

    // Region labels
    const labels = [
      ['UNITED STATES', 130, 230, 11, 'rgba(44,48,51,.45)'],
      ['PACIFIC OCEAN', 540, 380, 12, 'rgba(45,90,123,.4)'],
      ['JAPAN', 880, 320, 11, 'rgba(44,48,51,.5)'],
    ];
    labels.forEach(([t,x,y,sz,c]) => {
      const lab = document.createElementNS(NS, 'text');
      lab.setAttribute('x', x); lab.setAttribute('y', y);
      lab.setAttribute('font-family', 'Inter, sans-serif');
      lab.setAttribute('font-size', sz);
      lab.setAttribute('font-weight', 500);
      lab.setAttribute('letter-spacing', '4');
      lab.setAttribute('fill', c);
      lab.textContent = t;
      mapSvg.append(lab);
    });

    // Determine routes & pins to draw based on view
    const routes = buildRoutes();
    routes.forEach(r => drawRoute(r));

    // Pins
    const pinsToShow = pinsForView();
    pinsToShow.forEach(p => drawPin(p));
  }

  function buildRoutes() {
    const r = [];
    if (state.mapView === 'flights' || state.mapView === 'all') {
      r.push({ from: 'SFO', to: 'HND', kind: 'flight', curve: 0.45, label: 'NH107' });
      r.push({ from: 'HND', to: 'SFO', kind: 'flight', curve: -0.35, label: 'NH108' });
    }
    if (state.mapView === 'all') {
      // Tokyo - Hakone - Kyoto - Nara
      r.push({ from: 'HND', to: 'HAKO', kind: 'transit' });
      r.push({ from: 'HAKO', to: 'KYO', kind: 'transit' });
      r.push({ from: 'KYO', to: 'NARA', kind: 'transit' });
      r.push({ from: 'KYO', to: 'HND', kind: 'transit' });
    }
    if (state.mapView === 'day') {
      const day = T.days[state.selectedDay];
      // chain consecutive items with linkPlaces
      const seq = day.items.filter(it => it.linkPlace).map(it => it.linkPlace);
      for (let i = 0; i < seq.length - 1; i++) {
        if (seq[i] === seq[i+1]) continue;
        r.push({ from: seq[i], to: seq[i+1], kind: 'transit' });
      }
    }
    return r;
  }

  function drawRoute(r) {
    const NS = 'http://www.w3.org/2000/svg';
    const a = T.places[r.from], b = T.places[r.to];
    if (!a || !b) return;
    const c = r.curve || 0;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2 - Math.abs(b.x - a.x) * c;
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`);
    path.setAttribute('fill', 'none');
    if (r.kind === 'flight') {
      path.setAttribute('stroke', '#2D5A7B');
      path.setAttribute('stroke-width', '1.6');
      path.setAttribute('stroke-dasharray', '4 4');
      path.setAttribute('opacity', '0.8');
    } else {
      path.setAttribute('stroke', '#8B9D83');
      path.setAttribute('stroke-width', '2.2');
      path.setAttribute('opacity', '0.7');
    }
    mapSvg.append(path);

    if (r.label) {
      // Label along arc midpoint
      const lab = document.createElementNS(NS, 'g');
      const ly = (a.y + my) / 2;
      const lx = mx;
      lab.innerHTML = `
        <rect x="${lx-26}" y="${ly-9}" width="52" height="18" rx="9" fill="#FDFBF7" stroke="rgba(45,90,123,.3)"/>
        <text x="${lx}" y="${ly+3}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="9" fill="#2D5A7B" font-weight="500">${r.label}</text>
      `;
      mapSvg.append(lab);
    }
  }

  function pinsForView() {
    if (state.mapView === 'flights') return ['SFO', 'HND'];
    if (state.mapView === 'day') {
      const day = T.days[state.selectedDay];
      return [...new Set(day.items.map(it => it.linkPlace).filter(Boolean))];
    }
    return Object.keys(T.places);
  }

  function drawPin(code) {
    const NS = 'http://www.w3.org/2000/svg';
    const p = T.places[code];
    if (!p) return;
    const isAirport = p.kind === 'airport';
    const color = isAirport ? '#2D5A7B' : (code === 'HAKO' || code === 'KYO' || code === 'NARA' ? '#C07856' : '#8B9D83');

    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'map-pin');
    g.setAttribute('data-code', code);
    g.setAttribute('transform', `translate(${p.x} ${p.y})`);
    g.style.cursor = 'pointer';

    const ring = document.createElementNS(NS, 'circle');
    ring.setAttribute('r', isAirport ? '14' : '10');
    ring.setAttribute('fill', '#FDFBF7');
    ring.setAttribute('stroke', color);
    ring.setAttribute('stroke-width', '2');
    g.append(ring);

    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('r', isAirport ? '5' : '4');
    dot.setAttribute('fill', color);
    g.append(dot);

    const lab = document.createElementNS(NS, 'g');
    const labY = p.y < 380 ? 28 : -18;
    lab.innerHTML = `
      <rect x="-26" y="${labY-10}" width="52" height="18" rx="9" fill="#FDFBF7" stroke="rgba(148,139,130,.25)"/>
      <text x="0" y="${labY+3}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" font-weight="500" fill="#2C3033">${code}</text>
    `;
    g.append(lab);

    g.addEventListener('click', () => {
      const found = findItemForPlace(code);
      if (found) {
        state.activeId = found.id;
        state.selectedDay = found.dayIdx;
        renderDayPicker(); renderTimeline();
        updateSelectedOverlay(found.item);
        flashOnMap(code);
      }
    });

    mapSvg.append(g);
  }

  function findItemForPlace(code) {
    for (let i = 0; i < T.days.length; i++) {
      const it = T.days[i].items.find(x => x.linkPlace === code);
      if (it) return { item: it, dayIdx: i, id: it.id };
    }
    return null;
  }

  function highlightMap(code) {
    if (!code) return;
    $$('.map-pin').forEach(g => {
      g.classList.toggle('dim', g.getAttribute('data-code') !== code);
    });
  }
  function unhighlightMap() {
    $$('.map-pin').forEach(g => g.classList.remove('dim'));
  }
  function flashOnMap(code) {
    if (!code) return;
    const pin = mapSvg.querySelector(`[data-code="${code}"]`);
    if (pin) {
      pin.classList.remove('flash');
      void pin.getBoundingClientRect();
      pin.classList.add('flash');
    }
  }

  function updateSelectedOverlay(it) {
    if (!it) return;
    $('#selected-name').textContent = it.title;
    $('#selected-sub').textContent = it.sub || '';
  }

  // map view segmented
  $$('.seg button[data-mapview]').forEach(b => b.addEventListener('click', () => {
    $$('.seg button[data-mapview]').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    state.mapView = b.dataset.mapview;
    $('#map-sub').textContent = state.mapView === 'flights' ? 'Long-haul flights · SFO ⇄ HND'
      : state.mapView === 'day' ? `Day ${T.days[state.selectedDay].num} · ${T.days[state.selectedDay].where}`
      : 'Showing all 9 days · Tokyo + Kansai';
    renderMap();
  }));

  // ——— DOC LIST ———
  const docListEl = $('#doc-list');
  function renderDocs() {
    docListEl.innerHTML = '';
    T.docs.forEach(d => {
      const s = state.docs[d.id];
      const cls = s === 'done' ? 'done' : s === 'warn' ? 'warn' : '';
      const tickIcon = s === 'done' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M5 12l5 5 9-11"/></svg>'
                     : s === 'warn' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 8v5M12 17h.01"/></svg>'
                     : '';
      const row = el('div', { class: `doc ${cls}`,
        onclick: () => {
          if (s === 'skipped') return;
          state.docs[d.id] = s === 'done' ? 'warn' : 'done';
          renderDocs(); updateReadiness();
        }
      },
        el('div', { class: 'doc-tick ico-sm', html: tickIcon }),
        el('div', { class: 'doc-text' },
          el('div', { class: 't' }, d.title),
          el('div', { class: 's' }, d.sub),
        ),
        d.link ? el('a', { class: 'doc-link', href: '#', onclick: (e) => e.stopPropagation() }, d.link + ' ↗') : null,
      );
      docListEl.append(row);
    });
  }

  // ——— HOTEL LIST ———
  const hotelListEl = $('#hotel-list');
  function renderHotels() {
    hotelListEl.innerHTML = '';
    T.hotels.forEach(h => {
      const card = el('div', { class: 'hotel' + (h.picked ? ' selected' : '') },
        el('div', { class: 'hotel-img ' + (h.color === 'lavender' ? 'lavender' : h.color === 'ocean' ? 'ocean' : ''), 'data-label': h.code }),
        el('div', { class: 'hotel-info' },
          el('div', { class: 'name' }, h.name),
          el('div', { class: 'meta' }, h.area),
          el('div', { class: 'price-row' },
            el('div', { class: 'price' }, '$' + h.price, el('small', {}, '/night · ' + h.nights + 'n')),
            el('div', { class: 'stars' }, '★ ' + h.stars),
          ),
        ),
      );
      hotelListEl.append(card);
    });
  }

  // ——— CANVAS FLOWCHART ———
  const flowNodesEl = $('#flow-nodes');
  const flowEdgesEl = $('#flow-edges');
  const flowInnerEl = $('#flow-inner');
  const flowCanvasEl = $('#flow-canvas');
  const NS = 'http://www.w3.org/2000/svg';

  const nodeMap = Object.fromEntries(T.flow.nodes.map(n => [n.id, n]));

  // Walk active path: start → follow chosen edges
  function activePath() {
    const visited = new Set();
    const path = [];
    let id = T.flow.startId;
    while (id && !visited.has(id)) {
      visited.add(id);
      path.push(id);
      const n = nodeMap[id];
      if (!n) break;
      if (n.kind === 'end') break;
      if (n.choices) {
        const choiceId = state.flowChoices[n.id];
        const choice = n.choices.find(c => c.id === choiceId) || n.choices[0];
        id = choice.to;
      } else {
        id = n.next;
      }
    }
    return path;
  }
  function activeFlowNodes() {
    return activePath().map(id => nodeMap[id]).filter(n => n && n.kind !== 'start' && n.kind !== 'end');
  }
  function activeEdges() {
    const path = activePath();
    const set = new Set();
    for (let i = 0; i < path.length - 1; i++) {
      set.add(`${path[i]}→${path[i+1]}`);
    }
    return set;
  }

  function renderFlow(animateNew = false) {
    flowNodesEl.innerHTML = '';
    flowEdgesEl.innerHTML = '';
    const active = new Set(activePath());
    const activeE = activeEdges();

    // Render edges first
    T.flow.nodes.forEach(n => {
      const targets = [];
      if (n.choices) n.choices.forEach(c => targets.push({ to: c.to, label: c.label.split(' · ')[0] }));
      else if (n.next) targets.push({ to: n.next });
      targets.forEach(t => {
        const target = nodeMap[t.to];
        if (!target) return;
        const isActive = activeE.has(`${n.id}→${t.to}`);
        drawEdge(n, target, isActive, t.label);
      });
    });

    // Render nodes
    T.flow.nodes.forEach(n => {
      const isOnPath = active.has(n.id);
      const isDone = state.flow[n.id];
      flowNodesEl.append(makeFlowNode(n, isOnPath, isDone));
    });

    updateFlowSummary();
    renderMinimap();
    renderTrail();
    applyView();
  }

  function drawEdge(a, b, isActive, label) {
    // Compute endpoints from approximate node anchor (bottom-center → top-center)
    const aw = a.w || 240, bw = b.w || 240;
    const ah = a.kind === 'start' || a.kind === 'end' ? 56 : (a.choices ? 150 : 110);
    const ax = a.x + aw/2, ay = a.y + ah;
    const bx = b.x + bw/2, by = b.y;
    const midY = (ay + by) / 2;

    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', `M ${ax} ${ay} C ${ax} ${midY}, ${bx} ${midY}, ${bx} ${by}`);
    path.setAttribute('class', 'flow-edge' + (isActive ? ' active' : ' dim'));
    flowEdgesEl.append(path);

    if (label) {
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', (ax + bx) / 2);
      t.setAttribute('y', midY - 4);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('class', 'flow-edge-label');
      t.textContent = label;
      flowEdgesEl.append(t);
    }

    // Arrowhead
    const arr = document.createElementNS(NS, 'circle');
    arr.setAttribute('cx', bx); arr.setAttribute('cy', by - 2);
    arr.setAttribute('r', 3);
    arr.setAttribute('fill', isActive ? '#6E8068' : '#C9C2BB');
    flowEdgesEl.append(arr);
  }

  function makeFlowNode(n, isOnPath, isDone) {
    const cls = `fnode ${n.kind}` + (isDone ? ' done' : '') + (!isOnPath ? ' dim' : '');
    const node = el('div', { class: cls,
      style: `left:${n.x}px;top:${n.y}px;${n.w ? `width:${n.w}px;` : ''}`,
    });

    if (n.kind === 'start' || n.kind === 'end') {
      node.append(
        el('div', { class: 'fnode-label' }, n.label),
        el('div', { class: 'fnode-title' }, n.title),
      );
      return node;
    }

    const tickIcon = isDone
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M5 12l5 5 9-11"/></svg>'
      : '';
    node.append(
      el('button', { class: 'fnode-tick', html: tickIcon, 'aria-label': 'Toggle done',
        onclick: (e) => {
          e.stopPropagation();
          state.flow[n.id] = !state.flow[n.id];
          renderFlow(); updateReadiness(); renderTimeline();
        }
      }),
      el('div', { class: 'fnode-label' }, n.label),
      el('div', { class: 'fnode-title' }, n.title),
      n.desc ? el('div', { class: 'fnode-desc' }, n.desc) : null,
      n.meta ? el('div', { class: 'fnode-meta' }, n.meta) : null,
      n.link ? el('a', { class: 'fnode-link', href: n.link.href, onclick: e => e.stopPropagation() }, n.link.label, ' ↗') : null,
      n.choices ? el('div', { class: 'fnode-choices' },
        ...n.choices.map(c => {
          const yn = c.id.startsWith('yes') ? 'yes' : c.id === 'no' ? 'no' : '';
          const isOn = state.flowChoices[n.id] === c.id;
          return el('button', { class: `fnode-choice ${yn}` + (isOn ? ' on' : ''),
            onclick: (e) => {
              e.stopPropagation();
              state.flowChoices[n.id] = c.id;
              renderFlow(true);
            }
          }, c.label);
        })
      ) : null,
    );
    return node;
  }

  function renderTrail() {
    const trail = $('#flow-trail');
    trail.innerHTML = '';
    activePath().forEach((id, i, arr) => {
      const n = nodeMap[id];
      if (!n) return;
      const short = n.kind === 'start' ? 'Start'
        : n.kind === 'end' ? 'Done'
        : (n.title.split(/[·:]/)[0]).slice(0, 22).trim();
      trail.append(el('span', { class: 'crumb' + (i === arr.length - 1 ? ' active' : '') }, short));
      if (i < arr.length - 1) trail.append(el('span', { style: 'color:var(--mocha);font-size:10px;' }, '→'));
    });
  }

  function updateFlowSummary() {
    const items = activeFlowNodes();
    const total = items.length;
    const done = items.filter(n => state.flow[n.id]).length;
    const pct = total ? Math.round(done * 100 / total) : 0;
    $('#flow-pct').textContent = pct + '%';
    $('#flow-summary').textContent = `${done} of ${total} on your path · ${total - done} pending`;
  }

  function updateReadiness() {
    const items = activeFlowNodes();
    const total = items.length;
    const done = items.filter(n => state.flow[n.id]).length;
    const pct = total ? Math.round(done * 100 / total) : 0;
    $('#readiness-pct').textContent = pct + '%';
    $('#readiness-bar').style.width = pct + '%';
  }

  // ——— pan + zoom ———
  function applyView() {
    const v = state.flowView;
    flowInnerEl.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.scale})`;
  }
  function fitToScreen() {
    const r = flowCanvasEl.getBoundingClientRect();
    // canvas content roughly spans 600..1900 x, 0..2000 y
    const path = activePath();
    const pts = path.map(id => nodeMap[id]).filter(Boolean);
    const xs = pts.map(p => p.x); const ys = pts.map(p => p.y);
    const minX = Math.min(...xs) - 80, maxX = Math.max(...xs) + 320;
    const minY = Math.min(...ys) - 40, maxY = Math.max(...ys) + 200;
    const w = maxX - minX, h = maxY - minY;
    const scale = Math.min(r.width / w, r.height / h, 0.85);
    state.flowView.scale = scale;
    state.flowView.x = (r.width - w * scale) / 2 - minX * scale;
    state.flowView.y = (r.height - h * scale) / 2 - minY * scale;
    applyView();
  }

  // drag to pan
  let dragging = false, dragStart = null;
  flowCanvasEl.addEventListener('mousedown', (e) => {
    if (e.target.closest('.fnode') || e.target.closest('.flow-toolbar')) return;
    dragging = true;
    flowCanvasEl.classList.add('dragging', 'grabbing');
    dragStart = { x: e.clientX - state.flowView.x, y: e.clientY - state.flowView.y };
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    state.flowView.x = e.clientX - dragStart.x;
    state.flowView.y = e.clientY - dragStart.y;
    applyView();
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
    flowCanvasEl.classList.remove('dragging', 'grabbing');
  });
  flowCanvasEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = flowCanvasEl.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const before = state.flowView.scale;
    const after = Math.min(1.6, Math.max(0.3, before * (e.deltaY < 0 ? 1.1 : 0.9)));
    // zoom toward cursor
    state.flowView.x = mx - (mx - state.flowView.x) * (after / before);
    state.flowView.y = my - (my - state.flowView.y) * (after / before);
    state.flowView.scale = after;
    applyView();
    renderMinimap();
  }, { passive: false });

  $('#flow-fit').addEventListener('click', fitToScreen);
  $('#flow-reset').addEventListener('click', () => {
    T.flow.nodes.forEach(n => {
      if (n.choices) {
        const def = n.choices.find(c => c.on) || n.choices[0];
        state.flowChoices[n.id] = def.id;
      }
    });
    renderFlow();
  });

  function renderMinimap() {
    const svg = $('#flow-minimap-svg');
    svg.innerHTML = '';
    const active = new Set(activePath());
    T.flow.nodes.forEach(n => {
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', n.x); r.setAttribute('y', n.y);
      r.setAttribute('width', n.w || 240); r.setAttribute('height', n.choices ? 130 : 90);
      r.setAttribute('rx', 16);
      r.setAttribute('fill', active.has(n.id) ? '#8B9D83' : '#C9C2BB');
      r.setAttribute('opacity', active.has(n.id) ? '0.85' : '0.35');
      svg.append(r);
    });
    // viewport rect
    const cr = flowCanvasEl.getBoundingClientRect();
    const v = state.flowView;
    const vp = document.createElementNS(NS, 'rect');
    vp.setAttribute('class', 'vp');
    vp.setAttribute('x', -v.x / v.scale);
    vp.setAttribute('y', -v.y / v.scale);
    vp.setAttribute('width', cr.width / v.scale);
    vp.setAttribute('height', cr.height / v.scale);
    svg.append(vp);
  }

  // ——— FLOW MODAL OPEN/CLOSE ———
  function openFlow() { $('#flow-overlay').classList.add('open'); }
  function closeFlow() { $('#flow-overlay').classList.remove('open'); }
  $('#flow-close').addEventListener('click', closeFlow);
  $('#open-flow-btn').addEventListener('click', openFlow);
  $('#open-flow-link').addEventListener('click', (e) => { e.preventDefault(); openFlow(); });
  $('#flow-overlay').addEventListener('click', (e) => { if (e.target.id === 'flow-overlay') closeFlow(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeFlow(); });

  // ——— init ———
  renderDayPicker();
  renderTimeline();
  renderMap();
  renderDocs();
  renderHotels();
  renderFlow();
  // initial fit-to-screen on first open
  let firstOpen = true;
  document.addEventListener('click', () => {
    if (firstOpen && $('#flow-overlay').classList.contains('open')) {
      firstOpen = false;
      requestAnimationFrame(fitToScreen);
    }
  }, true);
  updateReadiness();
})();
