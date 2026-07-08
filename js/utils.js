/* ============================================================
 * utils.js — 포맷/날짜 유틸
 * ============================================================ */
window.U = {
  // 12345678 → "1,234만" / full=true → "12,345,678원"
  won(v, full = false) {
    if (v == null || isNaN(v)) return '-';
    const neg = v < 0, a = Math.abs(Math.round(v));
    let s;
    if (full || a < 10000) s = a.toLocaleString('ko-KR') + '원';
    else if (a < 1e8) s = Math.round(a / 1e4).toLocaleString('ko-KR') + '만원';
    else s = (a / 1e8).toFixed(a >= 1e9 ? 1 : 2).replace(/\.?0+$/, '') + '억원';
    return (neg ? '-' : '') + s;
  },
  comma(v) { return v == null ? '-' : Math.round(v).toLocaleString('ko-KR'); },
  pct(v, d = 1) { return v == null ? '-' : (v * 100).toFixed(d) + '%'; },
  monthKey(dstr) { return dstr ? dstr.slice(0, 7) : null; },
  prevMonth(mk) {
    const [y, m] = mk.split('-').map(Number);
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  },
  mLabel(mk) { const [y, m] = mk.split('-'); return `${y}년 ${+m}월`; },
  daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 864e5); },
  // 받침 유무에 따른 조사 선택: josa('쇼핑','이','가') → '쇼핑이'
  josa(word, withBatchim, without) {
    const ch = word.replace(/[^가-힣]/g, '').slice(-1);
    if (!ch) return word + without;
    const code = ch.charCodeAt(0) - 0xAC00;
    return word + ((code % 28) ? withBatchim : without);
  },
  el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; },
  esc(s) { return s == null ? '' : String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); },
};
