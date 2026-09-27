const START_OFFSET = 40;
const tabs = ['edge', 'caliper', 'guide'];

const MM_PER_INCH = 25.4;

/* ------------------------------------------------------------------ *
 * 1. NHẬN DIỆN THIẾT BỊ + CƠ SỞ DỮ LIỆU PPI
 *
 * Kiến trúc:
 *   Browser --(UA / UA-CH / screen.width,height / devicePixelRatio)-->
 *   Device Detection --(tra cứu)--> Device Database (iPhone, Samsung,
 *   Pixel, Xiaomi, iPad, ...) --> Physical PPI --(chia cho dpr)-->
 *   CSS px / physical mm --> Online Ruler
 *
 * Trình duyệt không cho biết kích thước vật lý màn hình, nhưng PPI vật lý
 * của từng model máy là hằng số nhà sản xuất công bố. Nếu nhận diện đúng
 * model, ta tra PPI đó ra và tính CSS-px-trên-mm chính xác gần như tuyệt
 * đối - không cần người dùng tự hiệu chỉnh bằng vật thật.
 *
 * Độ chính xác giảm dần qua 3 tầng:
 *   Tầng 1 - Model chính xác (iPhone/iPad theo screen+dpr, Samsung theo mã
 *            SM-xxxx, Pixel theo tên UA-CH)            -> sai số < 1%.
 *   Tầng 2 - Chỉ biết HÃNG, không biết model cụ thể      -> dùng PPI trung
 *            bình của hãng, sai số ước tính 3-5%.
 *   Tầng 3 - Không nhận diện được gì (PC, hãng lạ)       -> ước lượng
 *            chung theo loại thiết bị, sai số có thể >5%.
 * ------------------------------------------------------------------ */

// ----- Tầng 1: cơ sở dữ liệu PPI theo model chính xác -----

// iPhone: Apple chỉ dùng vài mức PPI vật lý cố định, xác định được qua
// (chiều rộng CSS, devicePixelRatio).
const IPHONE_PPI_DB = [
  { w: 320, dpr: 2, ppi: 326 },  // 5 / 5s / SE (1st gen)
  { w: 375, dpr: 2, ppi: 326 },  // 6/6s/7/8/SE2/SE3
  { w: 414, dpr: 2, ppi: 326 },  // 6+/7+/8+ (401 thực tế, 326 cho XR/11 - phân biệt bên dưới)
  { w: 375, dpr: 3, ppi: 458 },  // X/XS/11 Pro
  { w: 414, dpr: 3, ppi: 458 },  // XS Max/11 Pro Max/12 Pro Max*
  { w: 360, dpr: 3, ppi: 476 },  // 12 mini/13 mini
  { w: 390, dpr: 3, ppi: 460 },  // 12/12 Pro/13/13 Pro/14
  { w: 428, dpr: 3, ppi: 458 },  // 12 Pro Max/13 Pro Max/14 Plus
  { w: 393, dpr: 3, ppi: 460 },  // 14 Pro/15/15 Pro/16
  { w: 430, dpr: 3, ppi: 460 },  // 14 Pro Max/15 Plus/15 Pro Max/16 Plus
];
// 6+/7+/8+ dùng 401 ppi thay vì 326 (cùng width=414,dpr=2 với XR/11) -> phân biệt bằng screen.height
const IPHONE_PLUS_PPI = 401; // 6+/7+/8+ (chiều cao CSS 736, còn XR/11 là 896)

const IPAD_MINI_PPI = 326; // iPad mini 6/7 (màn 8.3", css width ~744)
const IPAD_PPI = 264;      // iPad thường / Air / Pro (css width 2x còn lại)

