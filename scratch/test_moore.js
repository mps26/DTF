// RDP simplification
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

// Test Moore-Neighbor contour tracing
function traceContours(mask, width, height) {
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

const w = 40, h = 40;
const mask = new Uint8Array(w * h);
for (let y = 10; y < 30; y++) {
  for (let x = 10; x < 30; x++) {
    mask[y * w + x] = 1;
  }
}

const raw = traceContours(mask, w, h);
const simplified = rdpSimplify(raw[0], 0.7);
console.log('Raw points:', raw[0].length, 'Simplified points:', simplified.length);
console.log('Simplified coordinates:', simplified);
