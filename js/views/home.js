/* ============================================================
 * views/home.js — 홈 대시보드
 *  히어로(이번달 요약) · 순자산 · 히트맵 · 카테고리 도넛 · Top5
 *  · AI 인사이트 · 최근 12개월 추이
 * ============================================================ */
window.VIEW_HOME = (() => {
  const S = window.STORE;

  function render(root) {
    const mk = S.lastMonth;
    const m = S.byMonth.get(mk);
    const prev = S.byMonth.get(U.prevMonth(mk));
    const save = m.inc - m.exp;
    const rate = m.inc > 0 ? save / m.inc : null;
    const expDelta = prev && prev.exp ? (m.exp - prev.exp) / prev.exp : null;
    const nwReal = S.netWorth.real;
    const nwLast = nwReal[nwReal.length - 1];
    const nwPrev = nwReal[nwReal.length - 2];

    root.innerHTML = `
      <div class="hero">
        <div class="eyebrow"><i class="fa-solid fa-book-open" style="color:var(--gold)"></i>
          <b>${U.mLabel(mk)}</b>${S.isPartial ? ' · 진행 중' : ' 결산'}
          <span style="margin-left:auto">${U.comma(S.totalDays)}일째 기록 중</span></div>
        <div class="hero-main">
          <div class="big num sec">${U.won(m.exp, true)}<small>지출</small></div>
          ${expDelta != null ? `<span class="delta ${expDelta > 0.02 ? 'up' : expDelta < -0.02 ? 'down' : 'flat'}">
            <i class="fa-solid fa-arrow-${expDelta > 0 ? 'up' : 'down'}"></i>전월比 ${Math.abs(Math.round(expDelta * 100))}%</span>` : ''}
        </div>
        <div class="kpis">
          <div class="kpi jade"><div class="l">이번 달 수입</div><div class="v num sec">${U.won(m.inc)}</div></div>
          <div class="kpi gold"><div class="l">이번 달 저축</div><div class="v num sec">${U.won(save)}</div>
            <div class="s">저축률 ${rate != null ? U.pct(rate, 0) : '-'}</div></div>
          <div class="kpi"><div class="l">순자산</div><div class="v num sec">${U.won(nwLast.v)}</div>
            <div class="s">${nwPrev ? `직전 대비 ${nwLast.v >= nwPrev.v ? '+' : ''}${U.won(nwLast.v - nwPrev.v)}` : ''}</div></div>
        </div>
      </div>

      <div class="card" style="animation-delay:.08s">
        <h3><i class="fa-solid fa-fire"></i>소비 히트맵 <span class="more">최근 12개월 · 진할수록 큰 지출</span></h3>
        <div id="heat"></div>
      </div>

      <div class="card" style="animation-delay:.12s">
        <h3><i class="fa-solid fa-wand-magic-sparkles"></i>이번 달 인사이트</h3>
        <div id="ins"></div>
      </div>

      <div class="grid g2">
        <div class="card" style="animation-delay:.16s">
          <h3><i class="fa-solid fa-chart-pie"></i>카테고리별 소비 <span class="more">${U.mLabel(mk)}</span></h3>
          <div class="donut-grid">
            <div class="chart-box" style="height:190px"><canvas id="donut"></canvas></div>
            <div class="legend sec" id="donut-legend"></div>
          </div>
        </div>
        <div class="card" style="animation-delay:.2s">
          <h3><i class="fa-solid fa-ranking-star"></i>이번 달 Top 5 지출</h3>
          <div class="rows" id="top5"></div>
        </div>
      </div>

      <div class="card" style="animation-delay:.24s">
        <h3><i class="fa-solid fa-chart-line"></i>월별 수입·지출 <span class="more">최근 12개월</span></h3>
        <div class="chart-box"><canvas id="trend"></canvas></div>
        <p class="footnote">순자산 곡선은 <b>자산</b> 탭, 9년 전체 추이는 <b>소비분석</b> 탭에서 · 우측 하단 📸 버튼으로 월간 리포트 카드를 만들 수 있어요</p>
      </div>`;

    /* 히트맵 */
    CH.heatmap(root.querySelector('#heat'), S.byDay, 365);

    /* 인사이트 */
    const ins = INSIGHTS.build(mk);
    root.querySelector('#ins').innerHTML = ins.length
      ? ins.map(i => `<div class="insight"><span class="em">${i.emoji}</span><p>${i.html}</p></div>`).join('')
      : '<p class="footnote">이번 달은 아직 특이 신호가 없어요.</p>';

    /* 도넛 */
    const cats = [...m.byCat.entries()].sort((a, b) => b[1] - a[1]);
    const top = cats.slice(0, 7);
    const rest = cats.slice(7).reduce((s, [, v]) => s + v, 0);
    const labels = top.map(c => c[0]).concat(rest ? ['그 외'] : []);
    const vals = top.map(c => c[1]).concat(rest ? [rest] : []);
    const colors = labels.map(l => CFG.colors[l] || '#6B7280');
    CH.make('donut', {
      type: 'doughnut',
      data: { labels, datasets: [{ data: vals, backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '68%',
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${U.won(c.parsed, true)}` } } } },
    });
    root.querySelector('#donut-legend').innerHTML = labels.map((l, i) =>
      `<div class="li"><span class="dot" style="background:${colors[i]}"></span>
        <span class="nm">${U.esc(l)}</span><span class="val num">${U.won(vals[i])}</span></div>`).join('');

    /* Top5 */
    const top5 = m.txs.filter(t => t.ty === 'e').sort((a, b) => b.a - a.a).slice(0, 5);
    root.querySelector('#top5').innerHTML = top5.map(t => {
      const col = CFG.colors[t.sc] || '#6B7280';
      return `<div class="row">
        <div class="ic" style="background:${col}22;color:${col}"><i class="fa-solid ${CFG.icons[t.sc] || 'fa-receipt'}"></i></div>
        <div class="t"><div class="p">${U.esc(t.p || t.dt || '-')}</div>
          <div class="s">${t.d.slice(5).replace('-', '/')} · ${U.esc(t.sc)}${t.n ? ' · ' + U.esc(t.n) : ''}</div></div>
        <div class="a exp num sec">${U.won(t.a, true)}</div></div>`;
    }).join('');

    /* 12개월 추이 */
    const mks = S.months.slice(-12);
    const o = CH.baseOpts();
    o.plugins.tooltip.callbacks = { label: c => ` ${c.dataset.label}: ${U.won(c.parsed.y, true)}` };
    o.interaction = { mode: 'index', intersect: false };
    CH.make('trend', {
      type: 'bar',
      data: {
        labels: mks.map(x => x.slice(2).replace('-', '.')),
        datasets: [
          { label: '지출', data: mks.map(x => S.byMonth.get(x).exp), backgroundColor: 'rgba(248,123,107,.7)', borderRadius: 6, maxBarThickness: 22 },
          { label: '수입', data: mks.map(x => S.byMonth.get(x).inc), backgroundColor: 'rgba(87,214,169,.55)', borderRadius: 6, maxBarThickness: 22 },
        ],
      },
      options: o,
    });
  }

  return { render };
})();
