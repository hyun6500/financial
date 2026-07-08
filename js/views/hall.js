/* ============================================================
 * views/hall.js — 기록실
 *  기록 스트릭 · 명예의 전당 · TOP10 · 단골 랭킹
 *  · 효도 대시보드 · 숨은 절약 리포트
 *  · 🔒 프라이빗(소개팅 리포트 + 함께한 소비) — 기본 잠금, 클릭 시 열람
 * ============================================================ */
window.VIEW_HALL = (() => {
  const S = window.STORE;
  let unlocked = false;

  /* 완결월 중 저축률 최고 (월급이 찍힌 달만) */
  function bestSavingMonth() {
    let best = null;
    for (const mk of S.months) {
      if (S.isPartial && mk === S.lastMonth) continue;
      const m = S.byMonth.get(mk);
      if (m.inc < 1000000) continue;
      const r = (m.inc - m.exp) / m.inc;
      if (!best || r > best.r) best = { mk, r };
    }
    return best;
  }

  /* 특이사항에서 절약액 추출: '2379 할인', '캐시백 4,500원', '서울사랑 216,570' */
  function parsedSavings() {
    let sum = 0, n = 0;
    for (const t of S.tx) {
      if (!t.n || !CFG.savingRe.test(t.n)) continue;
      n++;
      const m = t.n.match(/([\d,]{3,})\s*원?/);
      if (m) { const v = +m[1].replace(/,/g, ''); if (v >= 100 && v <= 500000) sum += v; }
    }
    return { sum, n };
  }

  function render(root) {
    const maxDay = [...S.byDay.entries()].sort((a, b) => b[1] - a[1])[0];
    const topExp = S.tx.filter(t => t.ty === 'e').sort((a, b) => b.a - a.a).slice(0, 10);
    const topInc = S.tx.filter(t => t.ty === 'i' && t.c !== '월급').sort((a, b) => b.a - a.a).slice(0, 10);
    const bestInc = [...S.byMonth.entries()].sort((a, b) => b[1].inc - a[1].inc)[0];
    const bestSave = bestSavingMonth();
    const places = new Map();
    for (const t of S.tx) if (t.ty === 'e' && t.p) {
      if (!places.has(t.p)) places.set(t.p, { n: 0, sum: 0, cat: t.sc });
      const e = places.get(t.p); e.n++; e.sum += t.a;
    }
    const regulars = [...places.entries()].filter(([p]) => !/지하철|생활비|여행계/.test(p))
      .sort((a, b) => b[1].n - a[1].n).slice(0, 8);
    const P = S.D.parents;
    const pSum = P.reduce((s, x) => s + (x.a || 0), 0);
    const pByYear = new Map();
    for (const x of P) if (x.a) { const y = x.d.slice(0, 4); pByYear.set(y, (pByYear.get(y) || 0) + x.a); }
    const pYears = [...pByYear.keys()].sort();
    const sav = parsedSavings();
    const cb = S.D.cashback.slice().sort((a, b) => a.y - b.y);
    const cbSum = cb.reduce((s, x) => s + x.a, 0);

    root.innerHTML = `
      <div class="hero">
        <div class="eyebrow"><i class="fa-solid fa-trophy" style="color:var(--gold)"></i><b>9년의 기록</b></div>
        <div class="hero-main"><div class="big num">${U.comma(S.totalDays)}<small>일째</small></div></div>
        <div class="kpis">
          <div class="kpi"><div class="l">총 기록</div><div class="v num">${U.comma(S.tx.length)}건</div></div>
          <div class="kpi"><div class="l">다녀간 장소</div><div class="v num">${U.comma(places.size)}곳</div></div>
          <div class="kpi gold"><div class="l">누적 저축</div><div class="v num sec">${U.won(S.tx.filter(t=>t.ty==='i').reduce((s,t)=>s+t.a,0) - S.tx.filter(t=>t.ty==='e').reduce((s,t)=>s+t.a,0))}</div></div>
        </div>
      </div>

      <div class="card" style="animation-delay:.05s">
        <h3><i class="fa-solid fa-crown"></i>명예의 전당</h3>
        <div class="stat-grid sec">
          <div class="stat"><div class="l">최다 소비일</div><div class="v num">${U.won(maxDay[1])}</div><div class="s">${maxDay[0].replace(/-/g, '.')}</div></div>
          <div class="stat"><div class="l">최대 단건 지출</div><div class="v num">${U.won(topExp[0].a)}</div><div class="s">${U.esc(topExp[0].p || '')} · ${topExp[0].d.slice(0, 7)}</div></div>
          <div class="stat"><div class="l">최고 수입 달</div><div class="v num">${U.won(bestInc[1].inc)}</div><div class="s">${U.mLabel(bestInc[0])}</div></div>
          <div class="stat"><div class="l">최고 저축률 달</div><div class="v num">${bestSave ? U.pct(bestSave.r, 1) : '-'}</div><div class="s">${bestSave ? U.mLabel(bestSave.mk) : ''}</div></div>
        </div>
      </div>

      <div class="grid g2">
        <div class="card" style="animation-delay:.1s">
          <h3><i class="fa-solid fa-fire-flame-curved"></i>소비 TOP 10</h3>
          <div class="rows">${topExp.map((t, i) => rankRow(i, t.p || t.dt, `${t.d.slice(0, 7)} · ${U.esc(t.sc)}`, U.won(t.a, true), 'exp')).join('')}</div>
        </div>
        <div class="card" style="animation-delay:.14s">
          <h3><i class="fa-solid fa-gem"></i>수입 TOP 10 <span class="more">월급 제외</span></h3>
          <div class="rows">${topInc.map((t, i) => rankRow(i, t.p || t.dt, `${t.d.slice(0, 7)} · ${U.esc(t.c)}`, '+' + U.won(t.a, true), 'inc')).join('')}</div>
        </div>
      </div>

      <div class="card" style="animation-delay:.18s">
        <h3><i class="fa-solid fa-store"></i>단골 랭킹 <span class="more">방문 횟수 기준</span></h3>
        <div class="rows">${regulars.map(([p, e], i) => {
          const col = CFG.colors[e.cat] || '#6B7280';
          return `<div class="row"><div class="ic" style="background:${col}22;color:${col}"><i class="fa-solid ${CFG.icons[e.cat] || 'fa-store'}"></i></div>
            <div class="t"><div class="p">${i + 1}. ${U.esc(p)}</div><div class="s">${e.n}회 방문</div></div>
            <div class="a num sec">${U.won(e.sum)}</div></div>`; }).join('')}</div>
      </div>

      <div class="grid g2">
        <div class="card" style="animation-delay:.22s">
          <h3><i class="fa-solid fa-heart"></i>효도 대시보드 <span class="more">2017~ · 누적 <b class="sec">${U.won(pSum)}</b></span></h3>
          <div class="chart-box" style="height:160px"><canvas id="hl-parents"></canvas></div>
          <div class="tl-strip" style="margin-top:12px">${P.slice(-6).reverse().map(x =>
            `<div class="tl-card"><div class="d">${x.d.replace(/-/g, '.')}</div>
             <div class="t num sec">${U.won(x.a)}</div><div class="s">${U.esc(x.memo || '용돈')}</div></div>`).join('')}</div>
        </div>
        <div class="card" style="animation-delay:.26s">
          <h3><i class="fa-solid fa-leaf"></i>숨은 절약 리포트</h3>
          <div class="stat-grid sec" style="grid-template-columns:1fr 1fr">
            <div class="stat"><div class="l">가계부 속 절약 기록</div><div class="v num">${U.comma(sav.n)}건</div><div class="s">할인·캐시백·포인트 메모</div></div>
            <div class="stat"><div class="l">기록된 절약액(추정)</div><div class="v num" style="color:var(--jade)">${U.won(sav.sum)}</div><div class="s">메모의 금액 파싱</div></div>
          </div>
          <div class="chart-box" style="height:140px;margin-top:12px"><canvas id="hl-cb"></canvas></div>
          <p class="footnote">막대는 카드 캐시백 이벤트 실적(자산 시트) · 누적 ${U.won(cbSum)}</p>
        </div>
      </div>

      <div class="card lock-card" style="animation-delay:.3s" id="hl-private">
        ${unlocked ? '' : `
          <i class="fa-solid fa-lock"></i>
          <p><b>관계 데이터</b> — 소개팅 리포트와 함께한 소비 분석이 담겨 있어요.<br>기본으로 잠겨 있고, 원할 때만 열람할 수 있습니다.</p>
          <button class="btn" id="hl-unlock"><i class="fa-solid fa-unlock"></i> 열어보기</button>`}
      </div>`;

    /* 효도 연도별 */
    const oP = CH.baseOpts();
    oP.plugins.tooltip.callbacks = { label: c => ` ${U.won(c.parsed.y, true)}` };
    CH.make('hl-parents', { type: 'bar', data: { labels: pYears,
      datasets: [{ data: pYears.map(y => pByYear.get(y)), backgroundColor: 'rgba(230,201,127,.7)', borderRadius: 6, maxBarThickness: 26 }] },
      options: oP });

    /* 카드 캐시백 */
    const oC = CH.baseOpts();
    oC.plugins.tooltip.callbacks = { label: c => ` ${U.won(c.parsed.y, true)}` };
    CH.make('hl-cb', { type: 'bar', data: { labels: cb.map(x => x.y),
      datasets: [{ data: cb.map(x => x.a), backgroundColor: 'rgba(87,214,169,.65)', borderRadius: 6, maxBarThickness: 26 }] },
      options: oC });

    const ub = root.querySelector('#hl-unlock');
    if (ub) ub.onclick = () => { unlocked = true; render(root); };
    if (unlocked) renderPrivate(root.querySelector('#hl-private'));
  }

  const rankRow = (i, name, sub, amt, cls) =>
    `<div class="row"><div class="ic" style="background:var(--glass2);color:${i < 3 ? 'var(--gold)' : 'var(--mut2)'};font-family:var(--num);font-weight:700;font-size:13px">${i + 1}</div>
     <div class="t"><div class="p">${U.esc(name || '-')}</div><div class="s">${sub}</div></div>
     <div class="a ${cls} num sec">${amt}</div></div>`;

  /* ============ 🔒 프라이빗 섹션 ============ */
  function renderPrivate(box) {
    const D = S.D.dating, E = D.entries;
    const totalSpend = E.reduce((s, e) => s + e.a, 0);
    const byYear = new Map(), byCh = new Map();
    for (const e of E) {
      const y = e.d.slice(0, 4);
      if (!byYear.has(y)) byYear.set(y, { n: 0, sum: 0 });
      byYear.get(y).n++; byYear.get(y).sum += e.a;
      if (e.ch) byCh.set(e.ch, (byCh.get(e.ch) || 0) + 1);
    }
    const dYears = [...byYear.keys()].sort();
    const chTop = [...byCh.entries()].sort((a, b) => b[1] - a[1]);

    /* 함께한 소비: w./특이사항에서 동행 추정 (휴리스틱) */
    const STOP = /^(고정비|Event|\?+|소개|정기|할인|캐시백|페이백|포인트|환급|만기|지원)/;
    const comp = new Map();
    let withSum = 0, totalExp = 0;
    for (const t of S.tx) {
      if (t.ty !== 'e') continue;
      totalExp += t.a;
      const cand = [];
      if (t.w && !STOP.test(t.w) && !/\d/.test(t.w) && t.w.length <= 8) cand.push(t.w);
      if (t.n && !CFG.savingRe.test(t.n) && /^[가-힣]{2,4}(이|씨|님|형|샘|언니|누나)?$/.test(t.n)) cand.push(t.n);
      if (!cand.length) continue;
      withSum += t.a;
      const k = cand[0];
      if (!comp.has(k)) comp.set(k, { n: 0, sum: 0 });
      comp.get(k).n++; comp.get(k).sum += t.a;
    }
    const compTop = [...comp.entries()].sort((a, b) => b[1].sum - a[1].sum).slice(0, 8);

    box.classList.remove('lock-card');
    box.innerHTML = `
      <h3><i class="fa-solid fa-heart-pulse"></i>소개팅 리포트 <span class="more">${U.comma(E.length)}회 기록</span>
        <button class="pill" id="hl-lock" style="cursor:pointer;margin-left:8px"><i class="fa-solid fa-lock" style="font-size:9px"></i> 잠그기</button></h3>
      <div class="stat-grid sec">
        <div class="stat"><div class="l">누적 지출</div><div class="v num">${U.won(D.stats && D.stats.total || totalSpend)}</div><div class="s">식사 ${U.won(D.stats && D.stats.meal)}</div></div>
        <div class="stat"><div class="l">회당 평균</div><div class="v num">${U.won(totalSpend / E.length)}</div></div>
        <div class="stat"><div class="l">호감 상대 등장률</div><div class="v num">${D.stats ? U.pct(D.stats.likeRate, 1) : '-'}</div></div>
        <div class="stat"><div class="l">연애 전환율</div><div class="v num">${D.stats ? U.pct(D.stats.loveRate, 1) : '-'}</div></div>
      </div>
      <div class="grid g2" style="margin-top:14px">
        <div>
          <div style="font-size:12px;color:var(--mut);margin-bottom:8px">연도별 만남 · 지출</div>
          <div class="chart-box" style="height:160px"><canvas id="hl-dating"></canvas></div>
        </div>
        <div>
          <div style="font-size:12px;color:var(--mut);margin-bottom:8px">경로 분포</div>
          <div class="rows">${chTop.slice(0, 5).map(([c, n]) =>
            `<div class="row"><div class="t"><div class="p" style="font-size:13px">${U.esc(c)}</div></div>
             <div class="a num" style="font-size:13px">${n}회</div></div>`).join('')}</div>
        </div>
      </div>
      <div style="margin-top:16px;font-size:12px;color:var(--mut)">최근 만남</div>
      <div class="tl-strip" style="margin-top:8px">${E.slice(0, 8).map(e =>
        `<div class="tl-card"><div class="d">${e.d.replace(/-/g, '.')} · ${U.esc(e.ch || '')}</div>
         <div class="t">${U.esc(e.name)}</div><div class="s">${U.esc(e.job || '')} · ${e.meets}회 · <span class="sec">${U.won(e.a, true)}</span></div></div>`).join('')}</div>

      <h3 style="margin-top:26px"><i class="fa-solid fa-user-group"></i>함께한 소비 <span class="more">w.·메모 기반 추정</span></h3>
      <p class="footnote" style="margin:0 0 12px">전체 지출의 <b class="sec">${U.pct(withSum / totalExp, 1)}</b>가 동행 기록이 있는 소비예요.</p>
      <div class="rows">${compTop.map(([k, e]) =>
        `<div class="row"><div class="ic" style="background:rgba(228,139,192,.12);color:#E48BC0"><i class="fa-solid fa-user"></i></div>
         <div class="t"><div class="p">${U.esc(k)}</div><div class="s">${e.n}회 함께</div></div>
         <div class="a num sec">${U.won(e.sum)}</div></div>`).join('')}
      </div>
      <p class="footnote">이름 표기는 파서의 ANONYMIZE 설정을 따르며, 메모 기반 추정이라 실제와 다를 수 있어요. 인연 히스토리 전체는 스프레드시트 원본을 참고하세요.</p>`;

    const oD = CH.baseOpts();
    oD.scales.y1 = { position: 'right', grid: { display: false }, border: { display: false },
      ticks: { color: CH.css('--mut'), font: { size: 10 } } };
    oD.plugins.tooltip.callbacks = { label: c => c.dataset.yAxisID === 'y1' ? ` ${c.parsed.y}회` : ` ${U.won(c.parsed.y, true)}` };
    CH.make('hl-dating', { type: 'bar', data: { labels: dYears,
      datasets: [
        { data: dYears.map(y => byYear.get(y).sum), backgroundColor: 'rgba(228,139,192,.6)', borderRadius: 6, maxBarThickness: 24 },
        { type: 'line', data: dYears.map(y => byYear.get(y).n), yAxisID: 'y1', borderColor: CH.css('--gold'),
          pointBackgroundColor: CH.css('--gold'), borderWidth: 2, tension: .3 },
      ] }, options: oD });

    box.querySelector('#hl-lock').onclick = () => { unlocked = false; render(box.closest('#main') || box.parentElement); };
  }

  return { render };
})();
