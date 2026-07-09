/**
 * Code.gs — JH 장부 라이브 데이터 API
 * 가계부 + 자산 포트폴리오 스프레드시트를 파싱해
 * 프런트엔드(data.js)와 동일한 스키마의 JSON을 반환합니다.
 *
 * [설정] 아래 두 스프레드시트 ID를 본인 문서 ID로 교체하세요.
 *   (시트 URL의 /d/ 와 /edit 사이 문자열)
 * [배포] 배포 > 새 배포 > 웹 앱
 *   - 실행: 나 / 액세스: 링크가 있는 모든 사용자
 *   - 발급된 URL을 js/config.js 의 API_URL 에 입력
 * [캐시] 6시간 캐시. 강제 갱신: URL 뒤에 ?refresh=1
 * [익명화] ANONYMIZE=true 면 소개팅/지인 실명을 '김**' 형태로 마스킹
 *   (웹앱 URL을 아는 사람은 누구나 JSON을 볼 수 있으므로 true 권장)
 */
var LEDGER_ID = 'YOUR_LEDGER_SPREADSHEET_ID';
var PORTFOLIO_ID = 'YOUR_PORTFOLIO_SPREADSHEET_ID';
var ANONYMIZE = true;

var CAT_MAP = {
  '외식/점심':'외식/점심','외식/전심':'외식/점심','외식/저녁':'외식/저녁',
  '집밥':'집밥/생활비','생활비':'집밥/생활비','집밥/생활비':'집밥/생활비','디저트':'디저트',
  '운동':'운동','의료비':'의료비','보험비':'보험비','영양제':'영양제',
  '교통':'대중교통','대중교통':'대중교통','차량':'차량','주유/톨비':'주유/톨비','통신비':'통신비',
  '선물':'선물','경조사':'경조사','보은':'보은','회비':'회비',
  '여행':'여행','특별 여행':'여행','문화':'문화','놀이':'놀이','유흥':'놀이','교육':'교육',
  '헤어':'헤어','패션':'패션','쇼핑':'쇼핑','쇼핑/패션':'쇼핑','미용':'미용',
  '관리비':'관리비','부모님 용돈':'부모님 용돈'
};
var GROUP_MAP = {
  '외식/점심':'식사','외식/저녁':'식사','집밥/생활비':'식사','디저트':'식사',
  '운동':'건강','의료비':'건강','보험비':'건강','영양제':'건강',
  '대중교통':'교통/통신','차량':'교통/통신','주유/톨비':'교통/통신','통신비':'교통/통신',
  '선물':'관계','경조사':'관계','보은':'관계','회비':'관계',
  '여행':'여가','문화':'여가','놀이':'여가','교육':'여가',
  '헤어':'꾸미기','패션':'꾸미기','쇼핑':'꾸미기','미용':'꾸미기',
  '관리비':'주거','부모님 용돈':'가족','금융':'금융'
};
var INCOME_CATS = { '월급':1,'상여금':1,'부수입':1,'직장 외 부수입':1,'당근':1,'보험 환급':1 };
// 카테고리 미입력 지출 자동 분류: ① 장소 학습(최빈) ② 키워드 ③ '기타'
var KEYWORD_RULES = [
  [/용돈|엄마|아빠|엄빠|부모님/, '부모님 용돈'],
  [/KTX|코레일|SRT|기차|항공|공항|호텔|숙소|산장|펜션|리조트|트래블|여행/i, '여행'],
  [/병원|의원|치과|한의원|약국|검진/, '의료비'],
  [/크로스핏|피트니스|헬스|필라테스|요가|수영/, '운동'],
  [/지하철|버스|택시|티머니|교통/, '대중교통'],
  [/KT$|LG|SKT|유플러스|통신/, '통신비'],
  [/국세청|세금|수수료|복비|이자|보증|송금|환전|카카오페이|네이버파이낸셜|토스|투자/, '금융'],
  [/루이비통|디스커버리|쿠팡|무신사|패밀리샵|백화점|아울렛|올리브영|다이소|당근/, '쇼핑'],
  [/스타벅스|커피|카페|베이커리|디저트/, '디저트'],
  [/CGV|메가박스|롯데시네마|영화|공연|전시|콘서트/, '문화'],
  [/결혼|축의|조의|부의|장례/, '경조사'],
  [/선물/, '선물'],
  [/강의|클래스|캠퍼스|인강|스터디/, '교육'],
  [/보험|화재해상/, '보험비'],
  [/마티니|와인|칵테일|맥주|포차|주점/, '놀이'],
  [/닌텐도|게임|플스|스팀/, '놀이'],
  [/\d개월 등록/, '운동'],
  [/비빔밥|식당|국밥|김밥/, '외식/점심']
];
function inferCategory_(place, detail, placeVote) {
  var key = (place || '').trim();
  if (key && placeVote[key]) return placeVote[key];
  var text = (place || '') + ' ' + (detail || '');
  for (var i = 0; i < KEYWORD_RULES.length; i++)
    if (KEYWORD_RULES[i][0].test(text)) return KEYWORD_RULES[i][1];
  return '기타';
}

