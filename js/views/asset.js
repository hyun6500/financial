/* ============================================================
 * views/asset.js — 자산 (세그먼트 3분할)
 *  ① 현황: 순자산 곡선(재구성+실측) · 자산 구성 · 예적금 만기
 *  ② 투자: 계좌 수익률 · 보유 종목 · 투자 성적표 · VC · 코인
 *  ③ 수입원: 커리어 연봉 곡선 · 사이드잡 · 멘토링 월별
 * ============================================================ */
window.VIEW_ASSET = (() => {
  const S = window.STORE;
  const A = S.D.assets, INV = S.D.invest;
  let seg = 'now';       // now | invest | income
  let nwMode = 'v';      // v(원금) | pnl(손익 반영)

  function render(root) {
    root.innerHTML = `
      <div class="seg" id="as-seg">
        <button data-s="now" class="${seg === 'now' ? 'on' : ''}">자산 현황</button>
        <button data-s="invest" class="${seg === 'invest' ? 'on' : ''}">투자</button>
        <button data-s="income" class="${seg === 'income' ? 'on' : ''}">수입원</button>
      </div>
      <div id="as-body" style="margin-top:14px"></div>`;
    root.querySelector('#as-seg').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      seg = b.dataset.s; render(root);
    });
    const body = root.querySelector('#as-body');
    if (seg === 'now') renderNow(body);
    else if (seg === 'invest') renderInvest(body);
    else renderIncome(body);
  }

  /* ============ ① 자산 현황 ============ */
  function renderNow(root) {
    const last = A.history[A.history.length - 1];
    const first = A.history[0];
    const estFirst = S.netWorth.est[0];
    const growYr = last && estFirst ? (last.v - estFirst.v) : null;

    root.innerHTML = `
      <div class="hero" style="animation-delay:0s">
        <div class="eyebrow"><i class="fa-solid fa-vault" style="color:var(--gold)"></i>
          <b>순자산</b><span style="margin-left:auto">기준 ${last.d}</span></div>
        <div class="hero-main">
          <div class="big num sec">${U.won(nwMode === 'v' ? last.v : last.pnl, true)}</div>
          <div class="mini-toggle" id="as-nwmode">
            <button data-m="v" class="${nwMode === 'v' ? 'on' : ''}">원금</button>
            <button data-m="pnl" class="${nwMode === 'pnl' ? 'on' : ''}">손익 반영</button>
          </div>
        </div>
        <div class="kpis">
          <div class="kpi gold"><div class="l">2018.04 이후 증가</div>
            <div class="v num sec">+${U.won(growYr)}</div>
            <div class="s">약 ${(last.v / estFirst.v).toFixed(1)}배</div></div>
          <div class="kpi jade"><div class="l">최근 1년 증가</div>
            <div class="v num sec">+${U.won(last.v - first.v)}</div>
            <div class="s">${first.d.slice(0, 7)} 대비</div></div>
          <div class="kpi"><div class="l">평가 손익</div>
            <div class="v num sec" style="color:${last.pnl >= last.v ? 'var(--jade)' : 'var(--coral)'}">${U.won(last.pnl - last.v)}</div>
            <div class="s">투자 반영 시</div></div>
        </div>
      </div>

      <div class="card" style="animation-delay:.06s">
        <h3><i class="fa-solid fa-chart-area"></i>순자산 곡선
          <span class="more">점선 = 저축 누적 재구성 · 실선 = 실측(25.07~)</span></h3>
        <div class="chart-box tall"><canvas id="as-nw"></canvas></div>
        <p class="footnote">2025년 6월 이전은 자산 스냅샷이 없어 <b>월 수입−지출 누적</b>으로 재구성한 추정치예요 (투자 수익률 미반영).</p>
      </div>

      <div class="grid g2">
        <div class="card" style="animation-delay:.12s">
          <h3><i class="fa-solid fa-chart-pie"></i>자산 구성</h3>
          <div class="donut-grid">
            <div class="chart-box" style="height:180px"><canvas id="as-mix"></canvas></div>
            <div class="legend sec" id="as-mix-legend"></div>
          </div>
        </div>
        <div class="card" style="animation-delay:.16s">
          <h3><i class="fa-solid fa-hourglass-half"></i>예적금 만기 타임라인</h3>
          <div class="rows" id="as-dep"></div>
        </div>
      </div>`;

    root.querySelector('#as-nwmode').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      nwMode = b.dataset.m; renderNow(root);
    });

    /* 순자산 곡선: est(점선) + real(실선) */
    const estMks = S.netWorth.est.map(p => p.mk);
    const realByMk = new Map();
    for (const p of A.history) realByMk.set(p.d.slice(0, 7), p);
    const allMks = [...estMks, ...[...realByMk.keys()].filter(mk => !estMks.includes(mk)).sort()];
    const estData = allMks.map(mk => { const p = S.netWorth.est.find(x => x.mk === mk); return p ? p.v : null; });
    const realData = allMks.map(mk => { const p = realByMk.get(mk); return p ? (nwMode === 'v' ? p.v : p.pnl) : null; });
    // 두 구간 이음새: est 마지막 지점을 real 시작에 연결
    const lastEstIdx = estData.length - 1 - [...estData].reverse().findIndex(v => v != null);
    const firstRealIdx = realData.findIndex(v => v != null);
    if (lastEstIdx >= 0 && firstRealIdx > lastEstIdx) realData[lastEstIdx] = estData[lastEstIdx];

    const o = CH.baseOpts();
    o.interaction = { mode: 'index', intersect: false };
    o.plugins.tooltip.callbacks = { label: c => c.parsed.y == null ? null : ` ${c.dataset.label}: ${U.won(c.parsed.y, true)}` };
    o.scales.x.ticks.maxTicksLimit = 9;
    CH.make('as-nw', { type: 'line', data: { labels: allMks.map(x => x.slice(2).replace('-', '.')),
      datasets: [
        { label: '재구성(추정)', data: estData, borderColor: 'rgba(230,201,127,.55)', borderDash: [5, 5],
          pointRadius: 0, borderWidth: 1.8, spanGaps: true },
        { label: nwMode === 'v' ? '실측' : '실측(손익 반영)', data: realData, borderColor: CH.css('--gold'),
          backgroundColor: 'rgba(230,201,127,.08)', fill: true, tension: .25,
          pointRadius: 3, pointBackgroundColor: CH.css('--gold'), borderWidth: 2.4, spanGaps: true },
      ] }, options: o });

    /* 자산 구성 도넛 */
    const bks = A.buckets.filter(b => b.v > 0);
    const cols = ['#7FB4F2', '#57D6A9', '#E6C97F', '#A78BFA'];
    CH.make('as-mix', { type: 'doughnut', data: { labels: bks.map(b => b.k),
      datasets: [{ data: bks.map(b => b.v), backgroundColor: cols, borderWidth: 0, hoverOffset: 6 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '68%',
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${U.won(c.parsed, true)}` } } } } });
    const totalB = bks.reduce((s, b) => s + b.v, 0);
    document.getElementById('as-mix-legend').innerHTML = bks.map((b, i) =>
      `<div class="li"><span class="dot" style="background:${cols[i]}"></span><span class="nm">${U.esc(b.k)}</span>
       <span class="val num">${U.won(b.v)} <span class="pill">${(b.v / totalB * 100).toFixed(0)}%</span></span></div>`).join('');

    /* 예적금 만기 */
    document.getElementById('as-dep').innerHTML = A.deposits.map(d =>
      `<div class="row"><div class="ic" style="background:rgba(87,214,169,.12);color:var(--jade)"><i class="fa-solid fa-piggy-bank"></i></div>
       <div class="t"><div class="p">${U.esc(d.k)}</div><div class="s">${U.esc(d.memo || '')}${d.rate ? ` · 연 ${(d.rate * 100).toFixed(1)}%` : ''}</div></div>
       <div class="a num sec">${U.won(d.v)}</div></div>`).join('') || '<p class="footnote">데이터 없음</p>';
  }

  /* ============ ② 투자 ============ */
  function renderInvest(root) {
    const R = INV.realized;
    const wins = R.filter(r => r.pnl > 0).length;
    const sumPnl = R.reduce((s, r) => s + r.pnl, 0);
    const sumDiv = R.reduce((s, r) => s + (r.div || 0), 0);
    const best = R.slice().sort((a, b) => (b.ret || 0) - (a.ret || 0))[0];
    const worst = R.slice().sort((a, b) => (a.ret || 0) - (b.ret || 0))[0];
    const holdDays = R.filter(r => r.buy && r.sell).map(r => U.daysBetween(r.buy, r.sell));
    const avgHold = holdDays.length ? Math.round(holdDays.reduce((a, b) => a + b, 0) / holdDays.length) : null;
    const byYearPnl = new Map();
    for (const r of R) if (r.sell) {
      const y = r.sell.slice(0, 4);
      byYearPnl.set(y, (byYearPnl.get(y) || 0) + r.pnl);
    }
    const pys = [...byYearPnl.keys()].sort();

    root.innerHTML = `
      <div class="card">
        <h3><i class="fa-solid fa-medal"></i>투자 성적표 <span class="more">실현 손익 기준 · ${R.length}건</span></h3>
        <div class="stat-grid sec">
          <div class="stat"><div class="l">승률</div><div class="v num">${(wins / R.length * 100).toFixed(0)}%</div><div class="s">${wins}승 ${R.length - wins}패</div></div>
          <div class="stat"><div class="l">누적 실현 손익</div><div class="v num" style="color:${sumPnl >= 0 ? 'var(--jade)' : 'var(--coral)'}">${sumPnl >= 0 ? '+' : ''}${U.won(sumPnl)}</div><div class="s">배당 ${U.won(sumDiv)} 포함</div></div>
          <div class="stat"><div class="l">최고의 거래</div><div class="v" style="font-size:14px">${U.esc(best.name)}</div><div class="s" style="color:var(--jade)">+${U.pct(best.ret, 0)}</div></div>
          <div class="stat"><div class="l">최악의 거래</div><div class="v" style="font-size:14px">${U.esc(worst.name)}</div><div class="s" style="color:var(--coral)">${U.pct(worst.ret, 0)}</div></div>
        </div>
        <div class="chart-box" style="height:170px;margin-top:16px"><canvas id="as-rpnl"></canvas></div>
        <p class="footnote">평균 보유 기간 ${avgHold ? U.comma(avgHold) + '일' : '-'} · 매도 연도 기준 실현 손익</p>
      </div>

      <div class="grid g2">
        <div class="card" style="animation-delay:.08s">
          <h3><i class="fa-solid fa-building-columns"></i>계좌별 수익률</h3>
          <div class="rows" id="as-acct"></div>
        </div>
        <div class="card" style="animation-delay:.12s">
          <h3><i class="fa-solid fa-seedling"></i>VC · 비상장</h3>
          <div class="rows" id="as-vc"></div>
        </div>
      </div>

      <div class="card" style="animation-delay:.16s">
        <h3><i class="fa-solid fa-list-check"></i>보유 종목 <span class="more">시트 추출 시점 평가액</span></h3>
        <div class="rows" id="as-hold"></div>
      </div>`;

    const o = CH.baseOpts();
    o.plugins.tooltip.callbacks = { label: c => ` ${c.parsed.y >= 0 ? '+' : ''}${U.won(c.parsed.y, true)}` };
    CH.make('as-rpnl', { type: 'bar', data: { labels: pys,
      datasets: [{ data: pys.map(y => byYearPnl.get(y)), borderRadius: 7, maxBarThickness: 32,
        backgroundColor: pys.map(y => byYearPnl.get(y) >= 0 ? 'rgba(87,214,169,.7)' : 'rgba(248,123,107,.7)') }] },
      options: o });

    document.getElementById('as-acct').innerHTML = A.securities.map(s =>
      `<div class="row"><div class="ic" style="background:rgba(127,180,242,.12);color:var(--sky)"><i class="fa-solid fa-landmark"></i></div>
       <div class="t"><div class="p">${U.esc(s.k)}</div><div class="s">평가 ${U.won(s.v + (s.pnl || 0))}</div></div>
       <div class="a num sec" style="color:${(s.ret || 0) >= 0 ? 'var(--jade)' : 'var(--coral)'}">${s.ret != null ? (s.ret >= 0 ? '+' : '') + U.pct(s.ret, 1) : '-'}</div></div>`).join('');

    document.getElementById('as-vc').innerHTML = INV.vc.map(v =>
      `<div class="row"><div class="ic" style="background:rgba(167,139,250,.12);color:#A78BFA"><i class="fa-solid fa-rocket"></i></div>
       <div class="t"><div class="p">${U.esc(v.name)}</div><div class="s">투자 ${U.won(v.invest)}</div></div>
       <div class="a num sec" style="color:${(v.ret || 0) >= 0 ? 'var(--jade)' : 'var(--coral)'}">${v.ret != null ? (v.ret >= 0 ? '+' : '') + U.pct(v.ret, 0) : '-'}</div></div>`).join('');

    const holds = INV.holdings.slice().sort((a, b) => b.v - a.v);
    const boryungHtml = INV.boryung ? `<div class="row">
      <div class="ic" style="background:rgba(230,201,127,.12);color:var(--gold)"><i class="fa-solid fa-star"></i></div>
      <div class="t"><div class="p">보령 (핵심 보유)</div><div class="s">누적 매수 ${U.won(INV.boryung.invest)} · 수익률 ${INV.boryung.ret >= 0 ? '+' : ''}${U.pct(INV.boryung.ret, 1)}</div></div>
      <div class="a num sec" style="color:var(--jade)">+${U.won(INV.boryung.pnl)}</div></div>` : '';
    document.getElementById('as-hold').innerHTML = boryungHtml + holds.map(h =>
      `<div class="row"><div class="ic" style="background:var(--glass2);color:var(--mut)"><span style="font-size:9px;font-weight:700">${U.esc((h.ticker || '').slice(0, 4))}</span></div>
       <div class="t"><div class="p">${U.esc(h.name)}</div><div class="s">${U.esc(h.ticker || '')}</div></div>
       <div class="a num sec">${U.won(h.v)}</div></div>`).join('');
  }

  /* ============ ③ 수입원 ============ */
  function renderIncome(root) {
    const sal = S.D.salary.filter(s => s.pay);
    const co = [...new Set(sal.map(s => s.co))];
    const coCol = { '교보문고': '#7FB4F2', '클래스101': '#F27BA0', '사람인': '#57D6A9', '팀블라인드': '#A78BFA', '중앙일보': '#E6C97F' };
    const firstPay = sal[0], lastPay = sal[sal.length - 1];

    /* 사이드잡: 연도 × 수입처 상위 그룹 */
    const sj = S.D.sidejobs;
    const sjYears = [...new Set(sj.map(x => x.y))].sort();
    const topSrc = [...sj.reduce((m, x) => m.set(x.src, (m.get(x.src) || 0) + x.total), new Map()).entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]);
    const sjTotal = sj.reduce((s, x) => s + x.total, 0);

    /* 멘토링 월별 (가계부 수입 로그) */
    const mento = S.tx.filter(t => t.ty === 'i' && t.p && t.p.includes('멘토링'));
    const mentoByMk = new Map();
    for (const t of mento) { const mk = U.monthKey(t.d); mentoByMk.set(mk, (mentoByMk.get(mk) || 0) + t.a); }
    const mMks = S.months.slice(-24);

    root.innerHTML = `
      <div class="card">
        <h3><i class="fa-solid fa-briefcase"></i>커리어 연봉 곡선
          <span class="more">${firstPay.d.slice(0, 4)} ${U.won(firstPay.pay)} → ${lastPay.d.slice(0, 4)} ${U.won(lastPay.pay)}</span></h3>
        <div class="chart-box tall"><canvas id="as-sal"></canvas></div>
        <div class="chips" style="margin-top:12px">${co.map(c =>
          `<span class="chip" style="cursor:default"><span class="dot" style="display:inline-block;width:8px;height:8px;border-radius:99px;background:${coCol[c] || '#888'};margin-right:6px"></span>${U.esc(c)}</span>`).join('')}</div>
        <p class="footnote sec">9년간 계약연봉 <b>${(lastPay.pay / firstPay.pay).toFixed(1)}배</b> · 이직 ${co.length - 1}회</p>
      </div>

      <div class="card" style="animation-delay:.08s">
        <h3><i class="fa-solid fa-hand-holding-dollar"></i>사이드 인컴 <span class="more">누적 ${U.won(sjTotal)}</span></h3>
        <div class="chart-box"><canvas id="as-sj"></canvas></div>
      </div>

      <div class="card" style="animation-delay:.14s">
        <h3><i class="fa-solid fa-chalkboard-user"></i>멘토링 수입 <span class="more">최근 24개월 · 가계부 건별 기록 기준</span></h3>
        <div class="chart-box" style="height:180px"><canvas id="as-mento"></canvas></div>
        <p class="footnote sec">전체 기간 ${U.comma(mento.length)}건 · 누적 ${U.won(mento.reduce((s, t) => s + t.a, 0))}</p>
      </div>`;

    /* 연봉 stepped 라인 */
    const o = CH.baseOpts();
    o.plugins.tooltip.callbacks = {
      title: items => sal[items[0].dataIndex].d,
      label: c => { const s = sal[c.dataIndex];
        return [` ${s.co} · ${U.won(s.pay, true)}`, s.why ? ` ${s.why}` : '', s.rate ? ` 상승률 ${(s.rate * 100).toFixed(1)}%` : ''].filter(Boolean); } };
    o.scales.x.ticks.maxTicksLimit = 8;
    CH.make('as-sal', { type: 'line', data: { labels: sal.map(s => s.d.slice(2, 7).replace('-', '.')),
      datasets: [{ data: sal.map(s => s.pay), stepped: true, borderColor: CH.css('--gold'),
        backgroundColor: 'rgba(230,201,127,.08)', fill: true, borderWidth: 2.2,
        pointRadius: 5, pointHoverRadius: 7,
        pointBackgroundColor: sal.map(s => coCol[s.co] || '#888') }] }, options: o });

    /* 사이드잡 스택 */
    const oS = CH.baseOpts();
    oS.scales.x.stacked = true; oS.scales.y.stacked = true;
    oS.plugins.legend = { display: true, position: 'bottom', labels: { color: CH.css('--mut'), font: { size: 10 }, boxWidth: 8, boxHeight: 8 } };
    oS.plugins.tooltip.callbacks = { label: c => ` ${c.dataset.label}: ${U.won(c.parsed.y, true)}` };
    const sjCols = ['#57D6A9', '#7FB4F2', '#A78BFA', '#6B7280'];
    const srcGroups = [...topSrc, '기타'];
    CH.make('as-sj', { type: 'bar', data: { labels: sjYears,
      datasets: srcGroups.map((src, i) => ({
        label: src, backgroundColor: sjCols[i], borderRadius: 5, maxBarThickness: 30,
        data: sjYears.map(y => sj.filter(x => x.y === y && (src === '기타' ? !topSrc.includes(x.src) : x.src === src))
          .reduce((s, x) => s + x.total, 0)) })) }, options: oS });

    /* 멘토링 */
    const oM = CH.baseOpts();
    oM.plugins.tooltip.callbacks = { label: c => ` ${U.won(c.parsed.y, true)}` };
    CH.make('as-mento', { type: 'bar', data: { labels: mMks.map(x => x.slice(2).replace('-', '.')),
      datasets: [{ data: mMks.map(mk => mentoByMk.get(mk) || 0), borderRadius: 5, maxBarThickness: 18,
        backgroundColor: 'rgba(87,214,169,.65)' }] }, options: oM });
  }

  return { render };
})();
