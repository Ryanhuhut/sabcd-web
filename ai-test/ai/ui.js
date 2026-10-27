// ------------------------------------------------------------------
// BẢN RIÊNG: bảng "Đề bài (AI)" trong tab Dựng. Chỉ được nạp khi máy chủ có ai/rieng.json {"bat": true, "api": …}
// (index.html, riengConfig); bản công khai không có file này nên không có dấu vết gì.
//   [Chụp / chọn ảnh] → nén trên máy (cạnh dài ≤ 1600 px, JPEG 0,8) → POST <api>/doc-anh (có Huỷ)
//        → chữ đề AI đọc trong ô sửa được, chỗ [?] tô vàng → người dùng soát → [Dựng hình]
//   [Dán chữ]         → ô nhiều dòng → [Dựng hình]
//   [Dựng hình]       → POST <api>/dung → app.build(mã .sabcd): vở mới, chữ đề + model vào ghi chú, mở Mã đề
//   Tiến trình: mỗi bước một "chip" (đang chạy / xong / lỗi, model, thời gian, chuyển nấc); bấm vào → Nhật ký theo thời gian
//        (bấm dòng "nhận" xem nội dung model trả; Sao chép). Máy chủ đẩy từng sự kiện về qua ndjson.
//   Hỏi thêm (sau khi có hình): ô chat → POST <api>/hoi-them. Loại SỬA: xem trước các dòng mới, bấm [Thêm vào hình] mới áp dụng.
//        Loại HỎI: lời giải ngắn (+ gợi ý dựng, cũng phải bấm mới thêm). Nhật ký + hội thoại lưu theo vở ở 'sabcd.ai.<id vở>'
//        (khoá riêng của bản riêng, không đụng định dạng vở).
// Không có key nào ở đây: trình duyệt chỉ gọi máy chủ AI của chủ dự án (proxy ở nhà hoặc Worker riêng).
// ------------------------------------------------------------------
const MAX_SIDE = 1600, JPEG_Q = 0.8, MAX_DE = 2000;
const WAIT_ANH = 90000, WAIT_DUNG = 240000, MAX_HOI = 2000;

