// GORILLA - photoreal reel symbols (transparent webp, 1x for the paytable, 2x for the canvas reels). window.GorillaSymbols
(function () {
  const V = '6', CODES = ['SB', 'MK', 'TC', 'ID', 'BN', 'RB', 'EM', 'SP', 'WD', 'CN', 'DR'];
  const SCALE = { RB: .8, EM: .8, SP: .8, WD: 1, CN: .9, DR: 1, SB: .98, LOCK: .86, CHAIN: 1.12, FI: 1 }; // optical size inside a cell
  const url = (c, x2) => {
    const tag = x2 ? '@2x' : '';
    if (c === 'FI') return `/gorilla/media/v4/art/FI${tag}.webp?v=6`;
    if (c === 'DR') return `/gorilla/media/v4/art/wheel${tag}.webp?v=6`; // Temple Wheel badge (the trigger symbol on the reels)
    if (c === 'CHAIN') return `/gorilla/media/v4/art/chains${tag}.webp?v=6`;
    return `/gorilla/media/v3/sym/${c}${tag}.webp?v=${V}`;
  };
  const img = {}, ready = Promise.all([...CODES, 'LOCK', 'CHAIN', 'FI'].map(c => new Promise(r => { const i = new Image(); i.decoding = 'async'; i.onload = i.onerror = () => r(); i.src = url(c, true); img[c] = i; })));
  window.GorillaSymbols = { get: c => url(c, false), img, ready, codes: CODES, scale: c => SCALE[c] || .92, useCustom() {} };
})();
