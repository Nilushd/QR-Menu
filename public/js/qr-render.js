/* QRRender — draws styled QR codes as SVG (and PNG via canvas). Needs qrcode-generator (window.qrcode). */
(function () {
  const f = n => +n.toFixed(3);

  // Rounded rectangle path with per-corner radii [tl, tr, br, bl]
  function rr(x, y, w, h, r) {
    const [a, b, c, d] = (Array.isArray(r) ? r : [r, r, r, r]).map(v => Math.min(v, w / 2, h / 2));
    return `M${f(x + a)} ${f(y)}H${f(x + w - b)}${b ? `A${f(b)} ${f(b)} 0 0 1 ${f(x + w)} ${f(y + b)}` : ''}V${f(y + h - c)}` +
      `${c ? `A${f(c)} ${f(c)} 0 0 1 ${f(x + w - c)} ${f(y + h)}` : ''}H${f(x + d)}${d ? `A${f(d)} ${f(d)} 0 0 1 ${f(x)} ${f(y + h - d)}` : ''}` +
      `V${f(y + a)}${a ? `A${f(a)} ${f(a)} 0 0 1 ${f(x + a)} ${f(y)}` : ''}Z`;
  }
  const circle = (cx, cy, r) => `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
  function star(cx, cy, R, r, pts = 5) {
    let d = '';
    for (let i = 0; i < pts * 2; i++) {
      const a = Math.PI / pts * i - Math.PI / 2, rad = i % 2 ? r : R;
      d += (i ? 'L' : 'M') + f(cx + Math.cos(a) * rad) + ' ' + f(cy + Math.sin(a) * rad);
    }
    return d + 'Z';
  }
  function heart(x, y, s) {
    const P = (px, py) => `${f(x + px * s)} ${f(y + py * s)}`;
    return `M${P(.5, .92)}C${P(.12, .64)} ${P(0, .44)} ${P(0, .3)}C${P(0, .12)} ${P(.14, 0)} ${P(.29, 0)}C${P(.4, 0)} ${P(.47, .06)} ${P(.5, .15)}` +
      `C${P(.53, .06)} ${P(.6, 0)} ${P(.71, 0)}C${P(.86, 0)} ${P(1, .12)} ${P(1, .3)}C${P(1, .44)} ${P(.88, .64)} ${P(.5, .92)}Z`;
  }
  const diamond = (cx, cy, h) => `M${f(cx)} ${f(cy - h)}L${f(cx + h)} ${f(cy)}L${f(cx)} ${f(cy + h)}L${f(cx - h)} ${f(cy)}Z`;
  const plus = (cx, cy, h, t) => `M${f(cx - t)} ${f(cy - h)}h${f(2 * t)}v${f(h - t)}h${f(h - t)}v${f(2 * t)}h${f(t - h)}v${f(h - t)}h${f(-2 * t)}v${f(t - h)}h${f(t - h)}v${f(-2 * t)}h${f(h - t)}Z`;
  const hash = (r, c) => { const x = Math.sin(r * 127.1 + c * 311.7) * 43758.5453; return x - Math.floor(x); };

  const DOTS = ['square', 'rounded', 'dots', 'smooth', 'classy', 'diamond', 'star', 'heart', 'plus', 'vlines', 'hlines', 'random'];
  const EYE_FRAMES = ['square', 'rounded', 'circle', 'leaf', 'drop', 'dotted'];
  const EYE_BALLS = ['square', 'rounded', 'circle', 'leaf', 'drop', 'diamond', 'star', 'heart'];

  function dotsPath(dark, n, shape, s) {
    const o = (1 - s) / 2;
    let d = '';
    if (shape === 'vlines' || shape === 'hlines') {
      const v = shape === 'vlines';
      for (let a = 0; a < n; a++) {
        let start = -1;
        for (let b = 0; b <= n; b++) {
          const on = b < n && (v ? dark(b, a) : dark(a, b));
          if (on && start < 0) start = b;
          if (!on && start >= 0) {
            const len = b - start, w = s * .78, off = (1 - w) / 2;
            d += v ? rr(a + off, start + .06, w, len - .12, w / 2) : rr(start + .06, a + off, len - .12, w, w / 2);
            start = -1;
          }
        }
      }
      return d;
    }
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (!dark(r, c)) continue;
      const cx = c + .5, cy = r + .5;
      switch (shape) {
        case 'rounded': d += rr(c + o, r + o, s, s, s * .32); break;
        case 'dots': d += circle(cx, cy, s / 2); break;
        case 'smooth': {
          const t = dark(r - 1, c), b = dark(r + 1, c), l = dark(r, c - 1), rt = dark(r, c + 1);
          d += rr(c, r, 1, 1, [!t && !l ? .5 : 0, !t && !rt ? .5 : 0, !b && !rt ? .5 : 0, !b && !l ? .5 : 0]); break;
        }
        case 'classy': {
          const t = dark(r - 1, c), b = dark(r + 1, c), l = dark(r, c - 1), rt = dark(r, c + 1);
          d += rr(c, r, 1, 1, [!t && !l ? .55 : 0, 0, !b && !rt ? .55 : 0, 0]); break;
        }
        case 'diamond': d += diamond(cx, cy, s * .6); break;
        case 'star': d += star(cx, cy, s * .62, s * .33); break;
        case 'heart': d += heart(c + o, r + o + s * .04, s); break;
        case 'plus': d += plus(cx, cy, s / 2, s * .23); break;
        case 'random': d += circle(cx, cy, s / 2 * (.62 + .38 * hash(r, c))); break;
        default: d += `M${f(c + o)} ${f(r + o)}h${f(s)}v${f(s)}h${f(-s)}Z`;
      }
    }
    return d;
  }

  // corner: which corner of the eye faces the QR centre — 2 = bottom-right, 3 = bottom-left, 1 = top-right
  function eyeFrame(x, y, shape, corner) {
    const sharp = (R, k) => R.map((v, i) => i === k ? 0 : v);
    switch (shape) {
      case 'rounded': return rr(x, y, 7, 7, 2.2) + rr(x + 1, y + 1, 5, 5, 1.4);
      case 'circle': return circle(x + 3.5, y + 3.5, 3.5) + circle(x + 3.5, y + 3.5, 2.5);
      case 'leaf': return rr(x, y, 7, 7, [3, 0, 3, 0]) + rr(x + 1, y + 1, 5, 5, [2, 0, 2, 0]);
      case 'drop': return rr(x, y, 7, 7, sharp([2.8, 2.8, 2.8, 2.8], corner)) + rr(x + 1, y + 1, 5, 5, sharp([1.8, 1.8, 1.8, 1.8], corner));
      case 'dotted': {
        let d = '';
        for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) if (i === 0 || j === 0 || i === 6 || j === 6) d += circle(x + j + .5, y + i + .5, .46);
        return d;
      }
      default: return rr(x, y, 7, 7, 0) + rr(x + 1, y + 1, 5, 5, 0);
    }
  }
  function eyeBall(x, y, shape, corner) {
    const cx = x + 1.5, cy = y + 1.5;
    switch (shape) {
      case 'rounded': return rr(x, y, 3, 3, .9);
      case 'circle': return circle(cx, cy, 1.5);
      case 'leaf': return rr(x, y, 3, 3, [1.5, 0, 1.5, 0]);
      case 'drop': return rr(x, y, 3, 3, [1.5, 1.5, 1.5, 1.5].map((v, i) => i === corner ? 0 : v));
      case 'diamond': return diamond(cx, cy, 1.85);
      case 'star': return star(cx, cy, 2.1, 1.3, 8);
      case 'heart': return heart(x - .2, y - .1, 3.4);
      default: return rr(x, y, 3, 3, 0);
    }
  }

  function buildMatrix(data, ecl) {
    const q = qrcode(0, ecl); q.addData(data); q.make();
    const n = q.getModuleCount();
    return { n, isDark: (r, c) => q.isDark(r, c) };
  }

  /**
   * opts: data, ecl, margin (modules), dotShape, dotScale, dotColor, dotColor2, gradient ('none'|'linear'|'radial'), gradAngle (deg),
   *       eyeFrame, eyeBall, eyeFrameColor, eyeBallColor, bgColor ('transparent' allowed),
   *       logo (data URL), logoSize (0..0.32 of width), logoShape ('original'|'rounded'|'circle'), logoPlate (bool)
   */
  const eclFor = o => o.logo ? (Math.min(o.logoSize || .25, .32) > .24 ? 'H' : (o.ecl === 'H' ? 'H' : 'Q')) : (o.ecl || 'Q');
  const count = o => buildMatrix(o.data || ' ', eclFor(o)).n;

  function toSVG(o, size = 512) {
    const logoSize = o.logo ? Math.min(o.logoSize || .25, .32) : 0;
    const M = o.matrix || buildMatrix(o.data || ' ', eclFor(o));
    const n = M.n, m = o.margin ?? 0, eyes = o.matrix ? [] : [[0, 0, 2], [0, n - 7, 3], [n - 7, 0, 1]];
    const inEye = (r, c) => eyes.some(([er, ec]) => r >= er && r < er + 7 && c >= ec && c < ec + 7);
    const lw = n * logoSize, lx = (n - lw) / 2, pad = o.logoPlate ? .5 : .15;
    const inLogo = (r, c) => lw > 0 && c + 1 > lx - pad && c < lx + lw + pad && r + 1 > lx - pad && r < lx + lw + pad;
    const dark = (r, c) => r >= 0 && c >= 0 && r < n && c < n && M.isDark(r, c) && !inEye(r, c) && !inLogo(r, c);

    const id = 'q' + Math.random().toString(36).slice(2, 8);
    let defs = '', fill = o.dotColor || '#000';
    if (o.gradient === 'linear' || o.gradient === 'radial') {
      const stops = `<stop offset="0" stop-color="${o.dotColor}"/><stop offset="1" stop-color="${o.dotColor2 || o.dotColor}"/>`;
      if (o.gradient === 'radial') defs += `<radialGradient id="${id}g" gradientUnits="userSpaceOnUse" cx="${n / 2}" cy="${n / 2}" r="${f(n * .72)}">${stops}</radialGradient>`;
      else {
        const a = (o.gradAngle ?? 45) * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a), L = n / 2 * (Math.abs(dx) + Math.abs(dy));
        defs += `<linearGradient id="${id}g" gradientUnits="userSpaceOnUse" x1="${f(n / 2 - dx * L)}" y1="${f(n / 2 - dy * L)}" x2="${f(n / 2 + dx * L)}" y2="${f(n / 2 + dy * L)}">${stops}</linearGradient>`;
      }
      fill = `url(#${id}g)`;
    }
    const eyeFill = c => c === 'gradient' ? fill : c;
    let body = '';
    if (o.bgColor && o.bgColor !== 'transparent') body += `<rect x="${-m}" y="${-m}" width="${n + 2 * m}" height="${n + 2 * m}" fill="${o.bgColor}"/>`;
    body += `<path fill="${fill}" d="${dotsPath(dark, n, o.dotShape || 'square', o.dotScale ?? .9)}"/>`;
    let ef = '', eb = '';
    for (const [er, ec, corner] of eyes) { ef += eyeFrame(ec, er, o.eyeFrame, corner); eb += eyeBall(ec + 2, er + 2, o.eyeBall, corner); }
    if (ef) body += `<path fill-rule="evenodd" fill="${eyeFill(o.eyeFrameColor || o.dotColor)}" d="${ef}"/><path fill="${eyeFill(o.eyeBallColor || o.dotColor)}" d="${eb}"/>`;
    if (lw > 0) {
      const shape = o.logoShape || 'original';
      const rad = shape === 'circle' ? lw / 2 + pad : shape === 'rounded' ? lw * .22 : .4;
      if (o.logoPlate) body += `<path fill="${o.bgColor === 'transparent' ? '#fff' : o.bgColor}" d="${rr(lx - pad, lx - pad, lw + 2 * pad, lw + 2 * pad, rad)}"/>`;
      if (shape !== 'original') defs += `<clipPath id="${id}c"><path d="${shape === 'circle' ? circle(n / 2, n / 2, lw / 2) : rr(lx, lx, lw, lw, lw * .18)}"/></clipPath>`;
      body += `<image href="${o.logo}" x="${f(lx)}" y="${f(lx)}" width="${f(lw)}" height="${f(lw)}" preserveAspectRatio="xMidYMid ${shape === 'original' ? 'meet' : 'slice'}"${shape !== 'original' ? ` clip-path="url(#${id}c)"` : ''}/>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${-m} ${-m} ${n + 2 * m} ${n + 2 * m}" shape-rendering="geometricPrecision">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`;
  }

  async function toImage(o, size) {
    const url = URL.createObjectURL(new Blob([toSVG(o, size)], { type: 'image/svg+xml' }));
    const img = new Image(); img.src = url;
    try { await img.decode(); } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
    return img;
  }

  // Small sample tiles for the style pickers
  const SAMPLE = ['1101100', '0111011', '1100110', '1011101', '0110011', '1101110', '0011011'];
  function swatch(o, kind, size = 48) {
    if (kind === 'dots') {
      const matrix = { n: 7, isDark: (r, c) => SAMPLE[r][c] === '1' };
      return toSVG({ ...o, logo: null, matrix, margin: .5 }, size);
    }
    const isFrame = kind === 'eyeFrame';
    const d = isFrame ? eyeFrame(0, 0, o.eyeFrame, 2) : eyeBall(2, 2, o.eyeBall, 2);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="-1 -1 9 9"><path fill-rule="evenodd" fill="${o.color}" d="${d}"/>${isFrame ? '' : `<path fill-rule="evenodd" fill="${o.color}" opacity=".25" d="${eyeFrame(0, 0, 'square', 2)}"/>`}</svg>`;
  }

  window.QRRender = { toSVG, toImage, swatch, count, DOTS, EYE_FRAMES, EYE_BALLS };
})();
