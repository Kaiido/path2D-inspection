import { PathSegment } from "../pathdata/pathsegment.mjs";
import { allAreFinite } from "../utils.mjs";

export function quadraticCurveTo(cpx, cpy, x, y) {

  if (!allAreFinite([ cpx, cpy, x, y ])) {
    return;
  }
  this.ensureThereIsASubpath(cpx, cpy);
  this.push(new PathSegment("Q", [ cpx, cpy, x, y ]));

  const { lastPoint } = this;
  lastPoint.x = x;
  lastPoint.y = y;

}
