import { PathSegment } from "../pathdata/pathsegment.mjs";
import { allAreFinite } from "../utils.mjs";

export function bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {

  if (!allAreFinite([ cp1x, cp1y, cp2x, cp2y, x, y ])) {
    return;
  }
  this.ensureThereIsASubpath(cp1x, cp1y);
  this.push(new PathSegment("C", [ cp1x, cp1y, cp2x, cp2y, x, y ]));

  const { lastPoint } = this;
  lastPoint.x = x;
  lastPoint.y = y;

}