function doGet(e) {
  var force = e && e.parameter && e.parameter.refresh;
  var cache = CacheService.getScriptCache();
  if (!force) {
    var hit = readChunkedCache_(cache);
    if (hit) return jsonOut_(hit);
  }
  var payload = JSON.stringify(buildData_());
  writeChunkedCache_(cache, payload, 6 * 3600);
  return jsonOut_(payload);
}
function jsonOut_(s) {
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.JSON);
}
/* CacheService는 항목당 100KB 제한 → 분할 저장 */
function writeChunkedCache_(cache, s, ttl) {
  var SIZE = 90000, n = Math.ceil(s.length / SIZE), obj = { jh_n: String(n) };
  for (var i = 0; i < n; i++) obj['jh_' + i] = s.substr(i * SIZE, SIZE);
  cache.putAll(obj, ttl);
}
function readChunkedCache_(cache) {
  var n = cache.get('jh_n');
  if (!n) return null;
  var keys = [];
  for (var i = 0; i < +n; i++) keys.push('jh_' + i);
  var parts = cache.getAll(keys), out = '';
  for (var j = 0; j < +n; j++) { if (parts['jh_' + j] == null) return null; out += parts['jh_' + j]; }
  return out;
}

/* ================= 빌드 ================= */
function buildData_() {
  var ledger = SpreadsheetApp.openById(LEDGER_ID);
  var port = SpreadsheetApp.openById(PORTFOLIO_ID);
  var monthRe = /^\d{2}-\d{2}$/;
  var sheets = ledger.getSheets().filter(function (s) { return monthRe.test(s.getName()); })
    .sort(function (a, b) { return a.getName() < b.getName() ? -1 : 1; });
  var latest = sheets[sheets.length - 1];

  var tx = [];
  sheets.forEach(function (ws) {
    var name = ws.getName();
    var mk = '20' + name.replace('-', '-');
    var vals = ws.getRange(1, 1, ws.getLastRow(), 8).getValues();
    var cur = null, header = false;
    for (var r = 0; r < vals.length; r++) {
      var v = vals[r];
      if (!header) { if (v[0] === '날짜') header = true; continue; }
      var d = v[0], inc = v[1], exp = v[2], place = v[3], detail = v[4], cat = v[5], note = v[6], w = v[7];
      if (d instanceof Date) cur = d;
      if (empty_(inc) && empty_(exp) && empty_(place) && empty_(detail) && empty_(cat)) continue;
      if (!cur) continue;
      if (empty_(place) && empty_(detail) && empty_(cat)) continue; // 부속 테이블 방지
      if (empty_(detail) && empty_(cat) && !empty_(place)) { // 계산 메모 행 제외
        var ps = String(place).trim();
        if (/^[\d,.\s]+$/.test(ps) || /^총\s*[\d,]+/.test(ps)) continue;
      }
      var base = { d: iso_(cur), p: str_(place), dt: str_(detail), n: str_(note), w: str_(w), m: mk };
      if (typeof inc === 'number' && inc) {
        var rec = clone_(base);
        rec.ty = 'i'; rec.a = Math.round(inc);
        var c = str_(cat);
        if (!c || !INCOME_CATS[c]) c = (base.p && base.p.indexOf('멘토링') >= 0) ? '부수입' : (c || '기타수입');
        rec.c = c; rec.sc = c; rec.g = '수입'; tx.push(rec);
      }
      if (typeof exp === 'number') {
        var r2 = clone_(base);
        r2.ty = 'e'; r2.a = Math.round(exp);
        var ce = str_(cat);
        r2.c = ce || '미입력';
        if (ce && ce !== '-') {
          var sc = CAT_MAP[ce] || ce;
          r2.sc = sc; r2.g = GROUP_MAP[sc] || '기타';
        } else { r2.sc = null; }
        tx.push(r2);
      }
    }
  });

  // 2패스: 장소별 최빈 카테고리 학습 → 미입력분 추론
  var votes = {};
  tx.forEach(function (t) {
    if (t.ty === 'e' && t.sc && t.p) {
      if (!votes[t.p]) votes[t.p] = {};
      votes[t.p][t.sc] = (votes[t.p][t.sc] || 0) + 1;
    }
  });
  var placeVote = {};
  Object.keys(votes).forEach(function (p) {
    var best = null;
    Object.keys(votes[p]).forEach(function (c) { if (!best || votes[p][c] > votes[p][best]) best = c; });
    placeVote[p] = best;
  });
  tx.forEach(function (t) {
    if (t.ty === 'e' && !t.sc) {
      t.sc = inferCategory_(t.p, t.dt, placeVote);
      t.g = GROUP_MAP[t.sc] || '기타';
      t.inf = 1;
    }
  });

  var dates = tx.map(function (t) { return t.d; }).sort();
  return {
    meta: { generated: iso_(new Date()), source: 'apps-script-live', anonymized: ANONYMIZE,
            txCount: tx.length, from: dates[0], to: dates[dates.length - 1] },
    tx: tx,
    parents: parseParents_(latest),
    dating: parseDating_(latest),
    assets: parseAssets_(port.getSheetByName('0.자산')),
    invest: parseInvest_(port.getSheetByName('1.재테크'), port.getSheetByName('5.VC투자')),
    salary: parseSalary_(port.getSheetByName('2.연봉')),
    sidejobs: parseSidejobs_(port.getSheetByName('3.사이드잡')),
    cashback: parseCashback_(port.getSheetByName('4.카드캐시백'))
  };
}

