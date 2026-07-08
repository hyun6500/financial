/* ============================================================
 * config.js — 색상·아이콘·그룹 정의 (여기만 고치면 전체 반영)
 * ============================================================ */
window.CFG = {
  // Apps Script 웹앱 배포 URL. 비워두면 data.js 스냅샷 사용
  API_URL: 'https://script.google.com/macros/s/AKfycbx2Co8J3JYAxRvTYdKYg0DtNKbwHtZt0BreIi7RYNlqhWBTs4YULwAOI6r8lLTQh72F/exec',

  // 표준 카테고리 → 색상 (그룹 계열 색으로 통일감 유지)
  colors: {
    '외식/점심': '#F2A65A', '외식/저녁': '#E8833A', '집밥/생활비': '#D9A066', '디저트': '#F6C177',
    '운동': '#57D6A9', '의료비': '#3FBF97', '보험비': '#7FD6C0', '영양제': '#A5E3CF',
    '대중교통': '#7FB4F2', '차량': '#5E93D8', '주유/톨비': '#9CC5F5', '통신비': '#6FA8EA',
    '선물': '#E48BC0', '경조사': '#D06FA8', '보은': '#EFA9D2', '회비': '#C687B5',
    '여행': '#A78BFA', '문화': '#8F7AE8', '놀이': '#C4A9FF', '교육': '#7B68D9',
    '헤어': '#F27BA0', '패션': '#E5638C', '쇼핑': '#FF93B5', '미용': '#D65E85',
    '관리비': '#94A3B8', '부모님 용돈': '#E6C97F', '미분류': '#6B7280',
  },
  groupColors: {
    '식사': '#F2A65A', '건강': '#57D6A9', '교통/통신': '#7FB4F2', '관계': '#E48BC0',
    '여가': '#A78BFA', '꾸미기': '#F27BA0', '주거': '#94A3B8', '가족': '#E6C97F', '기타': '#6B7280',
  },
  icons: {
    '외식/점심': 'fa-utensils', '외식/저녁': 'fa-bowl-food', '집밥/생활비': 'fa-kitchen-set', '디저트': 'fa-ice-cream',
    '운동': 'fa-person-swimming', '의료비': 'fa-stethoscope', '보험비': 'fa-shield-halved', '영양제': 'fa-pills',
    '대중교통': 'fa-train-subway', '차량': 'fa-car', '주유/톨비': 'fa-gas-pump', '통신비': 'fa-tower-cell',
    '선물': 'fa-gift', '경조사': 'fa-envelope-open-text', '보은': 'fa-hand-holding-heart', '회비': 'fa-users',
    '여행': 'fa-plane', '문화': 'fa-film', '놀이': 'fa-gamepad', '교육': 'fa-graduation-cap',
    '헤어': 'fa-scissors', '패션': 'fa-shirt', '쇼핑': 'fa-bag-shopping', '미용': 'fa-spa',
    '관리비': 'fa-house', '부모님 용돈': 'fa-heart', '미분류': 'fa-circle-question',
    '수입': 'fa-sack-dollar',
  },
  // 특이사항에서 절약 흔적을 찾는 패턴 (숨은 절약 리포트용)
  savingRe: /(캐시백|페이백|할인|포인트|서울사랑|쿠폰|지원|환급)/,
};
