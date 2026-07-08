/* ============================================================
 * insights.js — 규칙 기반 인사이트 엔진
 *  통계 신호를 감지해 사람이 말하듯 자연어 문장을 생성.
 *  각 규칙은 {score, emoji, html}를 반환하고 상위 N개만 노출.
 * ============================================================ */
window.INSIGHTS = (() => {
  const S = window.STORE;

  // 최근 12개월(현재 달 제외) 카테고리 평균
  function catAvg(cat, excludeMk) {
    const mks = S.months.filter(mk => mk !== excludeMk).slice(-12);
    let sum = 0, n = 0;
    for (const mk of mks) { sum += S.byMonth.get(mk).byCat.get(cat) || 0; n++; }
    return n ? sum / n : 0;
  }

  function build(mk) {
    const m = S.byMonth.get(mk);
    if (!m) return [];
    const out = [];
    const prevMk = U.prevMonth(mk);
    const prev = S.byMonth.get(prevMk);

    // ① 카테고리 급등/급락 감지 (평균 대비 ±40%, 금액 3만원 이상)
    //    진행 중인 달이면 경과일 비율로 평균을 보정해 비교
    const partial = S.isPartial && mk === S.lastMonth;
    let frac = 1;
    if (partial) {
      const [y, mo] = mk.split('-').map(Number);
      const daysInM = new Date(y, mo, 0).getDate();
      const lastDay = Math.max(...m.txs.map(t => +t.d.slice(8)));
      frac = Math.min(1, lastDay / daysInM);
    }
    for (const [cat, v] of m.byCat) {
      const avg = catAvg(cat, mk) * frac;
      if (avg < 20000 && v < 30000) continue;
      const diff = avg ? (v - avg) / avg : null;
      if (diff != null && Math.abs(diff) >= 0.4 && Math.max(v, avg) >= 30000) {
        if (partial && diff < 0) continue; // 진행 중인 달의 '아꼈다'는 성급한 판단이라 보류
        const topTx = m.txs.filter(t => t.ty === 'e' && t.sc === cat).sort((a, b) => b.a - a.a)[0];
        const cause = topTx && topTx.a > v * 0.4 ? ` ${U.esc(topTx.p)}(${U.won(topTx.a)}) 영향이 커요.` : '';
        out.push({
          score: Math.abs(diff) * Math.min(v, 500000) / 1000,
          emoji: diff > 0 ? '📈' : '📉',
          html: diff > 0
            ? (diff >= 3
              ? `이번 달 <b>${U.josa(U.esc(cat), '은', '는')}</b> 평소의 <b>${(diff + 1).toFixed(0)}배</b> 수준이에요.${cause}`
              : `이번 달 <b>${U.josa(U.esc(cat), '이', '가')}</b> 평소보다 <b>${Math.round(diff * 100)}%</b> 늘었어요.${cause}`)
            : `<b>${U.josa(U.esc(cat), '은', '는')}</b> 평소보다 <b>${Math.round(-diff * 100)}%</b> 아꼈어요. 좋은 흐름이에요.`,
        });
      }
    }

    // ② 3개월 연속 추세
    const mks3 = S.months.filter(x => x <= mk).slice(-4);
    if (mks3.length === 4) {
      const cats = new Set(m.byCat.keys());
      for (const cat of cats) {
        const seq = mks3.map(x => S.byMonth.get(x).byCat.get(cat) || 0);
        if (seq.every(v => v > 10000) && seq[1] > seq[2] && seq[2] > seq[3] && seq[0] > seq[1]) {
          out.push({ score: 40, emoji: '🪜', html: `<b>${U.josa(U.esc(cat), '이', '가')}</b> 3개월 연속 줄고 있어요.` });
          break;
        }
      }
    }

    // ③ 저축률 페이스 (연 단위)
    const y = mk.slice(0, 4);
    const Y = S.byYear.get(y);
    if (Y && Y.inc > 0) {
      const rate = (Y.inc - Y.exp) / Y.inc;
      const bestPrev = Math.max(...[...S.byYear.entries()].filter(([k, v]) => k < y && v.months >= 10).map(([, v]) => (v.inc - v.exp) / v.inc));
      if (rate > bestPrev) out.push({ score: 55, emoji: '🏆', html: `올해 저축률 <b>${U.pct(rate, 1)}</b> — 기록상 <b>역대 최고 페이스</b>예요.` });
      else out.push({ score: 20, emoji: '💰', html: `올해 누적 저축률은 <b>${U.pct(rate, 1)}</b>. 역대 최고는 ${U.pct(bestPrev, 1)}이에요.` });
    }

    // ④ 전월 대비 총지출
    if (prev && prev.exp > 0 && !S.isPartial) {
      const d = (m.exp - prev.exp) / prev.exp;
      if (Math.abs(d) >= 0.15)
        out.push({ score: 30, emoji: d > 0 ? '⚠️' : '✨', html: d > 0
          ? `총지출이 전월보다 <b>${Math.round(d * 100)}%</b> 늘었어요.`
          : `총지출을 전월보다 <b>${Math.round(-d * 100)}%</b> 줄였어요.` });
    }

    // ⑤ 숨은 절약 (특이사항 파싱)
    const savings = m.txs.filter(t => t.n && CFG.savingRe.test(t.n)).length;
    if (savings >= 3) out.push({ score: 18, emoji: '💚', html: `이번 달 <b>${savings}건</b>의 결제에서 할인·캐시백을 챙겼어요.` });

    out.sort((a, b) => b.score - a.score);
    return out.slice(0, 3);
  }

  return { build };
})();
