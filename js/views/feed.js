/* ============================================================
 * views/feed.js — 타임라인
 *  전체 내역을 SNS 피드처럼: 날짜 그룹핑 · 검색 · 그룹 필터 · 증분 로딩
 * ============================================================ */
window.VIEW_FEED = (() => {
  const S = window.STORE;
  const BATCH = 90;
  let q = '', grp = null, shown = BATCH;
  let sorted = null;

  function list() {
    if (!sorted) sorted = S.tx.slice().sort((a, b) => b.d.localeCompare(a.d));
    let l = sorted;
    if (grp === '수입') l = l.filter(t => t.ty === 'i');
    else if (grp) l = l.filter(t => t.ty === 'e' && t.g === grp);
    if (q) {
      const k = q.toLowerCase();
      l = l.filter(t => (t.p && t.p.toLowerCase().includes(k)) ||
        (t.dt && t.dt.toLowerCase().includes(k)) ||
        (t.n && t.n.toLowerCase().includes(k)) || (t.sc && t.sc.includes(k)));
    }
    return l;
  }

  function txRow(t) {
    const col = t.ty === 'i' ? CH.css('--jade') : (CFG.colors[t.sc] || '#6B7280');
    const icon = t.ty === 'i' ? 'fa-sack-dollar' : (CFG.icons[t.sc] || 'fa-receipt');
    const save = t.ty === 'e' && t.n && CFG.savingRe.test(t.n);
    return `<div class="row">
      <div class="ic" style="background:${col}22;color:${col}"><i class="fa-solid ${icon}"></i></div>
      <div class="t"><div class="p">${U.esc(t.p || t.dt || '-')}${t.w ? `<span class="wtag">${U.esc(t.w)}</span>` : ''}</div>
        <div class="s">${U.esc([t.dt, t.sc].filter(Boolean).join(' · '))}${t.n ? ` · ${save ? '💚 ' : ''}${U.esc(t.n)}` : ''}</div></div>
      <div class="a ${t.ty} num sec ${t.ty === 'i' ? 'inc' : 'exp'}">${t.ty === 'i' ? '+' : ''}${U.won(t.a, true)}</div></div>`;
  }

  function renderList(root) {
    const l = list();
    const view = l.slice(0, shown);
    /* 날짜 그룹핑 */
    let html = '', curDay = null;
    for (const t of view) {
      if (t.d !== curDay) {
        if (curDay) html += '</div>';
        curDay = t.d;
        const dayExp = l.filter(x => x.d === t.d && x.ty === 'e').reduce((s, x) => s + x.a, 0);
        const dow = ['일', '월', '화', '수', '목', '금', '토'][new Date(t.d).getDay()];
        html += `<div class="day-head"><span class="d">${t.d.replace(/-/g, '.')} (${dow})</span>
          ${dayExp ? `<span class="sum sec">지출 ${U.won(dayExp, true)}</span>` : ''}</div><div class="feed-card rows">`;
      }
      html += txRow(t);
    }
    if (curDay) html += '</div>';
    if (!view.length) html = '<p class="placeholder" style="border:0">검색 결과가 없어요.</p>';
    if (l.length > shown)
      html += `<button class="load-more" id="fd-more">더 보기 (${U.comma(l.length - shown)}건 남음)</button>`;
    root.querySelector('#fd-list').innerHTML = html;
    const btn = root.querySelector('#fd-more');
    if (btn) btn.onclick = () => { shown += BATCH; renderList(root); };
  }

  function render(root) {
    shown = BATCH;
    const groups = ['식사', '건강', '교통/통신', '관계', '여가', '꾸미기', '주거', '가족', '금융', '수입'];
    root.innerHTML = `
      <div class="search-bar"><i class="fa-solid fa-magnifying-glass"></i>
        <input id="fd-q" placeholder="장소 · 내역 · 메모 검색 (${U.comma(S.tx.length)}건)" value="${U.esc(q)}"></div>
      <div class="chips" style="margin-bottom:6px">
        <button class="chip ${!grp ? 'on' : ''}" data-g="">전체</button>
        ${groups.map(g => `<button class="chip ${grp === g ? 'on' : ''}" data-g="${g}"
          ${g !== '수입' ? `style="${grp === g ? '' : `color:${CFG.groupColors[g]}`}"` : ''}>${g}</button>`).join('')}
      </div>
      <div id="fd-list"></div>`;
    renderList(root);
    let deb;
    root.querySelector('#fd-q').addEventListener('input', e => {
      clearTimeout(deb);
      deb = setTimeout(() => { q = e.target.value.trim(); shown = BATCH; renderList(root); }, 200);
    });
    root.querySelector('.chips').addEventListener('click', e => {
      const b = e.target.closest('.chip'); if (!b) return;
      grp = b.dataset.g || null; shown = BATCH;
      root.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', (c.dataset.g || null) === grp));
      renderList(root);
    });
  }

  return { render };
})();
