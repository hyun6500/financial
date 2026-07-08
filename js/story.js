/* ============================================================
 * story.js — 월간 리포트 스토리 카드 (FAB → 모달 → 이미지 저장)
 *  html2canvas로 9:16 카드를 PNG로 저장
 * ============================================================ */
window.STORY = (() => {
  const S = window.STORE;

  function targetMonth() {
    // 마지막 완결월 기준 (진행 중인 달은 전월)
    return S.isPartial ? U.prevMonth(S.lastMonth) : S.lastMonth;
  }

  function open(mk = targetMonth()) {
    const m = S.byMonth.get(mk);
    if (!m) return;
    const save = m.inc - m.exp;
    const rate = m.inc > 0 ? save / m.inc : null;
    const cats = [...m.byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const top = m.txs.filter(t => t.ty === 'e').sort((a, b) => b.a - a.a)[0];
    const ins = INSIGHTS.build(mk)[0];
    const idx = S.months.indexOf(mk);

    const modal = U.el(`<div class="modal">
      <div class="modal-inner">
        <div class="story" id="story-card">
          <div class="st-brand">JH 장부 · MONTHLY</div>
          <div class="st-month">${U.mLabel(mk)} 결산</div>
          <div class="st-big"><small>이번 달 지출</small>${U.won(m.exp, true)}</div>
          <div class="st-grid">
            <div class="st-cell"><div class="l">수입</div><div class="v">${U.won(m.inc)}</div></div>
            <div class="st-cell"><div class="l">저축</div><div class="v" style="color:#57D6A9">${U.won(save)}</div></div>
            <div class="st-cell"><div class="l">저축률</div><div class="v" style="color:#E6C97F">${rate != null ? U.pct(rate, 0) : '-'}</div></div>
            <div class="st-cell"><div class="l">최대 지출</div><div class="v" style="font-size:12px">${U.esc(top ? top.p : '-')}</div></div>
          </div>
          <div class="st-cats">${cats.map(([c, v]) =>
            `<span class="st-cat" style="color:${CFG.colors[c] || '#aaa'};border-color:${(CFG.colors[c] || '#aaa') + '55'}">${U.esc(c)} ${U.won(v)}</span>`).join('')}</div>
          <div class="st-ins">${ins ? ins.emoji + ' ' + ins.html.replace(/<[^>]+>/g, '') : '꾸준한 기록이 자산이 됩니다.'}</div>
          <div class="st-foot"><span>${U.comma(S.totalDays)}일째 기록</span><span>hyun ledger</span></div>
        </div>
        <div class="modal-actions">
          <button class="btn" data-nav="-1"><i class="fa-solid fa-chevron-left"></i></button>
          <button class="btn gold" id="story-save"><i class="fa-solid fa-download"></i> 이미지 저장</button>
          <button class="btn" data-nav="1"><i class="fa-solid fa-chevron-right"></i></button>
        </div>
      </div></div>`);
    document.body.appendChild(modal);
    modal.addEventListener('click', e => {
      if (e.target === modal) modal.remove();
      const nav = e.target.closest('[data-nav]');
      if (nav) {
        const next = S.months[idx + (+nav.dataset.nav)];
        if (next && !(S.isPartial && next === S.lastMonth)) { modal.remove(); open(next); }
      }
    });
    modal.querySelector('#story-save').onclick = async () => {
      const btn = modal.querySelector('#story-save');
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 생성 중';
      try {
        const canvas = await html2canvas(modal.querySelector('#story-card'), { scale: 3, backgroundColor: '#0B0E14' });
        const a = document.createElement('a');
        a.download = `JH장부_${mk}.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
        btn.innerHTML = '<i class="fa-solid fa-check"></i> 저장됨';
      } catch (e) {
        btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> 실패';
        console.error(e);
      }
      setTimeout(() => { btn.innerHTML = '<i class="fa-solid fa-download"></i> 이미지 저장'; }, 1800);
    };
  }

  return { open };
})();
