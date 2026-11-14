// Test client-side vectorizer logic
function formatCoord(n, scale, precision) {
  return (n / scale).toFixed(precision);
}

function perpendicularDistance(pt, lineStart, lineEnd) {
  let dx = lineEnd.x - lineStart.x;
  let dy = lineEnd.y - lineStart.y;
  const mag = Math.hypot(dx, dy);
  if (mag === 0) return Math.hypot(pt.x - lineStart.x, pt.y - lineStart.y);
  return Math.abs(dy * pt.x - dx * pt.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x) / mag;
}

function rdpSimplify(points, epsilon) {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let index = 0;
  const last = points.length - 1;
  for (let i = 1; i < last; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[last]);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }
  if (maxDist > epsilon) {
    const left = rdpSimplify(points.slice(0, index + 1), epsilon);
    const right = rdpSimplify(points.slice(index), epsilon);
    return left.slice(0, left.length - 1).concat(right);
  } else {
    return [points[0], points[last]];
  }
}

function traceContourLoops(mask, width, height) {
  const visited = new Uint8Array(width * height);
  const contours = [];
  const dx = [1, 1, 0, -1, -1, -1, 0, 1];
  const dy = [0, 1, 1, 1, 0, -1, -1, -1];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (mask[idx] && !visited[idx]) {
        const isBoundary = !mask[idx - 1] || !mask[idx + 1] || !mask[idx - width] || !mask[idx + width];
        if (!isBoundary) continue;

        const points = [];
        let cx = x, cy = y;
        let dir = 0;
        let startX = x, startY = y;
        let stepCount = 0;
        const maxSteps = width * height;

        do {
          points.push({ x: cx, y: cy });
          visited[cy * width + cx] = 1;

          let found = false;
          let checkDir = (dir + 5) % 8;
          for (let i = 0; i < 8; i++) {
            const nd = (checkDir + i) % 8;
            const nx = cx + dx[nd];
            const ny = cy + dy[nd];
            if (nx >= 0 && nx < width && ny >= 0 && ny < height && mask[ny * width + nx]) {
              cx = nx;
              cy = ny;
              dir = nd;
              found = true;
              break;
            }
          }

          if (!found) break;
          stepCount++;
        } while ((cx !== startX || cy !== startY) && stepCount < maxSteps);

        if (points.length >= 4) {
          contours.push(points);
        }
      }
    }
  }
  return contours;
}

function contourToPathString(points, scale, precision, smoothness) {
  if (points.length < 3) return '';
  const smoothFactor = Math.max(0.0, Math.min(1.0, smoothness / 100));

  if (smoothFactor < 0.05 || points.length < 4) {
    // Sharp polygon path
    const parts = [`M ${formatCoord(points[0].x, scale, precision)} ${formatCoord(points[0].y, scale, precision)}`];
    for (let i = 1; i < points.length; i++) {
      parts.push(`L ${formatCoord(points[i].x, scale, precision)} ${formatCoord(points[i].y, scale, precision)}`);
    }
    parts.push('Z');
    return parts.join(' ');
  }

  // Smooth cubic Bézier spline (Catmull-Rom to Cubic Bézier)
  const parts = [`M ${formatCoord(points[0].x, scale, precision)} ${formatCoord(points[0].y, scale, precision)}`];
  const len = points.length;
  for (let i = 0; i < len; i++) {
    const p0 = points[(i - 1 + len) % len];
    const p1 = points[i];
    const p2 = points[(i + 1) % len];
    const p3 = points[(i + 2) % len];

    const cp1x = p1.x + ((p2.x - p0.x) / 6) * smoothFactor * 1.5;
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * smoothFactor * 1.5;
    const cp2x = p2.x - ((p3.x - p1.x) / 6) * smoothFactor * 1.5;
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * smoothFactor * 1.5;

    parts.push(
      `C ${formatCoord(cp1x, scale, precision)} ${formatCoord(cp1y, scale, precision)}, ${formatCoord(cp2x, scale, precision)} ${formatCoord(cp2y, scale, precision)}, ${formatCoord(p2.x, scale, precision)} ${formatCoord(p2.y, scale, precision)}`
    );
  }
  parts.push('Z');
  return parts.join(' ');
}

// Test with 30x30 circle
const w = 60, h = 60;
const mask = new Uint8Array(w * h);
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const dist = Math.hypot(x - 30, y - 30);
    if (dist <= 20) mask[y * w + x] = 1;
  }
}

const contours = traceContourLoops(mask, w, h);
console.log('Contours found:', contours.length, 'Points:', contours[0].length);
const simplified = rdpSimplify(contours[0], 0.8);
console.log('Simplified to:', simplified.length);
const path = contourToPathString(simplified, 1.0, 1, 70);
console.log('SVG Path sample:', path.slice(0, 150), '...');

