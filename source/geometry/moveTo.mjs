import { PathSegment } from "../pathdata/pathsegment.mjs";
import { allAreFinite } from "../utils.mjs";

export function moveTo(x, y) {

  if (!allAreFinite([ x, y ])) {
    return;
  }

  this.push(new PathSegment("M", [ x, y ]));

  const { lastPoint } = this;
  lastPoint.x = x;
  lastPoint.y = y;

}
