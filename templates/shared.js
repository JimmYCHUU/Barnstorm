// Shared by every template: photo placement (focus + zoom), blur boxes, readiness and overflow measuring.
// The renderer calls window.draw(card), waits for window.__ready, then calls window.measure().

window.__ready = false;

// Place <img> inside its stage so the focus point (0-100 %) stays in view at the given zoom.
// Blur boxes are stored in % of the natural image, so they follow any crop.
window.placePhoto = function (stage, photo) {
  return new Promise((resolve) => {
    const img = stage.querySelector('img.car');
    const done = () => {
      const W = stage.clientWidth, H = stage.clientHeight, nw = img.naturalWidth, nh = img.naturalHeight;
      const contain = photo.fit === 'contain';
      const s = contain ? Math.min(W / nw, H / nh) : Math.max(W / nw, H / nh) * Math.max(1, photo.zoom || 1);
      const dw = nw * s, dh = nh * s;
      const fx = photo.focus ? photo.focus.x : 50, fy = photo.focus ? photo.focus.y : 50;
      const left = contain ? (W - dw) / 2 : -(dw - W) * fx / 100, top = contain ? H - dh : -(dh - H) * fy / 100;
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
  // data-lines="n": a line that may wrap, to n lines at most.
  for (const el of document.querySelectorAll('[data-lines]')) {
    const lines = Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight));
    if (lines > Number(el.dataset.lines)) over.push(el.dataset.fit || 'text');
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