/* ---- 엄빠 용돈 ---- */
function parseParents_(ws) {
  var out = [], grid = ws.getRange(1, 15, 10, 31).getValues(), r0 = -1, c0 = -1;
  for (var r = 0; r < grid.length; r++) for (var c = 0; c < grid[r].length; c++)
    if (grid[r][c] === '엄빠 용돈') { r0 = r + 1; c0 = c + 15; }
  if (r0 < 0) return out;
  var rows = ws.getRange(r0 + 2, c0, 120, 3).getValues();
  for (var i = 0; i < rows.length; i++) {
    var d = rows[i][0], a = rows[i][1], memo = rows[i][2];
    if (empty_(d) && empty_(a)) break;
    if (d instanceof Date) out.push({ d: iso_(d), a: typeof a === 'number' ? Math.round(a) : null, memo: str_(memo) });
  }
  return out;
}

/* ---- 소개팅 원장 + 통계 + 인연 히스토리 ---- */
function parseDating_(ws) {
  var out = { entries: [], stats: null, history: [] };
  var grid = ws.getRange(55, 23, 205, 20).getValues(); // rows 55~259, cols 23~42
  for (var r = 0; r < grid.length; r++) {
    for (var c = 0; c <= 8; c++) {
      var no = grid[r][c], nm = grid[r][c + 1], d = grid[r][c + 4];
      if (typeof no === 'number' && typeof nm === 'string' && nm && d instanceof Date) {
        var amt = 0;
        [grid[r][c + 6], grid[r][c + 7], grid[r][c + 8]].forEach(function (x) { if (typeof x === 'number') amt += Math.round(x); });
        out.entries.push({
          no: Math.round(no), name: ANONYMIZE ? anon_(nm) : nm.trim(),
          ch: chan_(grid[r][c + 2]), job: str_(grid[r][c + 3]),
          d: iso_(d), meets: typeof grid[r][c + 5] === 'number' ? Math.round(grid[r][c + 5]) : 1, a: amt
        });
        break;
      }
    }
  }
  // 통계 블록
  for (var r2 = 0; r2 < 26; r2++) for (var c2 = 5; c2 < 18; c2++) {
    if (grid[r2][c2] === '호감 상대 등장') {
      out.stats = { meal: grid[r2 + 1][c2 - 3], total: grid[r2 + 1][c2 - 1],
                    likeRate: grid[r2 + 1][c2], loveRate: grid[r2 + 1][c2 + 1] };
    }
  }
  // 인연 히스토리 (rows 60~89, cols 34~40)
  var h = ws.getRange(60, 34, 30, 7).getValues();
  for (var r3 = 0; r3 < h.length; r3++) {
    for (var c3 = 0; c3 <= 2; c3++) {
      var nm3 = h[r3][c3], period = h[r3][c3 + 1], cnt = h[r3][c3 + 2];
      if (typeof nm3 === 'string' && /^[가-힣]{1,4}(\s\d{2})?$/.test(nm3.trim()) &&
          (typeof cnt === 'number' || typeof period === 'string')) {
        out.history.push({ name: ANONYMIZE ? anon_(nm3) : nm3.trim(), period: str_(period),
          meets: typeof cnt === 'number' ? Math.round(cnt) : null,
          job: str_(h[r3][c3 + 3]), src: chan_(h[r3][c3 + 4]) });
        break;
      }
    }
  }
  return out;
}

