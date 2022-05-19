/*
 * based on
 * https://source.chromium.org/chromium/chromium/src/+/main:third_party/d3/src/d3.js?q=arcTo&ss=chromium%2Fchromium%2Fsrc
 */

import { PathSegment } from "../pathdata/pathsegment.mjs";
import {
  epsilon,
  allAreFinite,
  almostEqual
} from "../utils.mjs";

export function arcTo(x1, y1, x2, y2, radius) {
  if (!allAreFinite([ x1, y1, x2, y2, radius ])) {
    return;
  }
  this.ensureThereIsASubpath(x1, y1);
  if (radius < 0) {
    throw new DOMException("radii cannot be negative", "IndexSizeError");
  }

  const { lastPoint } = this;
  const x0 = lastPoint.x;
  const y0 = lastPoint.y;

  const x21 = x2 - x1;
  const y21 = y2 - y1;
  const x01 = x0 - x1;
  const y01 = y0 - y1;
  const l01_2 = x01 * x01 + y01 * y01;

  if (this.isEmpty()) {
    this.moveTo(x1, y1);
  }
  // Or, is (x1,y1) coincident with (x0,y0)? Do nothing.
  else if (l01_2 <= epsilon) {
    return;
  }
  // Or, are (x0,y0), (x1,y1) and (x2,y2) collinear?
  // Equivalently, is (x1,y1) coincident with (x2,y2)?
  // Or, is the radius zero? Line to (x1,y1).
  else if (almostEqual(y01 * x21, y21 * x01) || !radius) {
    this.lineTo(x1, y1);
  }
  // Otherwise, draw an arc
  else {
    const x20 = x2 - x0;
    const y20 = y2 - y0;
    const l21_2 = x21 * x21 + y21 * y21;
    const l20_2 = x20 * x20 + y20 * y20;
    const l21 = Math.sqrt(l21_2);
    const l01 = Math.sqrt(l01_2);
    const adjacent = l21_2 + l01_2 - l20_2;
    const hypot = 2 * l21 * l01;
    const arccosine = Math.acos(adjacent / hypot);
    const l = radius * Math.tan((Math.PI - arccosine) / 2);
    const t01 = l / l01;
    const t21 = l / l21;

    // If the start tangent is not coincident with (x0,y0), line to.
    if (!almostEqual(t01, 1)) {
      this.lineTo((x1 + t01 * x01), (y1 + t01 * y01));
    }

    const sweep = y01 * x20 > x01 * y20 ? 1 : 0;
    const endX = lastPoint.x = x1 + t21 * x21;
    const endY = lastPoint.y = y1 + t21 * y21;

    this.push(new PathSegment("A", [ radius, radius, 0, 0, sweep, endX, endY ]));
  }
}
