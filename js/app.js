/* ============================================================
 * app.js — 셸: 탭 라우팅, 프라이버시 블러, 테마 토글
 * ============================================================ */
(() => {
  const TABS = [
    { id: 'home', label: '홈', icon: 'fa-house' },
    { id: 'spend', label: '소비분석', icon: 'fa-chart-column' },
    { id: 'asset', label: '자산', icon: 'fa-coins' },
    { id: 'feed', label: '타임라인', icon: 'fa-stream' },
    { id: 'hall', label: '기록실', icon: 'fa-trophy' },
  ];
  const nav = document.getElementById('nav');
  const main = document.getElementById('main');

  nav.innerHTML = TABS.map(t =>
    `<button data-tab="${t.id}"><i class="fa-solid ${t.icon}"></i>${t.label}</button>`).join('');

  function show(tab) {
    nav.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    main.classList.remove('fade-swap'); void main.offsetWidth; main.classList.add('fade-swap');
    if (tab === 'home') VIEW_HOME.render(main);
    else if (tab === 'spend') VIEW_SPEND.render(main);
    else if (tab === 'asset') VIEW_ASSET.render(main);
    else if (tab === 'feed') VIEW_FEED.render(main);
    else if (tab === 'hall') VIEW_HALL.render(main);
    window.scrollTo({ top: 0 });
  }
  nav.addEventListener('click', e => {
    const b = e.target.closest('button'); if (b) show(b.dataset.tab);
  });

  /* 프라이버시 블러: 금액 전체를 흐리게 */
  const eye = document.getElementById('btn-eye');
  eye.addEventListener('click', () => {
    document.body.classList.toggle('private');
    eye.classList.toggle('on');
    eye.querySelector('i').className = document.body.classList.contains('private')
      ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
  });

  /* 라이트/다크 */
  const theme = document.getElementById('btn-theme');
  theme.addEventListener('click', () => {
    document.body.classList.toggle('light');
    theme.querySelector('i').className = document.body.classList.contains('light')
      ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    show(nav.querySelector('button.active').dataset.tab); // 차트 색 재적용
  });

  /* 스트릭 라벨 */
  document.getElementById('streak').textContent =
    `${STORE.D.meta.from.slice(0, 7).replace('-', '.')}부터 · ${U.comma(STORE.totalDays)}일`;

  /* 월간 리포트 FAB */
  const fab = U.el('<button class="fab" title="월간 리포트 카드"><i class="fa-solid fa-camera-retro"></i></button>');
  document.body.appendChild(fab);
  fab.onclick = () => STORY.open();

  /* 라이브 데이터 (Apps Script) — 성공 시 스토어 재빌드 후 현재 탭 갱신 */
  async function boot() {
    if (CFG.API_URL) {
      try {
        const r = await fetch(CFG.API_URL);
        if (r.ok) {
          window.APP_DATA = await r.json();
          Object.assign(window.STORE, window.buildStore());
          document.getElementById('streak').textContent =
            `${STORE.D.meta.from.slice(0, 7).replace('-', '.')}부터 · ${U.comma(STORE.totalDays)}일`;
          show(nav.querySelector('button.active').dataset.tab);
        }
      } catch (e) { console.warn('라이브 데이터 로드 실패 — 스냅샷으로 표시합니다.', e); }
    }
  }

  /* PWA 서비스워커 */
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  show('home');
  boot();
})();
