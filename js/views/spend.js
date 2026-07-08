/* ============================================================
 * views/spend.js — 소비분석
 *  ① 월별 소비 추이(전체 기간 + 12개월 이동평균)
 *  ② 연도별 비교
 *  ③ 카테고리 딥다이브 (기간 선택 → 바 리스트 → 클릭 시 상세)
 *  ④ 요일별 평균 / ⑤ 월 프로파일(계절성)
 *  ⑥ 고정 지출 자동 탐지
 * ============================================================ */
window.VIEW_SPEND = (() => {
  const S = window.STORE;
  let range = '12m'; // '12m' | '2026' ... | 'all'
  let selCat = null;

  /* ---- 기간 → 대상 월 목록 ---- */
  function rangeMonths() {
    if (range === 'all') return S.months;
    if (range === '12m') return S.months.slice(-12);
    return S.months.filter(mk => mk.startsWith(range));
  }
  const rangeLabel = () => range === 'all' ? '전체 기간' : range === '12m' ? '최근 12개월' : `${range}년`;

  /* ---- 고정 지출 탐지: 최근 8개 완결월 중 6개월 이상 등장한 장소 ---- */
  function detectFixed() {
    const mks = S.months.filter(mk => !(S.isPartial && mk === S.lastMonth)).slice(-8);
    const map = new Map(); // place → {months:Set, sum, cat}
    for (const mk of mks) {
      for (const t of S.byMonth.get(mk).txs) {
        if (t.ty !== 'e' || !t.p || t.a <= 0) continue;
        const key = t.p.replace(/\s*\/\s*고정비/, '').trim();
        if (!map.has(key)) map.set(key, { months: new Set(), sum: 0, cat: t.sc });
        const e = map.get(key);
        e.months.add(mk); e.sum += t.a;
      }
    }
    return [...map.entries()]
      .filter(([, e]) => e.months.size >= 6 && e.sum / e.months.size >= 3000)
      .map(([p, e]) => ({ p, avg: e.sum / e.months.size, n: e.months.size, cat: e.cat }))
      .sort((a, b) => b.avg - a.avg);
  }

  function render(root) {
    const mks = rangeMonths();
    /* 기간 내 카테고리 합계 */
    const catSum = new Map();
    let total = 0;
    for (const mk of mks) {
      for (const [c, v] of S.byMonth.get(mk).byCat) { catSum.set(c, (catSum.get(c) || 0) + v); total += v; }
    }
    const cats = [...catSum.entries()].sort((a, b) => b[1] - a[1]);
    if (!selCat || !catSum.has(selCat)) selCat = cats[0] && cats[0][0];

    /* 요일/월 프로파일 (기간 기준) */
    const wd = Array(7).fill(0), wdN = Array(7).fill(0);
    const mo = Array(12).fill(0), moN = Array(12).fill(0);
    const seenDay = new Set(), seenYM = new Set();
    for (const mk of mks) for (const t of S.byMonth.get(mk).txs) {
      if (t.ty !== 'e') continue;
      const d = new Date(t.d);
      wd[d.getDay()] += t.a;
      mo[d.getMonth()] += t.a;
      if (!seenDay.has(t.d)) { seenDay.add(t.d); wdN[d.getDay()]++; }
      const ym = t.d.slice(0, 7);
      if (!seenYM.has(ym + ':' + d.getMonth())) { seenYM.add(ym + ':' + d.getMonth()); moN[d.getMonth()]++; }
    }

    const years = [...S.byYear.keys()].sort();
    const fixed = detectFixed();
    const fixedSum = fixed.reduce((s, f) => s + f.avg, 0);

    root.innerHTML = `
      <div class="card">
        <h3><i class="fa-solid fa-wave-square"></i>월별 소비 추이 <span class="more">2018.04 ~ · 점선 = 12개월 이동평균</span></h3>
        <div class="chart-box tall"><canvas id="sp-trend"></canvas></div>
      </div>

      <div class="card" style="animation-delay:.06s">
        <h3><i class="fa-solid fa-calendar-days"></i>연도별 지출·저축률</h3>
        <div class="chart-box"><canvas id="sp-year"></canvas></div>
      </div>

      <div class="card" style="animation-delay:.12s">
        <h3><i class="fa-solid fa-layer-group"></i>카테고리 분석 <span class="more">기간 선택 후 항목을 눌러보세요</span></h3>
        <div class="chips" id="sp-range" style="margin-bottom:16px">
          <button class="chip ${range === '12m' ? 'on' : ''}" data-r="12m">최근 12개월</button>
          ${years.slice().reverse().map(y => `<button class="chip ${range === y ? 'on' : ''}" data-r="${y}">${y}</button>`).join('')}
          <button class="chip ${range === 'all' ? 'on' : ''}" data-r="all">전체</button>
        </div>
        <div class="grid g2" style="margin-top:0">
          <div class="bar-list" id="sp-cats"></div>
          <div>
            <div id="sp-cat-title" style="font-size:13px;font-weight:700;margin-bottom:10px"></div>
            <div class="chart-box" style="height:170px"><canvas id="sp-cat-chart"></canvas></div>
            <div class="rows" id="sp-cat-places" style="margin-top:8px"></div>
          </div>
        </div>
        <p class="footnote">${rangeLabel()} 지출 합계 <b class="sec">${U.won(total, true)}</b></p>
      </div>

      <div class="grid g2">
        <div class="card" style="animation-delay:.18s">
          <h3><i class="fa-solid fa-calendar-week"></i>요일별 하루 평균 <span class="more">${rangeLabel()}</span></h3>
          <div class="chart-box" style="height:200px"><canvas id="sp-wd"></canvas></div>
        </div>
        <div class="card" style="animation-delay:.22s">
          <h3><i class="fa-solid fa-snowflake"></i>월 프로파일(계절성) <span class="more">${rangeLabel()}</span></h3>
          <div class="chart-box" style="height:200px"><canvas id="sp-mo"></canvas></div>
        </div>
      </div>

      <div class="card" style="animation-delay:.26s">
        <h3><i class="fa-solid fa-rotate"></i>고정 지출 자동 탐지
          <span class="more">최근 8개월 중 6개월 이상 반복 · 월 약 <b class="sec">${U.won(fixedSum)}</b></span></h3>
        <div class="rows" id="sp-fixed"></div>
        <p class="footnote">장소 기준 반복 결제를 자동 탐지한 결과예요. 구독·보험·통신·회비 성격의 지출이 잡힙니다.</p>
      </div>

      <div class="card" style="animation-delay:.3s">
        <h3><i class="fa-solid fa-arrow-trend-up"></i>개인 물가지수
          <span class="more">자주 가는 곳의 연도별 결제 중앙값 · 첫해 = 100</span></h3>
        <div class="chart-box"><canvas id="sp-cpi"></canvas></div>
        <div class="rows" id="sp-cpi-list" style="margin-top:8px"></div>
        <p class="footnote">공식 물가지수가 아니라 <b>내 소비 기록으로 만든 체감 물가</b>예요. 반복 방문 장소의 1회 결제액 변화를 추적합니다.</p>
      </div>`;

    /* ① 전체 추이 + 이동평균 */
    const all = S.months;
    const exps = all.map(mk => S.byMonth.get(mk).exp);
    const ma = exps.map((_, i) => {
      const w = exps.slice(Math.max(0, i - 11), i + 1);
      return w.reduce((a, b) => a + b, 0) / w.length;
    });
    const o1 = CH.baseOpts();
    o1.interaction = { mode: 'index', intersect: false };
    o1.plugins.tooltip.callbacks = { label: c => ` ${c.dataset.label}: ${U.won(c.parsed.y, true)}` };
    o1.scales.x.ticks.maxTicksLimit = 10;
    CH.make('sp-trend', { type: 'line', data: {
      labels: all.map(x => x.slice(2).replace('-', '.')),
      datasets: [
        { label: '월 지출', data: exps, borderColor: CH.css('--coral'), backgroundColor: 'rgba(248,123,107,.08)',
          fill: true, tension: .3, pointRadius: 0, borderWidth: 2 },
        { label: '12M 평균', data: ma, borderColor: CH.css('--gold'), borderDash: [5, 5], pointRadius: 0, borderWidth: 1.6 },
      ] }, options: o1 });

    /* ② 연도별 지출 + 저축률 */
    const yExp = years.map(y => S.byYear.get(y).exp);
    const yRate = years.map(y => { const Y = S.byYear.get(y); return Y.inc ? (Y.inc - Y.exp) / Y.inc * 100 : null; });
    const o2 = CH.baseOpts();
    o2.scales.y1 = { position: 'right', grid: { display: false }, border: { display: false },
      ticks: { color: CH.css('--jade'), font: { size: 10 }, callback: v => v + '%' }, min: 0, max: 100 };
    o2.plugins.tooltip.callbacks = { label: c => c.dataset.yAxisID === 'y1'
      ? ` 저축률: ${c.parsed.y.toFixed(1)}%` : ` 지출: ${U.won(c.parsed.y, true)}` };
    CH.make('sp-year', { type: 'bar', data: {
      labels: years,
      datasets: [
        { label: '연 지출', data: yExp, backgroundColor: 'rgba(248,123,107,.65)', borderRadius: 8, maxBarThickness: 34 },
        { type: 'line', label: '저축률', data: yRate, yAxisID: 'y1', borderColor: CH.css('--jade'),
          pointBackgroundColor: CH.css('--jade'), tension: .3, borderWidth: 2 },
      ] }, options: o2 });

    /* ③ 카테고리 바 리스트 */
    const max = cats.length ? cats[0][1] : 1;
    root.querySelector('#sp-cats').innerHTML = cats.slice(0, 12).map(([c, v]) => {
      const col = CFG.colors[c] || '#6B7280';
      return `<div class="bar-item ${c === selCat ? 'sel' : ''}" data-cat="${U.esc(c)}">
        <div class="bl-top"><span class="n"><i class="fa-solid ${CFG.icons[c] || 'fa-receipt'}" style="color:${col};width:14px"></i>${U.esc(c)}</span>
        <span class="v num sec">${U.won(v)} <span class="pill">${(v / total * 100).toFixed(1)}%</span></span></div>
        <div class="bl-bar"><i style="width:${(v / max * 100).toFixed(1)}%;background:${col}"></i></div></div>`;
    }).join('');
    renderCatDetail(root, mks);

    root.querySelector('#sp-cats').addEventListener('click', e => {
      const it = e.target.closest('.bar-item'); if (!it) return;
      selCat = it.dataset.cat;
      root.querySelectorAll('.bar-item').forEach(b => b.classList.toggle('sel', b.dataset.cat === selCat));
      renderCatDetail(root, mks);
    });
    root.querySelector('#sp-range').addEventListener('click', e => {
      const b = e.target.closest('.chip'); if (!b) return;
      range = b.dataset.r; render(root);
    });

    /* ④ 요일 */
    const wdL = ['일', '월', '화', '수', '목', '금', '토'];
    const wdAvg = wd.map((v, i) => wdN[i] ? v / wdN[i] : 0);
    const o4 = CH.baseOpts();
    o4.plugins.tooltip.callbacks = { label: c => ` 하루 평균 ${U.won(c.parsed.y, true)}` };
    CH.make('sp-wd', { type: 'bar', data: { labels: wdL, datasets: [{
      data: wdAvg, borderRadius: 7, maxBarThickness: 30,
      backgroundColor: wdAvg.map((v, i) => i === 0 || i === 6 ? 'rgba(230,201,127,.75)' : 'rgba(127,180,242,.55)') }] },
      options: o4 });

    /* ⑤ 월 프로파일 */
    const moAvg = mo.map((v, i) => moN[i] ? v / moN[i] : 0);
    const o5 = CH.baseOpts();
    o5.plugins.tooltip.callbacks = { label: c => ` 월평균 ${U.won(c.parsed.y, true)}` };
    CH.make('sp-mo', { type: 'bar', data: { labels: [...Array(12)].map((_, i) => (i + 1) + '월'),
      datasets: [{ data: moAvg, borderRadius: 6, maxBarThickness: 22,
        backgroundColor: moAvg.map(v => v === Math.max(...moAvg) ? CH.css('--coral') : 'rgba(167,139,250,.5)') }] },
      options: o5 });

    /* ⑥ 고정 지출 */
    root.querySelector('#sp-fixed').innerHTML = fixed.slice(0, 12).map(f => {
      const col = CFG.colors[f.cat] || '#6B7280';
      return `<div class="row">
        <div class="ic" style="background:${col}22;color:${col}"><i class="fa-solid ${CFG.icons[f.cat] || 'fa-rotate'}"></i></div>
        <div class="t"><div class="p">${U.esc(f.p)}</div><div class="s">${U.esc(f.cat)} · 8개월 중 ${f.n}개월</div></div>
        <div class="a exp num sec">월 ${U.won(f.avg)}</div></div>`;
    }).join('') || '<p class="footnote">탐지된 고정 지출이 없어요.</p>';

    /* ⑦ 개인 물가지수 */
    renderCPI(root);
  }

  /* ---- 개인 물가지수: 반복 방문 장소의 연도별 1회 결제 중앙값 ---- */
  function buildCPI() {
    const byPlace = new Map();
    for (const t of S.tx) {
      if (t.ty !== 'e' || !t.p || t.a < 500) continue;
      if (/지하철|생활비|여행계|고정비/.test(t.p)) continue; // 월 합산 결제 제외
      if (!byPlace.has(t.p)) byPlace.set(t.p, []);
      byPlace.get(t.p).push(t);
    }
    const med = arr => { const s = arr.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
    const out = [];
    for (const [p, txs] of byPlace) {
      if (txs.length < 25) continue;
      const byY = new Map();
      for (const t of txs) { const y = t.d.slice(0, 4); if (!byY.has(y)) byY.set(y, []); byY.get(y).push(t.a); }
      const years = [...byY.keys()].sort().filter(y => byY.get(y).length >= 3);
      if (years.length < 4) continue;
      const series = years.map(y => ({ y, v: med(byY.get(y)) }));
      const change = series[series.length - 1].v / series[0].v - 1;
      out.push({ p, n: txs.length, series, change, cat: txs[0].sc });
    }
    return out.sort((a, b) => b.n - a.n).slice(0, 4);
  }

  function renderCPI(root) {
    const items = buildCPI();
    if (!items.length) { root.querySelector('#sp-cpi').closest('.card').style.display = 'none'; return; }
    const years = [...new Set(items.flatMap(i => i.series.map(s => s.y)))].sort();
    const palette = ['#E6C97F', '#57D6A9', '#7FB4F2', '#F27BA0'];
    const o = CH.baseOpts();
    o.interaction = { mode: 'index', intersect: false };
    o.scales.y.ticks.callback = v => v;
    o.plugins.legend = { display: true, position: 'bottom',
      labels: { color: CH.css('--mut'), font: { size: 10 }, boxWidth: 8, boxHeight: 8 } };
    o.plugins.tooltip.callbacks = { label: c => {
      const it = items[c.datasetIndex];
      const pt = it.series.find(s => s.y === years[c.dataIndex]);
      return pt ? ` ${it.p}: ${U.won(pt.v, true)} (지수 ${c.parsed.y})` : null; } };
    CH.make('sp-cpi', { type: 'line', data: { labels: years,
      datasets: items.map((it, i) => ({
        label: it.p, borderColor: palette[i], pointBackgroundColor: palette[i],
        borderWidth: 2, tension: .3, spanGaps: true, pointRadius: 3,
        data: years.map(y => { const pt = it.series.find(s => s.y === y);
          return pt ? Math.round(pt.v / it.series[0].v * 100) : null; }) })) },
      options: o });
    root.querySelector('#sp-cpi-list').innerHTML = items.map((it, i) =>
      `<div class="row"><div class="ic" style="background:${palette[i]}22;color:${palette[i]}"><i class="fa-solid ${CFG.icons[it.cat] || 'fa-tag'}"></i></div>
       <div class="t"><div class="p">${U.esc(it.p)}</div><div class="s">${it.series[0].y}년 ${U.won(it.series[0].v, true)} → ${it.series[it.series.length - 1].y}년 ${U.won(it.series[it.series.length - 1].v, true)}</div></div>
       <div class="a num sec" style="color:${it.change >= 0 ? 'var(--coral)' : 'var(--jade)'}">${it.change >= 0 ? '+' : ''}${(it.change * 100).toFixed(0)}%</div></div>`).join('');
  }

  /* 선택 카테고리 상세: 월 추이 + 대표 지출처 */
  function renderCatDetail(root, mks) {
    if (!selCat) return;
    const col = CFG.colors[selCat] || '#6B7280';
    root.querySelector('#sp-cat-title').innerHTML =
      `<i class="fa-solid ${CFG.icons[selCat] || 'fa-receipt'}" style="color:${col};margin-right:6px"></i>${U.esc(selCat)} — 월별 추이 (전체 기간)`;
    const all = S.months;
    const vals = all.map(mk => S.byMonth.get(mk).byCat.get(selCat) || 0);
    const o = CH.baseOpts();
    o.plugins.tooltip.callbacks = { label: c => ` ${U.won(c.parsed.y, true)}` };
    o.scales.x.ticks.maxTicksLimit = 6;
    CH.make('sp-cat-chart', { type: 'line', data: { labels: all.map(x => x.slice(2).replace('-', '.')),
      datasets: [{ data: vals, borderColor: col, backgroundColor: col + '18', fill: true, tension: .3, pointRadius: 0, borderWidth: 2 }] },
      options: o });

    const places = new Map();
    for (const mk of mks) for (const t of S.byMonth.get(mk).txs)
      if (t.ty === 'e' && t.sc === selCat && t.p) places.set(t.p, (places.get(t.p) || 0) + t.a);
    const top = [...places.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    root.querySelector('#sp-cat-places').innerHTML = top.map(([p, v]) =>
      `<div class="row"><div class="t"><div class="p" style="font-size:13px">${U.esc(p)}</div></div>
       <div class="a exp num sec" style="font-size:13px">${U.won(v)}</div></div>`).join('');
  }

  return { render };
})();