// Samsung Galaxy: nhận diện qua mã model UA-CH (ví dụ "SM-S911B").
// Nguồn: thông số kỹ thuật nhà sản xuất công bố (PPI vật lý panel).
const SAMSUNG_PPI_DB = [
  { re: /SM-S92[89]/i, ppi: 505, name: 'Galaxy S24 Ultra' },
  { re: /SM-S926/i,    ppi: 513, name: 'Galaxy S24+' },
  { re: /SM-S921/i,    ppi: 416, name: 'Galaxy S24' },
  { re: /SM-S91[78]/i, ppi: 500, name: 'Galaxy S23 Ultra' },
  { re: /SM-S916/i,    ppi: 393, name: 'Galaxy S23+' },
  { re: /SM-S911/i,    ppi: 425, name: 'Galaxy S23' },
  { re: /SM-S908/i,    ppi: 500, name: 'Galaxy S22 Ultra' },
  { re: /SM-S906/i,    ppi: 393, name: 'Galaxy S22+' },
  { re: /SM-S901/i,    ppi: 425, name: 'Galaxy S22' },
  { re: /SM-G998/i,    ppi: 515, name: 'Galaxy S21 Ultra' },
  { re: /SM-G996/i,    ppi: 394, name: 'Galaxy S21+' },
  { re: /SM-G991/i,    ppi: 421, name: 'Galaxy S21' },
  { re: /SM-N986/i,    ppi: 496, name: 'Galaxy Note20 Ultra' },
  { re: /SM-N981/i,    ppi: 393, name: 'Galaxy Note20' },
  { re: /SM-A546/i,    ppi: 403, name: 'Galaxy A54' },
  { re: /SM-A536/i,    ppi: 405, name: 'Galaxy A53' },
  { re: /SM-A346/i,    ppi: 401, name: 'Galaxy A34' },
  { re: /SM-A336/i,    ppi: 401, name: 'Galaxy A33' },
  { re: /SM-A146/i,    ppi: 401, name: 'Galaxy A14' },
  { re: /SM-A05/i,     ppi: 263, name: 'Galaxy A05' },
];

// Google Pixel: UA-CH trả tên thương mại đầy đủ (vd "Pixel 7 Pro").
const PIXEL_PPI_DB = [
  { re: /Pixel 8 Pro/i, ppi: 489 },
  { re: /Pixel 8a/i,    ppi: 430 },
  { re: /Pixel 8/i,     ppi: 428 },
  { re: /Pixel 7 Pro/i, ppi: 512 },
  { re: /Pixel 7a/i,    ppi: 429 },
  { re: /Pixel 7/i,     ppi: 416 },
  { re: /Pixel 6 Pro/i, ppi: 512 },
  { re: /Pixel 6a/i,    ppi: 429 },
  { re: /Pixel 6/i,     ppi: 411 },
];

// Xiaomi/Redmi/POCO thường trả mã nội bộ khó đoán (vd "23049PCD8G") thay vì
// tên thương mại, nên chỉ liệt kê được vài mã tiêu biểu. Có thể bổ sung
// thêm khi biết mã của model cụ thể.
const XIAOMI_PPI_DB = [
  { re: /2210132C|2201123C/i, ppi: 419, name: 'Xiaomi 12/13' },
  { re: /22101316C|2201116SG/i, ppi: 395, name: 'Redmi Note 11/12' },
];

// ----- Tầng 2: PPI trung bình theo hãng (khi không khớp model cụ thể) -----
const BRAND_AVG_PPI = {
  samsung: 410,
  xiaomi: 400,
  redmi: 395,
  poco: 395,
  oppo: 401,
  vivo: 401,
  realme: 395,
  oneplus: 402,
};

// Lấy model qua User-Agent Client Hints (chỉ Chrome/Edge trên Android).
// iOS Safari không hỗ trợ UA-CH nên luôn rơi về nhận diện qua screen+dpr.
async function getUACHModel() {
  try {
    if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
      const info = await navigator.userAgentData.getHighEntropyValues(['model']);
      return info.model || '';
    }
  } catch (e) { /* trình duyệt chặn hoặc không hỗ trợ */ }
  return '';
}

function matchDb(model, db) {
  for (const entry of db) {
    if (entry.re.test(model)) return entry;
  }
  return null;
}

