/* ============================================================
 * charts.js — Chart.js 공통 테마 + 커스텀 히트맵
 * ============================================================ */
window.CH = (() => {
  const css = v => getComputedStyle(document.body).getPropertyValue(v).trim();

  function baseOpts() {
    const mut = css('--mut'), line = css('--line');
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(13,16,24,.92)', borderColor: line, borderWidth: 1,
          titleFont: { family: 'Pretendard' }, bodyFont: { family: 'Pretendard' },
          padding: 10, cornerRadius: 10, displayColors: false,
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: mut, font: { size: 10 } }, border: { display: false } },
        y: { grid: { color: line }, border: { display: false },
             ticks: { color: mut, font: { size: 10 }, callback: v => U.won(v) } },
      },
    };
  }

  const charts = {};
  function make(id, cfg) {
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(document.getElementById(id), cfg);
    return charts[id];
  }

  /* ---- 지출 히트맵 (GitHub 잔디 스타일, 최근 N일) ---- */
  function heatmap(container, byDay, days = 365) {
    const end = new Date(STORE.D.meta.to);
    const start = new Date(end); start.setDate(start.getDate() - days + 1);
    start.setDate(start.getDate() - start.getDay()); // 주 시작(일요일) 정렬
    const vals = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const k = d.toISOString().slice(0, 10);
      vals.push({ k, v: byDay.get(k) || 0 });
    }
    const nz = vals.map(x => x.v).filter(v => v > 0).sort((a, b) => a - b);
    const q = p => nz.length ? nz[Math.floor(nz.length * p)] : 0;
    const t1 = q(.25), t2 = q(.5), t3 = q(.8);
    const shade = v => v === 0 ? '' :
      v <= t1 ? 'rgba(230,201,127,.22)' : v <= t2 ? 'rgba(230,201,127,.45)' :
      v <= t3 ? 'rgba(232,131,58,.7)' : 'var(--coral)';

    // 월 라벨
    const monthsRow = [];
    let lastM = -1;
    for (let i = 0; i < vals.length; i += 7) {
      const d = new Date(vals[i].k);
      if (d.getMonth() !== lastM) { monthsRow.push({ i: i / 7, label: (d.getMonth() + 1) + '월' }); lastM = d.getMonth(); }
    }
    const weeks = Math.ceil(vals.length / 7);
    let mHtml = '<div class="heat-months">';
    let cur = 0;
    for (const m of monthsRow) {
      mHtml += `<span style="width:${(m.i - cur) * 14}px"></span><span>${m.label}</span>`;
      cur = m.i + 1.6;
    }
    mHtml += '</div>';

    let html = mHtml + '<div class="heat">';
    for (const x of vals) {
      const bg = shade(x.v);
      html += `<div class="c" ${bg ? `style="background:${bg}"` : ''} title="${x.k} · ${x.v ? U.won(x.v, true) : '지출 없음'}"></div>`;
    }
    html += '</div>';
    html += `<div class="heat-legend">적음 <span class="c" style="background:var(--glass2)"></span><span class="c" style="background:rgba(230,201,127,.22)"></span><span class="c" style="background:rgba(230,201,127,.45)"></span><span class="c" style="background:rgba(232,131,58,.7)"></span><span class="c" style="background:var(--coral)"></span> 많음</div>`;
    container.innerHTML = `<div class="heat-scroll">${html.replace('<div class="heat-legend"', '</div><div class="heat-legend"')}`;
    // 최신 날짜가 보이도록 우측 스크롤
    const sc = container.querySelector('.heat-scroll');
    requestAnimationFrame(() => { sc.scrollLeft = sc.scrollWidth; });
  }

  return { baseOpts, make, heatmap, css };
})();
