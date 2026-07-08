/* ============================================================
 * store.js — APP_DATA를 화면용 인덱스로 가공
 *  - 월별 수입/지출/저축 집계
 *  - 카테고리·그룹 집계
 *  - 순자산 시리즈: 실측 스냅샷(25.07~) + 이전 구간(수입-지출 누적) 재구성
 * ============================================================ */
window.buildStore = (() => function buildStore() {
  const D = window.APP_DATA;
  const tx = D.tx;

  /* ---- 월별 집계 ---- */
  const byMonth = new Map(); // mk → {inc, exp, byCat:Map, byGroup:Map, days:Map, txs:[]}
  for (const t of tx) {
    const mk = U.monthKey(t.d);
    if (!byMonth.has(mk)) byMonth.set(mk, { inc: 0, exp: 0, byCat: new Map(), byGroup: new Map(), days: new Map(), txs: [] });
    const m = byMonth.get(mk);
    m.txs.push(t);
    if (t.ty === 'i') m.inc += t.a;
    else {
      m.exp += t.a;
      m.byCat.set(t.sc, (m.byCat.get(t.sc) || 0) + t.a);
      m.byGroup.set(t.g, (m.byGroup.get(t.g) || 0) + t.a);
      m.days.set(t.d, (m.days.get(t.d) || 0) + t.a);
    }
  }
  const months = [...byMonth.keys()].sort();
  const lastMonth = months[months.length - 1];
  const isPartial = (() => { // 마지막 달이 진행 중인지 (기록 마지막 날짜 기준)
    const last = D.meta.to;
    const [y, m] = lastMonth.split('-').map(Number);
    const eom = new Date(y, m, 0).getDate();
    return +last.slice(8) < eom;
  })();

  /* ---- 일별 지출 (히트맵용) ---- */
  const byDay = new Map();
  for (const t of tx) if (t.ty === 'e') byDay.set(t.d, (byDay.get(t.d) || 0) + t.a);

  /* ---- 연도별 집계 ---- */
  const byYear = new Map();
  for (const [mk, m] of byMonth) {
    const y = mk.slice(0, 4);
    if (!byYear.has(y)) byYear.set(y, { inc: 0, exp: 0, months: 0 });
    const Y = byYear.get(y);
    Y.inc += m.inc; Y.exp += m.exp; Y.months++;
  }

  /* ---- 순자산 시리즈 재구성 ----
   * 앵커: 실측 첫 스냅샷(2025-07-01, 3.356억)
   * 이전 구간: 앵커에서 (해당 월 이후 저축 누적)을 역산해 월말 추정치 생성
   * 이후 구간: 실측 스냅샷 그대로                                   */
  const hist = D.assets.history || [];
  const anchor = hist[0];
  let est = [];
  if (anchor) {
    const anchorMk = U.monthKey(anchor.d);
    let cum = 0;
    const rev = months.filter(mk => mk < anchorMk).reverse();
    // anchor 시점 값에서 월별 저축을 빼며 과거로
    let v = anchor.v;
    for (const mk of rev) {
      const m = byMonth.get(mk);
      est.push({ mk, v });          // mk 월말 ≈ 다음 흐름 반영 전 값
      v -= (m.inc - m.exp);
    }
    est.reverse();
  }
  const netWorth = {
    est,                                   // [{mk, v}] 재구성(월말 추정)
    real: hist.map(h => ({ d: h.d, v: h.v, pnl: h.pnl })), // 실측
  };

  /* ---- 기록 스트릭 ---- */
  const totalDays = U.daysBetween(D.meta.from, D.meta.to) + 1;

  return { D, tx, byMonth, months, lastMonth, isPartial, byDay, byYear, netWorth, totalDays };
})();
window.STORE = window.buildStore();