/* ---- 0.자산 ---- */
function parseAssets_(a) {
  function num(r, c) { var v = a.getRange(r, c).getValue(); return typeof v === 'number' ? Math.round(v) : null; }
  var out = {
    updated: a.getRange(1, 9).getValue() instanceof Date ? iso_(a.getRange(1, 9).getValue()) : null,
    total: num(35, 5), totalPnl: num(35, 7),
    buckets: [
      { k: '은행 입출금', v: num(6, 5) },
      { k: '예적금·청약', v: num(13, 5) },
      { k: '투자', v: num(18, 5), pnl: num(18, 7), ret: a.getRange(18, 9).getValue() },
      { k: '기타(포인트·전세)', v: num(26, 5) }
    ],
    deposits: [], securities: [], others: [], history: []
  };
  for (var r = 14; r <= 17; r++) {
    var nm = a.getRange(r, 4).getValue(), v = a.getRange(r, 5).getValue();
    if (nm && typeof v === 'number') out.deposits.push({ k: String(nm), v: Math.round(v),
      memo: str_(a.getRange(r, 8).getValue()), rate: typeof a.getRange(r, 9).getValue() === 'number' ? a.getRange(r, 9).getValue() : null });
  }
  for (var r2 = 20; r2 <= 22; r2++) {
    var nm2 = a.getRange(r2, 4).getValue(), v2 = a.getRange(r2, 5).getValue();
    if (nm2 && typeof v2 === 'number') out.securities.push({ k: String(nm2), v: Math.round(v2),
      pnl: num(r2, 7), ret: typeof a.getRange(r2, 9).getValue() === 'number' ? a.getRange(r2, 9).getValue() : null });
  }
  for (var r3 = 27; r3 <= 30; r3++) {
    var nm3 = a.getRange(r3, 3).getValue(), v3 = a.getRange(r3, 5).getValue();
    if (nm3 && typeof v3 === 'number') out.others.push({ k: String(nm3), v: Math.round(v3) });
  }
  var hist = a.getRange(4, 11, 8, 3).getValues();
  hist.forEach(function (h) {
    if (h[0] instanceof Date && typeof h[1] === 'number')
      out.history.push({ d: iso_(h[0]), v: Math.round(h[1]), pnl: typeof h[2] === 'number' ? Math.round(h[2]) : null });
  });
  out.history.sort(function (x, y) { return x.d < y.d ? -1 : 1; });
  return out;
}