const CSS = `
  #ai { position: fixed; inset: 0; z-index: 9; display: grid; place-items: center; padding: 16px; background: rgba(5, 8, 14, 0.6); }
  #ai[hidden] { display: none; }
  #ai:not([hidden]) { animation: fade-in var(--d-fast) var(--ease); }
  #ai:not([hidden]) .dlg-card { animation: rise-in var(--d-mid) var(--ease); }
  #ai .ai-card { width: min(440px, 100%); max-height: calc(100dvh - 32px); overflow-y: auto; gap: 10px; }
  #ai .ai-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  #ai .ai-top b { font-size: 16px; }
  #ai button { min-height: 46px; border: 0; border-radius: 12px; padding: 0 14px; background: var(--btn); color: var(--text);
    font-size: 15px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
  #ai button .i { width: 20px; height: 20px; flex: none; }
  #ai button.main { background: var(--btn-on); color: #1a1a1a; }
  #ai button.ghost { background: transparent; color: var(--muted); border: 1px solid var(--btn); }
  #ai button:active { transform: scale(0.97); }
  #ai button:disabled { opacity: 0.4; }
  #ai #ai-x { min-width: 46px; padding: 0; }
  #ai .ai-pick { display: flex; gap: 8px; }
  #ai .ai-pick button { flex: 1 1 0; min-width: 0; min-height: 56px; }
  @keyframes ai-spin { to { transform: rotate(360deg); } }
  #ai .ai-edit[hidden], #ai .ai-pick[hidden] { display: none; }
  #ai .ai-spin { display: inline-block; width: 16px; height: 16px; flex: none; border-radius: 50%; border: 2.5px solid var(--btn);
    border-top-color: var(--accent); animation: ai-spin 0.9s linear infinite; }
  @media (prefers-reduced-motion: reduce) { #ai .ai-spin { animation-duration: 3s; } }
  #ai .ai-prog { display: flex; align-items: stretch; gap: 8px; }
  #ai .ai-prog[hidden], #ai .ai-log[hidden], #ai .ai-result[hidden], #ai .ai-prog [hidden] { display: none; }
  #ai .ai-chips { position: relative; flex: 1 1 auto; min-width: 0; min-height: 46px; flex-direction: column; align-items: stretch; justify-content: center; gap: 4px;
    padding: 6px 32px 6px 10px; border: 1px solid var(--btn); background: transparent; color: var(--text); text-align: left; font-size: 13.5px; font-weight: 500; }
  #ai .ai-chip { display: flex; align-items: center; gap: 8px; min-width: 0; }
  #ai .ai-chip .i { width: 18px; height: 18px; }
  #ai .ai-chip.xong .i { color: #7bd88f; }
  #ai .ai-chip.loi .i { color: #ff9a8a; }
  #ai .ai-chip-t { min-width: 0; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; line-height: 1.3; }
  #ai .ai-chips > .i { position: absolute; right: 10px; top: 14px; width: 16px; height: 16px; color: var(--muted); transition: transform var(--d-fast) var(--ease); }
  #ai .ai-chips[aria-expanded="true"] > .i { transform: rotate(180deg); }
  #ai .ai-log, #ai .ai-chat, #ai .ai-lg-pre { scrollbar-width: thin; scrollbar-color: var(--muted) transparent; }
  #ai .ai-log { border: 1px solid var(--btn); border-radius: 12px; padding: 4px 8px; max-height: 40dvh; overflow: auto; font-size: 12.5px; line-height: 1.45;
    font-variant-numeric: tabular-nums; }
  #ai .ai-lg { display: flex; gap: 8px; padding: 3px 0; overflow-wrap: anywhere; }
  #ai .ai-lg time { color: var(--muted); flex: none; }
  #ai .ai-lg.loi span { color: #ff9a8a; }
  #ai button.ai-lg { width: 100%; min-height: 44px; padding: 0; border-radius: 6px; background: transparent; font-size: 12.5px; font-weight: 500;
    justify-content: flex-start; align-items: center; text-align: left; }
  #ai .ai-lg-pre { margin: 0 0 6px; padding: 8px; border-radius: 8px; background: #121a2a; color: #e6ecf5; white-space: pre-wrap; overflow-wrap: anywhere;
    max-height: 30dvh; overflow: auto; font: 12.5px/1.4 system-ui, sans-serif; }
  #ai .ai-log-act { display: flex; justify-content: flex-end; padding-top: 4px; }
  #ai .ai-log-act button { min-height: 44px; font-size: 13.5px; }
  #ai .ai-result { display: flex; flex-direction: column; gap: 8px; }
  #ai .ai-chat { display: flex; flex-direction: column; gap: 8px; max-height: 34dvh; overflow-y: auto; }
  #ai .ai-chat:empty::before { content: 'Hỏi thêm về hình này, ví dụ: "thêm K là trung điểm SD" hoặc "vì sao MN ∥ CD?"'; color: var(--muted); font-size: 13.5px; line-height: 1.4; }
  #ai .ai-b { max-width: 94%; padding: 8px 10px; border-radius: 12px; font-size: 14.5px; line-height: 1.45; overflow-wrap: anywhere; white-space: pre-wrap; }
  #ai .ai-b.me { align-self: flex-end; background: var(--btn-on); color: #1a1a1a; }
  #ai .ai-b.ai { align-self: flex-start; background: var(--btn); color: var(--text); }
  #ai .ai-b.err { color: #ff9a8a; }
  #ai .ai-b pre { margin: 6px 0; padding: 6px 8px; border-radius: 8px; background: rgba(0, 0, 0, 0.28); color: inherit; font: 13.5px/1.4 system-ui, sans-serif; white-space: pre-wrap; }
  #ai .ai-b .ai-info { margin: 4px 0 0; }
  #ai .ai-b button { margin-top: 6px; min-height: 44px; }
  #ai .ai-ask { display: flex; gap: 8px; align-items: flex-end; }
  #ai #ai-q { flex: 1; min-width: 0; min-height: 46px; max-height: 96px; resize: none; border: 1px solid #2b3a59; border-radius: 12px; background: #121a2a;
    color: var(--text); padding: 11px 12px; font: 15px/1.4 system-ui, sans-serif; }
  #ai #ai-send { min-width: 46px; padding: 0; }
  #ai .ai-end { display: flex; gap: 8px; }
  #ai .ai-end button { flex: 1 1 0; min-width: 0; }
  #ai .ai-edit { display: flex; flex-direction: column; gap: 8px; }
  #ai .ai-hint { margin: 0; font-size: 13.5px; line-height: 1.4; color: var(--muted); }
  #ai .ai-hint mark { background: rgba(255, 204, 77, 0.45); color: inherit; border-radius: 3px; padding: 0 2px; }
  #ai .ai-wrap { position: relative; border: 1px solid #2b3a59; border-radius: 10px; background: #121a2a; }
  #ai-hl, #ai-de { margin: 0; padding: 10px 12px; font: 15px/1.5 system-ui, sans-serif; white-space: pre-wrap; overflow-wrap: anywhere;
    letter-spacing: 0; scrollbar-gutter: stable; }
  #ai-hl { position: absolute; inset: 0; overflow: hidden; color: transparent; pointer-events: none; }
  #ai-hl mark { color: transparent; background: rgba(255, 204, 77, 0.45); border-radius: 3px; }
  #ai-de { position: relative; display: block; width: 100%; min-height: 160px; max-height: 45dvh; resize: vertical; overflow-y: auto;
    border: 0; border-radius: 10px; background: transparent; color: var(--text); }
  #ai .ai-count { margin: -4px 0 0; text-align: right; font-size: 12.5px; color: var(--muted); }
  #ai .ai-info { margin: -4px 0 0; font-size: 12.5px; line-height: 1.4; color: var(--muted); overflow-wrap: anywhere; }
  #ai .ai-info:empty { display: none; }
  #ai .ai-b.ai .ai-info { color: inherit; opacity: 0.75; }
  .code-src { white-space: pre-line; }
  #ai .ai-msg { margin: 0; font-size: 14px; line-height: 1.4; color: #ff9a8a; overflow-wrap: anywhere; }
  #ai .ai-msg:empty { display: none; }
  nav .ai-row { display: flex; gap: 8px; }
  nav #t-ai { min-height: 44px; background: transparent; border: 1px solid var(--accent); color: var(--accent); }
  body.paper #ai .ai-wrap { background: #fff; border-color: #ddd4c0; }
  body.paper #ai-hl mark, body.paper #ai .ai-hint mark { background: rgba(242, 196, 67, 0.6); }
  body.paper #ai .ai-msg, body.paper #ai .ai-b.err, body.paper #ai .ai-lg.loi span, body.paper #ai .ai-chip.loi .i { color: #b3261e; }
  body.paper #ai .ai-chip.xong .i { color: #1b7a35; }
  body.paper #ai #ai-q { background: #fff; border-color: #ddd4c0; }
  body.paper #ai .ai-lg-pre, body.paper #ai .ai-b pre { background: #f1ead9; color: #2b2b2b; }
  body.paper nav #t-ai { color: #6b4700; }
`;

