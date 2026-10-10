const UNITS = ['', 'K', 'M', 'B', 'T'];

// 1234 → 1.23K, เกิน T ใช้ aa, ab, ac … (up = ปัดขึ้น ใช้กับราคา จะได้ไม่โชว์ต่ำกว่าที่ต้องจ่ายจริง)
export function fmt(n, up = false) {
  if (!isFinite(n)) return '∞';
  const round = up ? Math.ceil : Math.floor;
  if (n < 1000) return String(round(n));
  const e = Math.floor(Math.log10(n) / 3);
  const v = n / Math.pow(1000, e);
  let unit;
  if (e < UNITS.length) unit = UNITS[e];
  else {
    const i = e - UNITS.length;
    unit = String.fromCharCode(97 + Math.floor(i / 26)) + String.fromCharCode(97 + (i % 26));
  }
  const digits = v < 10 ? 2 : v < 100 ? 1 : 0;
  return String(+(round(v * 10 ** digits) / 10 ** digits).toFixed(digits)) + unit;
}

export function fmtTime(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h) return `${h} ชม. ${m} นาที`;
  if (m) return `${m} นาที ${s} วิ`;
  return `${s} วิ`;
}