async function detectDevice() {
  const cssW = Math.min(window.screen.width, window.screen.height);
  const cssH = Math.max(window.screen.width, window.screen.height);
  const dpr = window.devicePixelRatio || 1;
  const ua = navigator.userAgent || '';
  const touch = navigator.maxTouchPoints || 0;

  const isIPhone = /iPhone/.test(ua);
  const isIPad = /iPad/.test(ua) || (/Macintosh/.test(ua) && touch > 1);
  const isAndroid = /Android/.test(ua);

  // --- Apple: xác định qua screen + dpr, không cần UA-CH (iOS không hỗ trợ) ---
  if (isIPhone) {
    const isPlusSize = cssW === 414 && dpr === 2 && cssH === 736; // 6+/7+/8+
    const entry = IPHONE_PPI_DB.find(d => d.w === cssW && d.dpr === dpr);
    const ppi = isPlusSize ? IPHONE_PLUS_PPI : (entry ? entry.ppi : 326);
    return { ppi, dpr, label: 'Đã nhận diện iPhone - độ chính xác cao', tier: 1 };
  }
  if (isIPad) {
    const ppi = cssW >= 720 ? IPAD_MINI_PPI : IPAD_PPI;
    return { ppi, dpr, label: 'Đã nhận diện iPad', tier: 1 };
  }

  // --- Android: thử tra Device Database qua UA-CH model ---
  if (isAndroid || (touch > 0 && cssW <= 800)) {
    const model = await getUACHModel();

    const samsung = matchDb(model, SAMSUNG_PPI_DB);
    if (samsung) return { ppi: samsung.ppi, dpr, label: `Đã nhận diện Samsung ${samsung.name}`, tier: 1 };

    const pixel = matchDb(model, PIXEL_PPI_DB);
    if (pixel) return { ppi: pixel.ppi, dpr, label: `Đã nhận diện Google ${model}`, tier: 1 };

    const xiaomi = matchDb(model, XIAOMI_PPI_DB);
    if (xiaomi) return { ppi: xiaomi.ppi, dpr, label: `Đã nhận diện ${xiaomi.name}`, tier: 1 };

    // Không khớp model cụ thể -> đoán hãng qua UA rồi dùng PPI trung bình hãng
    const brandMatch = /samsung/i.test(ua) ? 'samsung'
      : /xiaomi|redmi/i.test(ua) ? 'xiaomi'
      : /poco/i.test(ua) ? 'poco'
      : /oppo|cph\d/i.test(ua) ? 'oppo'
      : /vivo/i.test(ua) ? 'vivo'
      : /realme/i.test(ua) ? 'realme'
      : /oneplus/i.test(ua) ? 'oneplus'
      : null;
    if (brandMatch) {
      return { ppi: BRAND_AVG_PPI[brandMatch], dpr, label: `Nhận diện hãng ${brandMatch} - ước lượng`, tier: 2 };
    }

    return { ppi: 157 * dpr, dpr, label: 'Android - kết quả ước lượng (sai số ~3-5%)', tier: 3 };
  }

  return { ppi: 96 * dpr, dpr, label: 'Máy tính - nên đo trên điện thoại để chính xác', tier: 3 };
}

let pixelsPerMm = 163 / MM_PER_INCH; // giá trị tạm, được cập nhật ngay khi init() chạy xong

// Người dùng zoom (pinch) làm 1 CSS px dài ra `scale` lần trên màn hình thật
function viewportScale() {
  return (window.visualViewport && window.visualViewport.scale) || 1;
}

const deviceStatus = document.getElementById('device-status');
const devicePill = document.getElementById('device-pill');

function applyDevice(device) {
  pixelsPerMm = device.ppi / device.dpr / MM_PER_INCH;
  deviceStatus.textContent = device.label;
  devicePill.classList.toggle('warn', device.tier >= 3);
}

/* ------------------------------------------------------------------ *
 * 2. THƯỚC THẲNG
 * ------------------------------------------------------------------ */
function renderEdgeRuler() {
  const container = document.getElementById('edge-ruler-container');
  if (!container || container.children.length) return;

  const maxMm = Math.floor((window.innerHeight - START_OFFSET) / pixelsPerMm);
  const frag = document.createDocumentFragment();

  for (let i = 0; i <= maxMm; i++) {
    const isCentimeter = i % 10 === 0;
    const isHalfCentimeter = i % 5 === 0 && !isCentimeter;
    const tick = document.createElement('div');
    tick.className = 'tick';
    tick.style.top = `${i * pixelsPerMm + START_OFFSET}px`;

    const line = document.createElement('div');
    line.className = 'tick-line ' + (isCentimeter ? 'tick-cm' : isHalfCentimeter ? 'tick-half' : 'tick-small');
    tick.appendChild(line);

    if (isCentimeter) {
      const label = document.createElement('span');
      label.className = 'tick-label';
      label.innerHTML = `${i} <small>mm</small>`;
      tick.appendChild(label);
    }
    frag.appendChild(tick);
  }
  container.appendChild(frag);
}

function rebuildRuler() {
  const container = document.getElementById('edge-ruler-container');
  if (container) container.innerHTML = '';
  if (!document.getElementById('tab-edge').classList.contains('hidden')) renderEdgeRuler();
}

function switchTab(activeTab) {
  tabs.forEach(tab => {
    const tabEl = document.getElementById(`tab-${tab}`);
    const btnEl = document.getElementById(`nav-${tab}`);
    if (!tabEl || !btnEl) return;

    tabEl.classList.toggle('hidden', tab !== activeTab);
    btnEl.classList.toggle('active', tab === activeTab);
    btnEl.classList.toggle('muted', tab !== activeTab);
  });
  if (activeTab === 'edge') renderEdgeRuler();
}