const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
// Tô vàng chỗ không chắc: cả cụm chữ dính liền ngay trước [?] (vd "2NB[?]")
export const markUnsure = text => esc(text).replace(/(\S*?\[\?\])/g, '<mark>$1</mark>') + '\n';
// "http://laptop:8787" → http://laptop:8787/api/<tên>;  "/api" → /api/<tên>
export const endpoint = (api, name) => { const b = String(api || '').replace(/\/+$/, ''); return (/\/api$/.test(b) ? b : b + '/api') + '/' + name; };
const sec = ms => (ms / 1000).toFixed(1).replace('.', ',') + ' s';
// Dòng nhỏ ghi model của từng phần (cũng lưu vào ghi chú của vở):
//   đọc ảnh:  "Gemini <tên model> · 2,3 s"
//   dựng hình: "<nhà>:<model> · 1,9 s · lần 1"  (+ " (Groq lỗi 429 → chuyển sang xKiro)" nếu đã chuyển nấc)
export function dongDoc(r) {
  const m = String(r.model || 'Gemini'), i = m.indexOf(':');
  return (i < 0 ? m : m.slice(0, i) + ' ' + m.slice(i + 1)) + ' · ' + sec(r.thoi_gian || 0);
}
export const dongDungNgan = r => r.model + ' · ' + sec(r.thoi_gian || 0) + ' · lần ' + (r.lan || 1);   // chip: chuyển nấc ghi riêng, ngắn hơn
export function dongDung(r) {
  const chuyen = (r.chuyen || []).map(c => c.tu + ' ' + c.ly_do + ' → chuyển sang ' + c.den).join('; ');
  return dongDungNgan(r) + (chuyen ? ' (' + chuyen + ')' : '');
}
// Ghi chú của vở: chữ đề, rồi các dòng AI (chữ đề cắt bớt nếu ghi chú sắp đầy)
export function ghiChu(de, docInfo, dungInfo, max = 2000) {
  const tail = '\n\n' + (docInfo ? 'AI đọc ảnh: ' + docInfo + '\n' : '') + 'AI dựng hình: ' + dungInfo;
  return de.slice(0, Math.max(0, max - tail.length)) + tail;
}

// ---------------- tiến trình: mỗi bước một "chip" ----------------
// chip = { buoc: 'doc' | 'dung' | 'hoi', trang: 'chay' | 'xong' | 'loi', nha, model, t0, lan, chuyen: [{tu, den, ly_do}], info, loi }
const TEN_BUOC = { doc: 'Đọc ảnh', dung: 'Dựng hình', hoi: 'Trả lời' };
export const chipMoi = (buoc, t = Date.now()) => ({ buoc, trang: 'chay', nha: '', model: '', t0: t, lan: 1, chuyen: [], info: '', loi: '' });
const lyDoNgan = ly => (/429/.test(ly) ? 'bận' : /mạng/.test(ly) ? 'mất mạng' : /máy chủ/.test(ly) ? 'lỗi máy chủ' : /key/.test(ly) ? 'chưa có key'
  : /mã vẫn lỗi/.test(ly) ? 'sai mã' : /cắt/.test(ly) ? 'bị cắt' : 'lỗi');
// Sự kiện từ máy chủ → chip đang chạy
export function chipSuKien(chip, ev) {
  const c = { ...chip, chuyen: chip.chuyen.slice() };
  if (ev.loai === 'gui') { c.nha = ev.nha || c.nha; c.model = ev.model || c.model; c.lan = /lần 2/.test(ev.text || '') ? 2 : 1; }
  else if (ev.loai === 'chuyen') { c.chuyen.push({ tu: ev.tu, den: ev.den, ly_do: ev.ly_do || '' }); c.lan = 1; }
  return c;
}
export const chipXong = (chip, r, info) => ({ ...chip, trang: 'xong', model: r.model || chip.model, lan: r.lan || 1, chuyen: r.chuyen || chip.chuyen, info: info || '' });
export const chipLoi = (chip, msg) => ({ ...chip, trang: 'loi', loi: String(msg || 'lỗi') });
const ghiChuyen = c => c.chuyen.map(x => x.tu + ' ' + lyDoNgan(x.ly_do) + ' → ' + x.den).join('; ');
// Chữ của chip: "Dựng hình · Groq · 3 s" / "Dựng hình · xKiro:qwen/qwen3.8-max:free · 7,9 s · lần 2 · Groq bận → xKiro"
export function chipChu(c, now = Date.now()) {
  const ten = TEN_BUOC[c.buoc] || c.buoc, chuyen = ghiChuyen(c);
  if (c.trang === 'loi') return ten + ' · ' + c.loi;
  if (c.trang === 'xong') return ten + ' · ' + c.info + (chuyen ? ' · ' + chuyen : '');
  return ten + ' · ' + (c.nha || 'đang gửi') + ' · ' + sec(Math.max(0, now - c.t0)) + (c.lan === 2 ? ' · lần 2' : '') + (chuyen ? ' · ' + chuyen : '');
}

