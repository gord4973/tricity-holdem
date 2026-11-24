// GORILLA - photoreal reel symbols (transparent webp, 1x for the paytable, 2x for the canvas reels). window.GorillaSymbols
(function () {
  const V = '4', CODES = ['SB', 'MK', 'TC', 'ID', 'BN', 'RB', 'EM', 'SP', 'WD', 'CN', 'DR'];
  const SCALE = { RB: .8, EM: .8, SP: .8, WD: 1, CN: .9, DR: .96, SB: .98, LOCK: .62, FI: 1 }; // optical size inside a cell
  const url = (c, x2) => c === 'FI' ? `/gorilla/media/v4/art/FI${x2 ? '@2x' : ''}.webp?v=5` : `/gorilla/media/v3/sym/${c}${x2 ? '@2x' : ''}.webp?v=${V}`;
  const img = {}, ready = Promise.all([...CODES, 'LOCK', 'FI'].map(c => new Promise(r => { const i = new Image(); i.decoding = 'async'; i.onload = i.onerror = () => r(); i.src = url(c, true); img[c] = i; })));
  window.GorillaSymbols = { get: c => url(c, false), img, ready, codes: CODES, scale: c => SCALE[c] || .92, useCustom() {} };
})();