/* ------------------------------------------------------------------ *
 * 3. THƯỚC ĐO (2 thanh kẹp)
 *
 * caliperTop / caliperBottom là toạ độ TÂM của mỗi vạch.
 * Người dùng canh MÉP TRONG của hai vạch vào hai mép chân ti, nên khoảng
 * cách thật = (tâm dưới - tâm trên) - độ dày vạch.
 * (Bản cũ đo giữa hai tâm => luôn dư đúng 1 độ dày vạch ≈ 1 mm.)
 * ------------------------------------------------------------------ */
const MIN_GAP_PX = 6;      // khe tối thiểu giữa 2 vạch
const TOP_LIMIT = 190;     // không kéo lên chạm bảng kết quả

let caliperTop = 250;
let caliperBottom = 330;
let linePx = 4;
let drag = null;

const barTop = document.getElementById('caliper-bar-top');
const barBottom = document.getElementById('caliper-bar-bottom');
const overlay = document.getElementById('caliper-overlay');
const distText = document.getElementById('caliper-distance');
const suggestText = document.getElementById('caliper-suggest');
const mainContent = document.getElementById('main-content');

function readLineThickness() {
  const line = barTop.querySelector('.caliper-line');
  const h = line ? parseFloat(getComputedStyle(line).height) : NaN;
  linePx = h > 0 ? h : 4;
}

// Căn theo pixel vật lý để vạch không bị nhoè nửa pixel
function snap(y) {
  const dpr = window.devicePixelRatio || 1;
  return Math.round(y * dpr) / dpr;
}

function updateCaliperUI() {
  barTop.style.top = `${caliperTop}px`;
  barBottom.style.top = `${caliperBottom}px`;

  const gapPx = Math.max(0, caliperBottom - caliperTop - linePx);
  overlay.style.top = `${caliperTop + linePx / 2}px`;
  overlay.style.height = `${gapPx}px`;

  const mm = (gapPx * viewportScale()) / pixelsPerMm;
  distText.textContent = mm.toFixed(1);
  suggestText.textContent = `${Math.round(mm + 2)}mm - ${Math.round(mm + 4)}mm`;
}

function clampBars() {
  const maxY = mainContent.getBoundingClientRect().height - 20;
  caliperBottom = Math.min(caliperBottom, maxY);
  caliperTop = Math.min(caliperTop, caliperBottom - linePx - MIN_GAP_PX);
  caliperTop = Math.max(caliperTop, TOP_LIMIT);
  caliperBottom = Math.max(caliperBottom, caliperTop + linePx + MIN_GAP_PX);
}

function startDrag(side, e) {
  const rect = mainContent.getBoundingClientRect();
  const current = side === 'top' ? caliperTop : caliperBottom;
  // Giữ nguyên khoảng lệch giữa ngón tay và tâm vạch -> không bị "nhảy" khi bắt đầu kéo
  drag = { side, id: e.pointerId, offset: (e.clientY - rect.top) - current };
  e.currentTarget.setPointerCapture(e.pointerId);
  e.preventDefault();
}

function moveDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const rect = mainContent.getBoundingClientRect();
  const maxY = rect.height - 20;
  const y = snap(e.clientY - rect.top - drag.offset);

  if (drag.side === 'top') {
    caliperTop = Math.max(TOP_LIMIT, Math.min(y, caliperBottom - linePx - MIN_GAP_PX));
  } else {
    caliperBottom = Math.min(maxY, Math.max(y, caliperTop + linePx + MIN_GAP_PX));
  }
  updateCaliperUI();
}

function endDrag(e) {
  if (drag && e.pointerId === drag.id) drag = null;
}

for (const [bar, side] of [[barTop, 'top'], [barBottom, 'bottom']]) {
  bar.addEventListener('pointerdown', e => startDrag(side, e));
  bar.addEventListener('pointermove', moveDrag);
  bar.addEventListener('pointerup', endDrag);
  bar.addEventListener('pointercancel', endDrag);
}

/* ------------------------------------------------------------------ *
 * 4. KHỞI TẠO
 * ------------------------------------------------------------------ */
for (const btn of document.querySelectorAll('.nav-btn')) {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
}

function onViewportChange() {
  readLineThickness();
  clampBars();
  rebuildRuler();
  updateCaliperUI();
}
window.addEventListener('resize', onViewportChange);
if (window.visualViewport) window.visualViewport.addEventListener('resize', updateCaliperUI);

readLineThickness();
updateCaliperUI(); // vẽ tạm với giá trị mặc định trong lúc chờ nhận diện thiết bị

async function init() {
  const device = await detectDevice();
  applyDevice(device);
  rebuildRuler();
  updateCaliperUI();
}
init();
