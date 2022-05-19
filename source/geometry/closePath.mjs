import { PathSegment } from "../pathdata/pathsegment.mjs";

export function closePath() {
  this.push(new PathSegment("Z"));
}
