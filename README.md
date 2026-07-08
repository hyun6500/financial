# JH 장부 — 개인 자산관리 웹앱

9년의 가계부(2018.04~, 5,547건)와 자산 포트폴리오를 하나로 보는 개인 자산관리 PWA.
스프레드시트에 기록하는 습관은 그대로 두고, 보는 경험만 서비스 수준으로 끌어올립니다.

---

## 기능 전체 (v1 완성)

| 탭 | 내용 |
|---|---|
| 🏠 **홈** | 이번 달 지출/수입/저축/순자산 히어로 · 12개월 소비 히트맵 · AI 인사이트(규칙 기반 자연어) · 카테고리 도넛 · Top5 · 12개월 추이 |
| 📊 **소비분석** | 9년 월별 추이+이동평균 · 연도별 지출/저축률 · 카테고리 딥다이브(기간 선택→드릴다운) · 요일/계절성 · 고정 지출 자동 탐지 · **개인 물가지수** |
| 💰 **자산** | ①현황: 순자산 곡선(실측+재구성, 원금/손익 토글)·자산 구성·예적금 만기 ②투자: **투자 성적표**(승률·최고/최악 거래)·계좌/VC/보유 종목 ③수입원: 커리어 연봉 곡선·사이드잡·멘토링 |
| 📱 **타임라인** | 전체 내역 피드 · 날짜 그룹핑 · 검색 · 그룹 필터 · 증분 로딩 · 절약 💚 배지 |
| 🏆 **기록실** | 스트릭·명예의 전당·소비/수입 TOP10·단골 랭킹·**효도 대시보드**·**숨은 절약 리포트**·🔒 프라이빗(소개팅 리포트+함께한 소비, 기본 잠금) |
| 📸 **월간 리포트** | 우측 하단 버튼 → 인스타 스토리형 결산 카드(9:16) → PNG 저장, 월 이동 가능 |
| 공통 | 다크/라이트 · 👁 금액 블러 · 반응형(모바일 하단 탭/PC 좌측 레일) · PWA(홈 화면 추가·오프라인) |

---

## 1. 로컬 실행

압축 해제 후 폴더에서:

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

(index.html을 그냥 더블클릭해도 대부분 동작하지만, 서비스워커·폰트는 서버 환경에서 정상 동작합니다.)

## 2. 데이터 갱신 — 스냅샷 모드

엑셀을 새로 내려받아 파서를 돌리면 `data.js`가 갱신됩니다:

```bash
pip install openpyxl
python3 tools/parse.py 가계부.xlsx 자산포트폴리오.xlsx data.js
```

- `tools/parse.py` 상단 `ANONYMIZE = True`: 소개팅·지인 실명을 `김** 96` 형태로 마스킹 (기본값, 공개 배포 시 필수 권장)

## 3. GitHub Pages 배포

```bash
# 새 저장소(예: hyun6500.github.io/ledger)에 이 폴더 전체를 push
git init && git add . && git commit -m "JH ledger v1"
git branch -M main
git remote add origin https://github.com/hyun6500/ledger.git
git push -u origin main
# GitHub → Settings → Pages → Branch: main / root → Save
```

⚠️ **공개 저장소면 `data.js`를 누구나 열람할 수 있습니다.**
- 금액·소비 내역이 노출되는 것이 싫다면 **Private 저장소 + GitHub Pages**(Pro 계정) 또는 로컬 사용을 권장
- 최소한 `ANONYMIZE = True` 상태의 data.js만 올리세요

## 4. 구글 시트 라이브 연동 (Apps Script)

기록은 지금처럼 스프레드시트에 하고, 앱은 접속할 때마다 최신 데이터를 받아옵니다.

1. https://script.google.com → 새 프로젝트
2. `Code.gs` 내용 붙여넣기, 프로젝트 설정에서 `appsscript.json` 표시 후 내용 교체
3. `Code.gs` 상단 `LEDGER_ID`, `PORTFOLIO_ID`를 두 스프레드시트의 ID로 교체
   (시트 URL의 `/d/`와 `/edit` 사이 문자열)
4. **배포 → 새 배포 → 웹 앱** — 실행: *나*, 액세스: *링크가 있는 모든 사용자* → 배포
5. 발급된 URL(`https://script.google.com/macros/s/.../exec`)을 `js/config.js`의 `API_URL`에 입력
6. 커밋/푸시 → 끝. 앱은 스냅샷을 먼저 그리고, 라이브 데이터가 오면 자동 갱신됩니다

- 서버 캐시 6시간. 즉시 갱신하려면 `API_URL?refresh=1`을 브라우저에서 한 번 호출
- 시트의 GOOGLEFINANCE 시세도 라이브 모드에서 자동 반영
- `Code.gs`의 `ANONYMIZE`도 기본 true — 웹앱 URL을 아는 사람은 JSON을 볼 수 있기 때문

## 5. 유지보수 가이드

**새 카테고리를 만들었을 때** → `tools/parse.py`와 `Code.gs`의 `CAT_MAP`/`GROUP_MAP`, `js/config.js`의 색상·아이콘에 한 줄씩 추가. 매핑에 없는 카테고리도 앱은 그대로 표시합니다(색만 회색).

**시트 구조를 바꿀 때 지켜야 할 것**
- 월별 시트 이름 `YY-MM`, 원장 헤더 행에 `날짜` 텍스트 유지
- 거래 행은 장소·세부내역·카테고리 중 하나 이상 입력 (전부 비우고 금액만 쓰면 부속 테이블로 간주되어 제외)
- `0.자산`의 자산 스냅샷 로그(K~M열)는 계속 쌓아주세요 — 순자산 실측 곡선이 길어집니다
- 소개팅/엄빠 용돈 테이블은 최신 월 시트에서 위치 기준으로 찾으므로, 대략 지금 위치를 유지

**기능별 튜닝 포인트**
- 고정 지출 탐지 기준(8개월 중 6개월): `js/views/spend.js`의 `detectFixed()`
- 물가지수 후보 조건(25건·4개년): `spend.js`의 `buildCPI()`
- 인사이트 규칙/문구: `js/insights.js` — 템플릿 추가만으로 확장 가능
- 프라이빗 섹션 동행 추정 휴리스틱: `js/views/hall.js`의 `STOP` 정규식

**v2 후보(보류 항목)**: `25 check list` 습관 트래커, `(알파)` 투자 저널, 인연 히스토리 상세 뷰

## 구조

```
index.html / manifest.json / sw.js / icons/
css/style.css        디자인 시스템
js/config.js         API_URL · 색상 · 아이콘 · 매핑
js/utils.js          금액·날짜·조사(이/가) 유틸
js/store.js          집계 인덱스 + 순자산 시리즈(buildStore)
js/insights.js       규칙 기반 인사이트 엔진
js/charts.js         Chart.js 테마 + 커스텀 히트맵
js/story.js          월간 리포트 스토리 카드
js/views/            home · spend · asset · feed · hall
js/app.js            라우팅 · 토글 · 라이브 부트 · SW 등록
data.js              스냅샷 데이터 (parse.py 산출물)
tools/parse.py       엑셀 → data.js
Code.gs              Apps Script 라이브 API (동일 스키마)
appsscript.json      Apps Script 매니페스트
```