/* ---- 1.재테크 + 5.VC ---- */
function parseInvest_(t, v5) {
  var vals = t.getRange(1, 1, t.getLastRow(), 30).getValues();
  var realized = [], start = -1;
  for (var r = 0; r < vals.length; r++) if (vals[r][11] === '3) 종료') { start = r + 2; break; }
  if (start > 0) {
    for (var r2 = start + 1; r2 < Math.min(start + 80, vals.length); r2++) {
      var row = vals[r2], name = row[18];
      if (row[13] === '총 계') break;
      if (!name) { if (r2 + 1 < vals.length && !vals[r2 + 1][18] && vals[r2 + 1][13] !== '총 계') break; continue; }
      realized.push({
        name: String(name).trim(),
        buy: row[19] instanceof Date ? iso_(row[19]) : null,
        sell: row[20] instanceof Date ? iso_(row[20]) : null,
        invest: Math.round(row[24] || 0), proceeds: Math.round(row[26] || 0),
        div: Math.round(row[27] || 0), pnl: Math.round(row[28] || 0), ret: row[29]
      });
    }
  }
  var holdings = [];
  for (var r3 = 23; r3 < 50 && r3 < vals.length; r3++) {
    var tk = vals[r3][4], nm = vals[r3][5], vv = vals[r3][6];
    if (nm && typeof vv === 'number' && vv > 0) holdings.push({ ticker: String(tk), name: String(nm).trim(), v: Math.round(vv) });
  }
  var boryung = null;
  for (var r4 = 49; r4 < 70 && r4 < vals.length; r4++) {
    if (vals[r4][13] === '주 계') {
      boryung = { name: '보령(누적 매수)', invest: Math.round(vals[r4][24] || 0),
        pnl: Math.round(vals[r4][28] || 0), ret: vals[r4][29] };
      break;
    }
  }
  var coin = null;
  for (var r5 = 124; r5 < 140 && r5 < vals.length; r5++) {
    if (vals[r5][13] && String(vals[r5][13]).indexOf('코인') >= 0) {
      var iv = vals[r5 + 4] ? vals[r5 + 4][17] : null, cv = vals[r5 + 4] ? vals[r5 + 4][20] : null;
      coin = { invest: typeof iv === 'number' ? Math.round(iv) : null, value: typeof cv === 'number' ? Math.round(cv) : null };
      break;
    }
  }
  var vc = [];
  if (v5) {
    var vrows = v5.getRange(2, 1, 8, 10).getValues();
    vrows.forEach(function (row) {
      if (!row[2]) return;
      vc.push({ name: String(row[2]).trim(), invest: Math.round(row[5] || 0),
        value: typeof row[7] === 'number' ? Math.round(row[7]) : null,
        pnl: typeof row[8] === 'number' ? Math.round(row[8]) : null,
        ret: row[9], status: (row[1] === '보유중' || !row[1] || row[1] === '-') ? '보유중' : '종료' });
    });
  }
  return { realized: realized, holdings: holdings, boryung: boryung, coin: coin, vc: vc };
}

/* ---- 2.연봉 ---- */
function parseSalary_(s) {
  var out = [], vals = s.getRange(3, 1, 18, 10).getValues(), co = null;
  vals.forEach(function (v) {
    if (v[0]) co = String(v[0]).trim();
    if (!(v[1] instanceof Date)) return;
    out.push({ co: co, d: iso_(v[1]),
      pay: typeof v[2] === 'number' ? Math.round(v[2]) : null,
      rate: typeof v[3] === 'number' ? v[3] : null,
      why: str_(v[4]),
      received: typeof v[9] === 'number' ? Math.round(v[9]) : null });
  });
  return out;
}

/* ---- 3.사이드잡 ---- */
function parseSidejobs_(sj) {
  var out = [], vals = sj.getRange(3, 1, 80, 6).getValues(), year = null;
  vals.forEach(function (v) {
    if (typeof v[1] === 'number') year = Math.round(v[1]);
    var src = v[0] ? String(v[0]).trim() : null;
    if (!src || src === '총계' || src === '수입처' || src === '사이드잡') return;
    if (typeof v[5] === 'number' && year)
      out.push({ y: year, src: src, total: Math.round(v[5]), count: typeof v[4] === 'number' ? Math.round(v[4]) : null });
  });
  return out;
}

/* ---- 4.카드캐시백 ---- */
function parseCashback_(cb) {
  var out = [], vals = cb.getRange(3, 1, 25, 4).getValues();
  vals.forEach(function (v) {
    if (v[0] === '총계' && typeof v[1] === 'number' && typeof v[3] === 'number')
      out.push({ y: Math.round(v[1]), a: Math.round(v[3]) });
  });
  return out;
}

/* ---- 헬퍼 ---- */
function empty_(v) { return v === null || v === undefined || v === ''; }
function str_(v) { return empty_(v) ? null : String(v).trim(); }
function clone_(o) { return JSON.parse(JSON.stringify(o)); }
function iso_(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function anon_(nm) {
  var s = String(nm).trim();
  var m = s.match(/^([가-힣])[가-힣]{1,3}(\s*\d{2})?$/);
  return m ? m[1] + '**' + (m[2] || '') : s;
}
function chan_(ch) {
  if (empty_(ch)) return null;
  var s = String(ch).trim();
  if (!ANONYMIZE) return s;
  s = s.replace(/(지인 소개)\s*-\s*\S+/, '$1');
  if (/^\S+\s*소개$/.test(s)) s = '지인 소개';
  return s;
}
