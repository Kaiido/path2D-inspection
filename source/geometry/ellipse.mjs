import { PathSegment } from "../pathdata/pathsegment.mjs";
import {
  tau,
  abs,
  deg,
  rad,
  allAreFinite,
  almostEqual
} from "../utils.mjs";
/*
 * based on
 * https://source.chromium.org/chromium/chromium/src/+/main:third_party/skia/modules/canvaskit/htmlcanvas/path2d.js
 * and https://observablehq.com/@toja/ellipse-and-elliptical-arc-conversion
 */
function getEllipsePointForAngle(cx, cy, rx, ry, phi, theta) {
  const { sin, cos } = Math;

  const M = abs(rx) * cos(theta),
        N = abs(ry) * sin(theta);

  return [
    cx + cos(phi) * M - sin(phi) * N,
    cy + sin(phi) * M + cos(phi) * N
  ];
}
function getEndpointParameters(cx, cy, rx, ry, phi, theta, dTheta) {

  const [ x1, y1 ] = getEllipsePointForAngle(cx, cy, rx, ry, phi, theta);
  const [ x2, y2 ] = getEllipsePointForAngle(cx, cy, rx, ry, phi, theta + dTheta);

  const fa = abs(dTheta) > Math.PI ? 1 : 0;
  const fs = dTheta > 0 ? 1 : 0;

  return { x1, y1, x2, y2, fa, fs };
}
function arcToOval(x, y, rx, ry, rotation, startDegrees, deltaDegrees, shouldLineTo) {

  const { x1, y1, x2, y2, fa, fs } = getEndpointParameters(
          x,
          y,
          rx,
          ry,
          rotation,
          rad(startDegrees),
          rad(deltaDegrees)
        ),
        arcSegment = new PathSegment("A", [ rx, ry, deg(rotation), fa, fs, x2, y2 ]),
        { lastPoint } = this;

  if (shouldLineTo) {
    this.lineTo(x1, y1);
  }

  lastPoint.x = x2;
  lastPoint.y = y2;

  this.push(arcSegment);

}

export function ellipse(
  x,
  y,
  radiusX,
  radiusY,
  rotation,
  startAngle,
  endAngle,
  ccw = false
) {

  if (!allAreFinite([
    x,
    y,
    radiusX,
    radiusY,
    rotation,
    startAngle,
    endAngle
  ])) {
    return;
  }
  if (radiusX < 0 || radiusY < 0) {
    throw new DOMException("radii cannot be negative", "IndexSizeError");
  }
  let newStartAngle = startAngle % tau;
  if (newStartAngle <= 0) {
    newStartAngle += tau;
  }

  let delta = newStartAngle - startAngle;
  startAngle = newStartAngle;
  endAngle += delta;

  if (!ccw && (endAngle - startAngle) >= tau) {
    // Draw complete ellipse
    endAngle = startAngle + tau;
  }
  else if (ccw && (startAngle - endAngle) >= tau) {
    // Draw complete ellipse
    endAngle = startAngle - tau;
  }
  else if (!ccw && startAngle > endAngle) {
    endAngle = startAngle + (tau - (startAngle - endAngle) % tau);
  }
  else if (ccw && startAngle < endAngle) {
    endAngle = startAngle - (tau - (endAngle - startAngle) % tau);
  }

  let sweepDegrees = deg(endAngle - startAngle);
  let startDegrees = deg(startAngle);

  // draw in 2 180 degree segments because trying to draw all 360 degrees at once
  // draws nothing.
  if (almostEqual(abs(sweepDegrees), 360)) {
    const halfSweep = sweepDegrees / 2;
    arcToOval.call(
      this,
      x,
      y,
      radiusX,
      radiusY,
      rotation,
      startDegrees,
      halfSweep,
      true
    );
    arcToOval.call(
      this,
      x,
      y,
      radiusX,
      radiusY,
      rotation,
      startDegrees + halfSweep,
      halfSweep,
      false
    );
  }
  else {
    arcToOval.call(
      this,
      x,
      y,
      radiusX,
      radiusY,
      rotation,
      startDegrees,
      sweepDegrees,
      true
    );
  }

}
