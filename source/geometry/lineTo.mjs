import { PathSegment } from "../pathdata/pathsegment.mjs";
import { allAreFinite } from "../utils.mjs";

export function lineTo(x, y) {

  if (this.isEmpty()) {
    this.moveTo(x, y);
    return;
  }
  if (!allAreFinite([ x, y ])) {
    return;
  }
  this.push(new PathSegment("L", [ x, y ]));

  const { lastPoint } = this;
  lastPoint.x = x;
  lastPoint.y = y;

  return;

}