// ---------------- nhật ký ----------------
const gio = t => { const d = new Date(t), z = n => String(n).padStart(2, '0'); return z(d.getHours()) + ':' + z(d.getMinutes()) + ':' + z(d.getSeconds()); };
// Một sự kiện → { gio, kieu, chu, noi_dung? }:  "14:05:02  gửi  Gemini gemini-flash-lite  ảnh 412 KB", "nhận ✓ 2,3 s · vào 2720 (cache 2133) / ra 58"
export function dongNhatKy(ev) {
  const ten = ev.nha ? ev.nha + ' ' + ev.model : '';
  const d = { gio: gio(ev.t), kieu: ev.loai, chu: '' };
  if (ev.loai === 'gui') d.chu = 'gửi  ' + ten + '  ' + (ev.text || '');
  else if (ev.loai === 'nhan') {
    const tok = ev.vao != null || ev.ra != null ? ' · vào ' + (ev.vao ?? '?') + (ev.cache != null ? ' (cache ' + ev.cache + ')' : '') + ' / ra ' + (ev.ra ?? '?') : '';
    d.chu = 'nhận ✓ ' + sec(ev.ms || 0) + tok;
    if (ev.noi_dung) d.noi_dung = ev.noi_dung;
  } else if (ev.loai === 'loi') { d.chu = 'lỗi  ' + (ev.nha ? ev.nha + ': ' : '') + ev.text; }
  else if (ev.loai === 'chuyen') d.chu = 'chuyển  ' + (ev.text || ev.tu + ' → ' + ev.den);
  else d.chu = ev.text || '';
  return d;
}
export const nhatKyChu = nk => (nk || []).map(e => { const d = dongNhatKy(e); return d.gio + '  ' + d.chu; }).join('\n');

// ---------------- đọc luồng ndjson ----------------
// Gom chữ nhận dần thành các dòng JSON hoàn chỉnh: trả { dong: [object], du: chữ chưa xong dòng }
export function tachDong(du, them) {
  const parts = (du + them).split('\n'), rest = parts.pop(), out = [];
  for (const l of parts) { if (!l.trim()) continue; try { out.push(JSON.parse(l)); } catch { /* dòng hỏng: bỏ */ } }
  return { dong: out, du: rest };
}

// ---------------- lưu theo vở (khoá riêng, không đổi định dạng vở) ----------------
const KHOA = 'sabcd.ai.', MAX_DONG = 50, MAX_TIN = 40, MAX_NOI = 1500;
export const gonNhatKy = nk => (nk || []).slice(-MAX_DONG).map(e => (typeof e.noi_dung === 'string' && e.noi_dung.length > MAX_NOI ? { ...e, noi_dung: e.noi_dung.slice(0, MAX_NOI) + '…' } : e));
// phien = { chips, nk, chat }; vo = { id, note, name }; storage lỗi / đầy thì bỏ qua (app vẫn chạy)
export function luuPhien(storage, vo, phien) {
  try {
    const chips = (phien.chips || []).filter(c => c.trang !== 'chay').map(c => ({ ...c, t0: 0 }));
    storage.setItem(KHOA + vo.id, JSON.stringify({ v: 1, de: String(vo.note || '').slice(0, 60), ten: String(vo.name || ''), chips, nk: gonNhatKy(phien.nk), chat: (phien.chat || []).slice(-MAX_TIN) }));
    return true;
  } catch { return false; }
}
export function docPhien(storage, vo) {
  try {
    const p = JSON.parse(storage.getItem(KHOA + vo.id));
    if (!p || p.v !== 1 || !Array.isArray(p.nk) || !Array.isArray(p.chat) || !Array.isArray(p.chips)) return null;
    if (p.de !== String(vo.note || '').slice(0, 60) && p.ten !== String(vo.name || '')) return null;   // vở khác dùng lại chỗ này
    return { chips: p.chips, nk: p.nk.slice(-MAX_DONG), chat: p.chat.slice(-MAX_TIN) };
  } catch { return null; }
}
// Xoá dữ liệu của vở đã không còn (exists(id) → bool)
export function donPhien(storage, exists) {
  try {
    const ks = [];
    for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (k && k.startsWith(KHOA)) ks.push(k); }
    for (const k of ks) if (!exists(k.slice(KHOA.length))) storage.removeItem(k);
  } catch { /* bỏ qua */ }
}
// Hội thoại → lich_su gửi máy chủ: [{ hoi, dap }] (6 lượt gần nhất; lượt lỗi bỏ)
export function lichSu(chat) {
  const out = [];
  for (let i = 0; i < chat.length - 1; i++) {
    const q = chat[i], a = chat[i + 1];
    if (q.vai !== 'toi' || a.vai !== 'ai' || a.loai === 'loi') continue;
    const dap = a.loai === 'sua' ? 'Đã đề xuất thêm: ' + String(a.dong || '').trim().split('\n').join('; ') + (a.da_them ? ' (đã thêm vào hình)' : ' (chưa thêm)') : String(a.text || '');
    out.push({ hoi: q.text, dap: dap.slice(0, 600) });
  }
  return out.slice(-6);
}

