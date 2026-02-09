// Topographic contour background using Simplex noise + Marching squares
(function () {
    const canvas = document.getElementById('contours');
    const ctx = canvas.getContext('2d');

    const CELL = 7;
    const LEVELS = 40;
    const LINE_COLOR = 'rgba(255, 255, 255, 0.03)';
    const BG_COLOR = '#171717';
    const Z_SPEED = 0.0000015;
    const FRAME_INTERVAL = 80; // ~12 fps

    let cols, rows, zOff = 0, lastFrame = 0;

    // --- Simplex noise (2D/3D) ---
    const F3 = 1 / 3, G3 = 1 / 6;
    const grad3 = [
        [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
        [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
        [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
    ];
    const perm = new Uint8Array(512);
    (function () {
        const p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) p[i] = i;
        for (let i = 255; i > 0; i--) {
            const j = (Math.random() * (i + 1)) | 0;
            const t = p[i]; p[i] = p[j]; p[j] = t;
        }
        for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    })();

    function dot3(g, x, y, z) { return g[0]*x + g[1]*y + g[2]*z; }

    function noise3D(x, y, z) {
        const s = (x + y + z) * F3;
        const i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
        const t = (i + j + k) * G3;
        const X0 = x - (i - t), Y0 = y - (j - t), Z0 = z - (k - t);
        let i1, j1, k1, i2, j2, k2;
        if (X0 >= Y0) {
            if (Y0 >= Z0) { i1=1;j1=0;k1=0;i2=1;j2=1;k2=0; }
            else if (X0 >= Z0) { i1=1;j1=0;k1=0;i2=1;j2=0;k2=1; }
            else { i1=0;j1=0;k1=1;i2=1;j2=0;k2=1; }
        } else {
            if (Y0 < Z0) { i1=0;j1=0;k1=1;i2=0;j2=1;k2=1; }
            else if (X0 < Z0) { i1=0;j1=1;k1=0;i2=0;j2=1;k2=1; }
            else { i1=0;j1=1;k1=0;i2=1;j2=1;k2=0; }
        }
        const x1=X0-i1+G3, y1=Y0-j1+G3, z1=Z0-k1+G3;
        const x2=X0-i2+2*G3, y2=Y0-j2+2*G3, z2=Z0-k2+2*G3;
        const x3=X0-1+3*G3, y3=Y0-1+3*G3, z3=Z0-1+3*G3;
        const ii=i&255, jj=j&255, kk=k&255;
        let n = 0;
        let t0 = 0.6 - X0*X0 - Y0*Y0 - Z0*Z0;
        if (t0 > 0) { t0 *= t0; n += t0*t0 * dot3(grad3[perm[ii+perm[jj+perm[kk]]]%12], X0, Y0, Z0); }
        let t1 = 0.6 - x1*x1 - y1*y1 - z1*z1;
        if (t1 > 0) { t1 *= t1; n += t1*t1 * dot3(grad3[perm[ii+i1+perm[jj+j1+perm[kk+k1]]]%12], x1, y1, z1); }
        let t2 = 0.6 - x2*x2 - y2*y2 - z2*z2;
        if (t2 > 0) { t2 *= t2; n += t2*t2 * dot3(grad3[perm[ii+i2+perm[jj+j2+perm[kk+k2]]]%12], x2, y2, z2); }
        let t3 = 0.6 - x3*x3 - y3*y3 - z3*z3;
        if (t3 > 0) { t3 *= t3; n += t3*t3 * dot3(grad3[perm[ii+1+perm[jj+1+perm[kk+1]]]%12], x3, y3, z3); }
        return 32 * n; // range ~ [-1, 1]
    }

    // --- Resize ---
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        cols = Math.ceil(canvas.width / CELL) + 1;
        rows = Math.ceil(canvas.height / CELL) + 1;
    }

    // --- Build noise field ---
    function buildField(z) {
        const field = new Float32Array(cols * rows);
        const scale = 0.0006;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const v = noise3D(c * CELL * scale, r * CELL * scale, z);
                field[r * cols + c] = (v + 1) * 0.5; // normalize to [0, 1]
            }
        }
        return field;
    }

    // --- Marching squares ---
    function lerp(a, b, t) { return a + (b - a) * t; }

    function drawContours(field) {
        ctx.fillStyle = BG_COLOR;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = LINE_COLOR;
        ctx.lineWidth = 1;

        for (let lvl = 1; lvl < LEVELS; lvl++) {
            const threshold = lvl / LEVELS;
            ctx.beginPath();

            for (let r = 0; r < rows - 1; r++) {
                for (let c = 0; c < cols - 1; c++) {
                    const tl = field[r * cols + c];
                    const tr = field[r * cols + c + 1];
                    const br = field[(r + 1) * cols + c + 1];
                    const bl = field[(r + 1) * cols + c];

                    const idx =
                        (tl >= threshold ? 8 : 0) |
                        (tr >= threshold ? 4 : 0) |
                        (br >= threshold ? 2 : 0) |
                        (bl >= threshold ? 1 : 0);

                    if (idx === 0 || idx === 15) continue;

                    const x = c * CELL, y = r * CELL;

                    // Interpolated edge midpoints
                    const tT = (threshold - tl) / (tr - tl);
                    const tR = (threshold - tr) / (br - tr);
                    const tB = (threshold - bl) / (br - bl);
                    const tL = (threshold - tl) / (bl - tl);

                    const top = [lerp(x, x + CELL, tT), y];
                    const right = [x + CELL, lerp(y, y + CELL, tR)];
                    const bottom = [lerp(x, x + CELL, tB), y + CELL];
                    const left = [x, lerp(y, y + CELL, tL)];

                    const segments = [];
                    switch (idx) {
                        case  1: segments.push(bottom, left); break;
                        case  2: segments.push(right, bottom); break;
                        case  3: segments.push(right, left); break;
                        case  4: segments.push(top, right); break;
                        case  5: segments.push(top, left); segments.push(right, bottom); break;
                        case  6: segments.push(top, bottom); break;
                        case  7: segments.push(top, left); break;
                        case  8: segments.push(left, top); break;
                        case  9: segments.push(bottom, top); break;
                        case 10: segments.push(left, bottom); segments.push(top, right); break;
                        case 11: segments.push(right, top); break;
                        case 12: segments.push(left, right); break;
                        case 13: segments.push(right, bottom); break;
                        case 14: segments.push(bottom, left); break;
                    }

                    for (let s = 0; s < segments.length; s += 2) {
                        ctx.moveTo(segments[s][0], segments[s][1]);
                        ctx.lineTo(segments[s + 1][0], segments[s + 1][1]);
                    }
                }
            }
            ctx.stroke();
        }
    }

    // --- Animation loop ---
    function animate(now) {
        requestAnimationFrame(animate);
        if (now - lastFrame < FRAME_INTERVAL) return;
        lastFrame = now;
        zOff += Z_SPEED * FRAME_INTERVAL;
        const field = buildField(zOff);
        drawContours(field);
    }

    // --- Init ---
    resize();
    window.addEventListener('resize', resize);
    requestAnimationFrame(animate);
})();
