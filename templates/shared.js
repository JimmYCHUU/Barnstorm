// Shared by every template: photo placement (focus + zoom), blur boxes, readiness and overflow measuring.
// The renderer calls window.draw(card), waits for window.__ready, then calls window.measure().

window.__ready = false;

// Place <img> inside its stage so the focus point (0-100 %) stays in view at the given zoom.
// Blur boxes are stored in % of the natural image, so they follow any crop.
// Where a photo of nw x nh goes in a W x H stage: cover (focus + zoom) or contain (the whole photo, in the middle).
window.fitPhoto = function (nw, nh, W, H, photo) {
  const contain = photo.fit === 'contain';
  const s = contain ? Math.min(W / nw, H / nh) : Math.max(W / nw, H / nh) * Math.max(1, photo.zoom || 1);
  const dw = nw * s, dh = nh * s;
  const fx = photo.focus ? photo.focus.x : 50, fy = photo.focus ? photo.focus.y : 50;
  return { contain, dw, dh, left: contain ? (W - dw) / 2 : -(dw - W) * fx / 100, top: contain ? (H - dh) / 2 : -(dh - H) * fy / 100 };
};

// How busy part of the picture is: the mean change in brightness between neighbouring pixels inside r = {x, y, w, h}, with the
// photo drawn at `at` ({left, top, dw, dh}). On Jim's auction photos a plain wall scores under 1; a car's body, a window, a
// shutter or an auction house's own label 2 to 12.
window.busyness = function (img, at, r) {
  const c = document.createElement('canvas');
  c.width = r.w; c.height = r.h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, at.left - r.x, at.top - r.y, at.dw, at.dh);
  const d = g.getImageData(0, 0, r.w, r.h).data, L = new Float32Array(r.w * r.h);
  for (let i = 0; i < L.length; i++) L[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
  let sum = 0;
  for (let y = 0; y < r.h - 1; y++) for (let x = 0; x < r.w - 1; x++) { const i = y * r.w + x; sum += Math.abs(L[i + 1] - L[i]) + Math.abs(L[i + r.w] - L[i]); }
  return sum / ((r.w - 1) * (r.h - 1));
};

window.placePhoto = function (stage, photo) {
  return new Promise((resolve) => {
    const img = stage.querySelector('img.car');
    const done = () => {
      const W = stage.clientWidth, H = stage.clientHeight, nw = img.naturalWidth, nh = img.naturalHeight;
      // contain: the whole photo in the middle of its stage, with the backdrop showing equally above and below
      const { contain, dw, dh, left, top } = window.fitPhoto(nw, nh, W, H, photo);
      Object.assign(img.style, { width: dw + 'px', height: dh + 'px', left: left + 'px', top: top + 'px' });
      for (const b of photo.blur || []) {
        const d = document.createElement('div');
        d.className = 'blur';
        Object.assign(d.style, { left: left + b.x / 100 * dw + 'px', top: top + b.y / 100 * dh + 'px',
          width: b.w / 100 * dw + 'px', height: b.h / 100 * dh + 'px' });
        // A box clicked corner by corner (a plate seen at an angle) blurs only inside its four corners.
        if (b.pts?.length === 4 && b.w > 0 && b.h > 0) {
          d.style.clipPath = `polygon(${b.pts.map((p) => `${(p.x - b.x) / b.w * 100}% ${(p.y - b.y) / b.h * 100}%`).join(', ')})`;
          d.style.borderRadius = '0';
        }
        stage.appendChild(d);
      }
      // Where the photo landed in its stage: a photo wider or taller than the stage is cut off where it overhangs.
      const drawn = { left: Math.round(left) || 0, top: Math.round(top) || 0, width: Math.round(dw), height: Math.round(dh) };
      resolve({ w: nw, h: nh, fit: contain ? 'contain' : 'cover', drawn });
    };
    if (img.complete && img.naturalWidth) done(); else { img.onload = done; img.onerror = () => resolve({ w: 0, h: 0 }); }
  });
};

window.esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Elements tagged data-fit="name" must not overflow their box: a line a little too long is first set smaller, down to
// 80% of its size, and only then reported. The card must not overflow 1080x1080.
window.measure = function () {
  const over = [];
  for (const el of document.querySelectorAll('[data-fit]')) {
    const base = parseFloat(getComputedStyle(el).fontSize);
    for (let size = base; el.scrollWidth > el.clientWidth + 1 && size > base * 0.8;) { size -= 1; el.style.fontSize = `${size}px`; }
    if (el.scrollWidth > el.clientWidth + 1) over.push(el.dataset.fit);
  }
  for (const el of document.querySelectorAll('[data-box]')) {
    if (el.scrollHeight > el.clientHeight + 1) over.push(el.dataset.box);
  }
  return [...new Set(over)];
};

window.finish = async function (photoInfo) {
  await document.fonts.ready;
  window.__photo = photoInfo;
  window.__ready = true;
};