// Nén ảnh trên máy trước khi gửi: cạnh dài ≤ 1600 px, JPEG chất lượng 0,8 (ảnh chụp 4–12 MB → ~200–500 KB)
async function shrink(file) {
  let src, w, h;
  try {
    src = await createImageBitmap(file, { imageOrientation: 'from-image' });
    w = src.width; h = src.height;
  } catch {
    const url = URL.createObjectURL(file);
    try {
      src = await new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(new Error('bad')); im.src = url; });
    } catch { throw new Error('Không mở được ảnh này. Chọn ảnh JPEG / PNG khác.'); } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
    w = src.naturalWidth; h = src.naturalHeight;
  }
  const k = Math.min(1, MAX_SIDE / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(src, 0, 0, c.width, c.height);
  if (src.close) src.close();
  return c.toDataURL('image/jpeg', JPEG_Q);
}

// cfg: nội dung ai/rieng.json
// app: { build(text, { de, from, note }) → Promise<bool>, say(text, warn), icons,
//        vo() → { id, note, name } | null (vở đang mở), maDe() → chữ .sabcd của hình đang dựng, addLines(text) → Promise<{ ok, n | loi }>,
//        storage (localStorage hoặc giả), coVo(id) → bool }
export function initAI(cfg, app) {
  if (document.getElementById('ai')) return null;
  const I = app.icons;
  const style = document.createElement('style');
  style.id = 'ai-css';
  style.textContent = CSS;
  document.head.appendChild(style);

  // Nút trong tab Dựng: nằm cạnh "Gõ lệnh"
  const kbd = document.getElementById('t-kbd');
  const open = document.createElement('button');
  open.id = 't-ai';
  I.set(open, 'camera', 'Đề bài (AI)');
  open.title = 'Chụp ảnh hoặc dán chữ đề, AI viết mã đề để dựng hình; hỏi thêm về hình';
  if (kbd) {
    const row = document.createElement('div');
    row.className = 'ai-row';
    kbd.before(row);
    row.append(kbd, open);
  }

  const box = document.createElement('div');
  box.id = 'ai';
  box.hidden = true;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-labelledby', 'ai-title');
  box.innerHTML = `
    <div class="dlg-card ai-card">
      <div class="ai-top"><b id="ai-title">Đề bài (AI)</b><button id="ai-x" class="ghost" aria-label="Đóng">${I.svg('x')}</button></div>
      <div class="ai-pick">
        <button id="ai-photo">${I.svg('camera')}<span>Chụp / chọn ảnh</span></button>
        <button id="ai-paste">${I.svg('clipboard-paste')}<span>Dán chữ</span></button>
      </div>
      <input id="ai-file" type="file" accept="image/*" hidden>
      <div class="ai-prog" hidden>
        <button id="ai-chips" class="ai-chips" aria-expanded="false" aria-controls="ai-log" aria-live="polite" title="Bấm để xem nhật ký"></button>
        <button id="ai-cancel" class="ghost" hidden>Huỷ</button>
      </div>
      <div id="ai-log" class="ai-log" hidden></div>
      <div class="ai-edit" hidden>
        <p id="ai-hint" class="ai-hint"></p>
        <div class="ai-wrap"><div id="ai-hl" aria-hidden="true"></div><textarea id="ai-de" maxlength="${MAX_DE}" spellcheck="false" aria-label="Chữ đề bài: sửa lại cho đúng rồi bấm Dựng hình" placeholder="Dán chữ đề vào đây (mỗi ý một dòng)"></textarea></div>
        <p id="ai-count" class="ai-count"></p>
        <button id="ai-go" class="main">${I.svg('pencil-ruler')}<span>Dựng hình</span></button>
      </div>
      <div class="ai-result" hidden>
        <div id="ai-chat" class="ai-chat" aria-live="polite"></div>
        <div class="ai-ask">
          <textarea id="ai-q" rows="1" maxlength="${MAX_HOI}" spellcheck="false" aria-label="Hỏi thêm về hình" placeholder="Hỏi thêm về hình…"></textarea>
          <button id="ai-send" class="main" aria-label="Gửi câu hỏi">${I.svg('send')}</button>
        </div>
        <div class="ai-end">
          <button id="ai-see" class="main">${I.svg('eye')}<span>Xem hình</span></button>
          <button id="ai-new" class="ghost">${I.svg('plus')}<span>Đề mới</span></button>
        </div>
      </div>
      <p id="ai-msg" class="ai-msg" role="alert"></p>
    </div>`;
  document.body.appendChild(box);
  const $ = id => document.getElementById(id);
  const ta = $('ai-de'), hl = $('ai-hl'), msg = $('ai-msg'), file = $('ai-file'), qa = $('ai-q');
  const pick = box.querySelector('.ai-pick'), prog = box.querySelector('.ai-prog'), edit = box.querySelector('.ai-edit'), result = box.querySelector('.ai-result');
  const logEl = $('ai-log'), chatEl = $('ai-chat'), chipsEl = $('ai-chips');
  const store = app.storage;
  let ctl = null;       // AbortController của lượt đang chờ
  let timer = 0;        // đồng hồ đếm giây của chip đang chạy
  let mode = 'pick';    // 'pick' | 'edit' | 'result'
  let S = { id: null, chips: [], nk: [], chat: [] };   // phiên của vở đang xem: chip tiến trình, nhật ký, hội thoại

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const running = () => S.chips.some(c => c.trang === 'chay');
  const say = t => { msg.textContent = t || ''; };

  // ---------------- vẽ ----------------
  function paint() {
    hl.innerHTML = markUnsure(ta.value);
    hl.scrollTop = ta.scrollTop;
    $('ai-count').textContent = ta.value.length + '/' + MAX_DE;
    $('ai-go').disabled = !ta.value.trim();
  }
  function renderChips() {
    chipsEl.textContent = '';
    for (const c of S.chips) {
      const row = el('span', 'ai-chip ' + c.trang);
      if (c.trang === 'chay') row.append(el('span', 'ai-spin'));
      else row.insertAdjacentHTML('afterbegin', I.svg(c.trang === 'xong' ? 'check' : 'x'));
      row.append(el('span', 'ai-chip-t', chipChu(c)));
      chipsEl.append(row);
    }
    chipsEl.insertAdjacentHTML('beforeend', I.svg('chevron-down'));
    prog.hidden = !S.chips.length;
    $('ai-cancel').hidden = !running();
    $('ai-new').disabled = $('ai-send').disabled = running();
    if (!logEl.hidden) renderLog();
  }
  function renderLog() {
    logEl.textContent = '';
    if (!S.nk.length) logEl.append(el('p', 'ai-hint', 'Chưa có nhật ký.'));
    for (const ev of S.nk) {
      const d = dongNhatKy(ev);
      if (d.noi_dung) {
        const b = el('button', 'ai-lg ' + d.kieu);
        b.append(el('time', '', d.gio), el('span', '', d.chu));
        b.setAttribute('aria-expanded', 'false');
        const pre = el('pre', 'ai-lg-pre', d.noi_dung);
        pre.hidden = true;
        b.addEventListener('click', () => { pre.hidden = !pre.hidden; b.setAttribute('aria-expanded', String(!pre.hidden)); });
        logEl.append(b, pre);
      } else {
        const r = el('div', 'ai-lg ' + d.kieu);
        r.append(el('time', '', d.gio), el('span', '', d.chu));
        logEl.append(r);
      }
    }
    const act = el('div', 'ai-log-act');
    const cp = el('button', 'ghost');
    cp.insertAdjacentHTML('afterbegin', I.svg('copy'));
    cp.append(el('span', '', 'Sao chép nhật ký'));
    cp.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(nhatKyChu(S.nk)); say('Đã sao chép nhật ký.'); } catch { say('Chưa chép được nhật ký: giữ ngón tay trên chữ để chép.'); }
    });
    act.append(cp);
    logEl.append(act);
  }
  function renderChat() {
    chatEl.textContent = '';
    S.chat.forEach(m => {
      if (m.vai === 'toi') { chatEl.append(el('div', 'ai-b me', m.text)); return; }
      const b = el('div', 'ai-b ai' + (m.loai === 'loi' ? ' err' : ''));
      if (m.text) b.append(document.createTextNode(m.text));
      const lines = m.loai === 'sua' ? m.dong : m.goi_y;
      if (lines) {
        b.append(el('div', '', m.loai === 'sua' ? 'Sẽ thêm vào hình:' : 'Gợi ý dựng:'), el('pre', '', lines.trim()));
        if ((m.xem || []).length) b.append(el('div', '', 'Kết quả: ' + m.xem.join('; ')));
        if (m.da_them) b.append(el('div', 'ai-info', 'Đã thêm vào hình (hoàn tác bằng nút Hoàn tác).'));
        else {
          const add = el('button', 'main');
          add.insertAdjacentHTML('afterbegin', I.svg('plus'));
          add.append(el('span', '', 'Thêm vào hình'));
          add.addEventListener('click', () => them(m, lines, add));
          b.append(add);
          if (m.loi_them) b.append(el('div', 'ai-b err', m.loi_them));
        }
      }
      if (m.info) b.append(el('p', 'ai-info', m.info));
      chatEl.append(b);
    });
    chatEl.scrollTop = chatEl.scrollHeight;
  }
  function view(next) {   // 'pick' | 'wait' (chỉ tiến trình) | 'edit' | 'result'  (tiến trình hiện khi có chip, ở mọi màn)
    mode = next;
    pick.hidden = next !== 'pick';
    edit.hidden = next !== 'edit';
    result.hidden = next !== 'result';
    renderChips();
  }
  const home = () => (S.id != null ? 'result' : ta.value ? 'edit' : 'pick');   // màn quay về sau khi huỷ
  function hint(unsure) {
    const h = $('ai-hint');
    if (unsure) h.innerHTML = 'Chỗ <mark>tô vàng [?]</mark> là chữ AI đọc chưa chắc: sửa cho đúng đề, xoá dấu [?], rồi bấm Dựng hình.';
    else h.textContent = 'Soát lại chữ đề (sửa được), rồi bấm Dựng hình.';
  }
  function tick(on) {
    clearInterval(timer);
    timer = on ? setInterval(() => { if (!box.hidden) renderChips(); }, 500) : 0;
  }
  function save() {
    const vo = S.id != null && app.vo();
    if (vo && vo.id === S.id && store) { luuPhien(store, vo, S); donPhien(store, id => app.coVo(id)); }
  }

  // ---------------- gọi máy chủ (có tiến trình) ----------------
  // onEv(sự kiện) được gọi khi máy chủ đẩy tiến trình; trả về kết quả cuối. Lỗi: Error (có .nhat_ky nếu máy chủ gửi)
  async function call(name, body, ms, onEv) {
    const c = ctl = new AbortController();   // nút Huỷ / Đóng đặt ctl = null: giữ bản riêng của lượt này
    const t = setTimeout(() => c.abort('het-gio'), ms);
    let res;
    try {
      res = await fetch(endpoint(cfg.api, name), { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' }, body: JSON.stringify(body), signal: c.signal });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && /ndjson/.test(ct)) {
        let final = null, du = '', got = false;
        const nhan = chunk => { const x = tachDong(du, chunk); du = x.du; for (const o of x.dong) { if (o.su_kien) { got = true; onEv && onEv(o.su_kien); } else final = o; } };
        if (res.body && res.body.getReader) {
          const rd = res.body.getReader(), dec = new TextDecoder();
          for (;;) { const { done, value } = await rd.read(); if (done) break; nhan(dec.decode(value, { stream: true })); }
          nhan(dec.decode() + '\n');
        } else nhan((await res.text()) + '\n');
        if (!final) throw Object.assign(new Error('Máy chủ AI ngắt giữa chừng, thử lại.'), { thieu: true });
        if (final.loi) throw Object.assign(new Error(final.loi), { nhat_ky: final.nhat_ky, daDay: got });
        if (ctl === c) ctl = null;
        return { ...final.ket_qua, daDay: got };
      }
    } catch (e) {
      if (ctl === c) ctl = null;
      if (c.signal.aborted) throw new Error(c.signal.reason === 'het-gio' ? 'Máy chủ AI trả lời quá lâu, thử lại sau.' : '');
      if (e.nhat_ky !== undefined || e.thieu) throw e;
      throw new Error(navigator.onLine === false ? 'Mất mạng: kiểm tra Wi-Fi / 4G rồi thử lại.'
        : 'Không kết nối được máy chủ AI. Ở nhà: laptop phải đang chạy node ai/proxy.js, cùng Wi-Fi. Ở trường: kiểm tra 4G, tải lại trang nếu đã lâu chưa đăng nhập.');
    } finally { clearTimeout(t); }
    // không phải luồng: JSON thường (lỗi sớm hoặc máy chủ cũ)
    let j = null;
    try { j = await res.json(); } catch { /* không phải JSON: thường là trang đăng nhập Cloudflare Access */ }
    if (c.signal.aborted) throw new Error('');
    if (ctl === c) ctl = null;
    if (!j) throw new Error(res.ok || res.redirected ? 'Phiên đăng nhập đã hết: tải lại trang để đăng nhập lại.' : 'Máy chủ AI lỗi (' + res.status + '), thử lại sau.');
    if (!res.ok) throw Object.assign(new Error(j.loi || 'Máy chủ AI lỗi (' + res.status + ')'), { nhat_ky: j.nhat_ky });
    return j;
  }
  // Chạy một bước có chip: chip mới ở cuối S.chips; sự kiện vào nhật ký + chip; xong / lỗi đổi trạng thái
  async function chayBuoc(buoc, name, body, ms, info) {
    const mine = S;
    let chip = chipMoi(buoc);
    const doi = f => { const k = mine.chips.indexOf(chip); if (k >= 0) { chip = f(chip); mine.chips[k] = chip; } };
    const nkDau = mine.nk.length;
    mine.chips.push(chip);
    renderChips();
    tick(true);
    try {
      const r = await call(name, body, ms, ev => { mine.nk.push(ev); doi(c => chipSuKien(c, ev)); if (S === mine) renderChips(); });
      if (!r.daDay && Array.isArray(r.nhat_ky)) mine.nk.push(...r.nhat_ky);
      doi(c => chipXong(c, r, info(r)));
      return r;
    } catch (e) {
      if (e.nhat_ky && mine.nk.length === nkDau && !e.daDay) mine.nk.push(...e.nhat_ky);
      doi(c => chipLoi(c, e.message || 'đã huỷ'));
      throw e;
    } finally { tick(false); mine.nk = mine.nk.slice(-MAX_DONG); if (S === mine) renderChips(); }
  }
  // Huỷ / Đóng giữa chừng: bỏ chip đang chạy, không để dấu vết lỗi
  function bo() {
    if (ctl) { ctl.abort('huy'); ctl = null; }
    S.chips = S.chips.filter(c => c.trang !== 'chay');
    tick(false);
  }

  async function readPhoto(f) {
    say('');
    const mine = S = { id: null, chips: [{ ...chipMoi('doc'), nha: 'nén ảnh' }], nk: [], chat: [] };
    view('wait');
    let anh;
    try { anh = await shrink(f); } catch (e) { if (S === mine) { S.chips = []; view('pick'); say(e.message); } return; }
    if (S !== mine || !mine.chips.length) return;   // đã huỷ lúc nén
    mine.chips = [];
    try {
      const r = await chayBuoc('doc', 'doc-anh', { anh }, WAIT_ANH, dongDoc);
      ta.value = String(r.de || '').slice(0, MAX_DE);
      hint((r.khong_chac || []).length > 0 || ta.value.includes('[?]'));
      view('edit');
      paint();
    } catch (e) {
      if (S !== mine) return;
      if (!e.message) { S.chips = []; view(home()); return; }   // Huỷ: nút Huỷ đã đổi màn
      view(ta.value ? 'edit' : 'pick');
      say(e.message);
    }
  }

  async function build() {
    const de = ta.value.trim();
    if (!de) return;
    if (de.includes('[?]')) { say('Còn chỗ [?] chưa soát: sửa cho đúng đề rồi xoá dấu [?].'); return; }
    say('');
    const doc = S.chips.find(c => c.buoc === 'doc' && c.trang === 'xong');
    const mine = S = { id: null, chips: doc ? [doc] : [], nk: S.nk, chat: [] };
    view('wait');
    let r;
    try { r = await chayBuoc('dung', 'dung', { de }, WAIT_DUNG, dongDungNgan); } catch (e) {
      if (S !== mine) return;
      if (!e.message) mine.chips = doc ? [doc] : [];   // Huỷ: bỏ chip lỗi
      view('edit');
      if (e.message) say(e.message);
      return;
    }
    if (S !== mine) return;
    const dung = dongDung(r), docInfo = doc ? doc.info : '';
    const from = (docInfo ? 'Đọc ảnh: ' + docInfo + '\n' : '') + 'Dựng hình: ' + dung;
    const ok = await app.build(r.sabcd, { de, from, note: ghiChu(de, docInfo, dung) });
    if (!ok) { say('Chưa dựng hình từ mã AI viết. Bấm Dựng hình để thử lại.'); view('edit'); return; }
    const vo = app.vo();
    S.id = vo ? vo.id : null;
    if (S.id == null) { close(); return; }
    ta.value = '';
    paint();
    renderChat();
    view('result');
    save();
  }

  // ---------------- hỏi thêm ----------------
  async function ask() {
    const q = qa.value.trim();
    if (!q || running()) return;
    const ma = app.maDe();
    if (!ma) { say('Chưa có hình để hỏi thêm.'); return; }
    say('');
    qa.value = '';
    grow();
    const mine = S;
    mine.chat.push({ vai: 'toi', text: q });
    mine.chips = [];
    renderChat();
    try {
      const r = await chayBuoc('hoi', 'hoi-them', { ma_de: ma, cau_hoi: q, lich_su: lichSu(mine.chat.slice(0, -1)) }, WAIT_DUNG, dongDungNgan);
      mine.chat.push({ vai: 'ai', loai: r.loai, text: r.tra_loi || '', dong: r.dong || '', goi_y: r.goi_y || '', xem: r.xem_truoc || [], info: dongDung(r), da_them: false });
    } catch (e) {
      if (!e.message) { mine.chat.pop(); mine.chips = []; if (S === mine) { qa.value = q; grow(); } }   // Huỷ: trả câu hỏi về ô nhập
      else mine.chat.push({ vai: 'ai', loai: 'loi', text: e.message });
    }
    if (S !== mine) return;
    renderChat();
    renderChips();
    save();
  }
  async function them(m, lines, btn) {
    btn.disabled = true;
    const r = await app.addLines(lines);
    if (r.ok) { m.da_them = true; m.loi_them = ''; app.say('Đã thêm ' + r.n + ' dòng vào hình'); } else m.loi_them = r.loi;
    renderChat();
    save();
  }
  const grow = () => { qa.style.height = 'auto'; qa.style.height = Math.min(96, qa.scrollHeight) + 'px'; };

  // ---------------- mở / đóng ----------------
  function show() {
    say('');
    box.hidden = false;
    if (!running() && mode !== 'edit') {   // mở lại: nạp phiên đã lưu của vở đang mở (nếu có)
      const vo = app.vo(), p = store && vo ? docPhien(store, vo) : null;
      if (p) { S = { id: vo.id, ...p }; renderChat(); view('result'); }
      else if (S.id != null && (!vo || vo.id !== S.id)) { S = { id: null, chips: [], nk: [], chat: [] }; logEl.hidden = true; view('pick'); }
    }
    if (mode === 'edit') paint();
    (mode === 'pick' ? $('ai-photo') : mode === 'edit' ? ta : qa).focus({ preventScroll: true });
  }
  function close() {
    if (running()) { bo(); view(home()); }
    box.hidden = true;
  }

  open.addEventListener('click', show);
  $('ai-x').addEventListener('click', close);
  box.addEventListener('click', e => { if (e.target === box && !running()) close(); });
  box.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  $('ai-cancel').addEventListener('click', () => { bo(); view(home()); say('Đã huỷ.'); });
  chipsEl.addEventListener('click', () => {
    logEl.hidden = !logEl.hidden;
    chipsEl.setAttribute('aria-expanded', String(!logEl.hidden));
    if (!logEl.hidden) renderLog();
  });
  $('ai-photo').addEventListener('click', () => file.click());
  file.addEventListener('change', () => { const f = file.files && file.files[0]; file.value = ''; if (f) readPhoto(f); });
  $('ai-paste').addEventListener('click', async () => {
    say('');
    hint(false);
    view('edit');
    let t = '';
    if (!ta.value) { try { t = await navigator.clipboard.readText(); } catch { /* không được đọc bộ nhớ tạm: tự dán */ } }
    if (t) ta.value = t.slice(0, MAX_DE);
    paint();
    ta.focus();
  });
  ta.addEventListener('input', () => { paint(); if (msg.textContent) say(''); });
  ta.addEventListener('scroll', () => { hl.scrollTop = ta.scrollTop; });
  $('ai-go').addEventListener('click', build);
  $('ai-send').addEventListener('click', ask);
  qa.addEventListener('input', grow);
  qa.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(); } });
  $('ai-see').addEventListener('click', close);
  $('ai-new').addEventListener('click', () => {
    S = { id: null, chips: [], nk: [], chat: [] };
    ta.value = '';
    logEl.hidden = true;
    chipsEl.setAttribute('aria-expanded', 'false');
    say('');
    renderChat();
    view('pick');
  });
  return { show, close };
}
