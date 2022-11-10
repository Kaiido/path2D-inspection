import SvgPath from "../svgpath/index.mjs";
import BoundingBox from "./BoundingBox.mjs";

export default function getBBox(d) {
  const pathDriver = new SvgPath(d);
  const boundingBox = new BoundingBox();

  pathDriver
    .abs()
    .unarc()
    .unshort()
    .iterate(function (seg, index, x, y) {

      switch (seg[0]) {
        case "M":
        case "L":
          boundingBox.addPoint(
            seg[1],
            seg[2]
          );
          break;
        case "H":
          boundingBox.addX(seg[1]);
          break;
        case "V":
          boundingBox.addY(seg[1]);
          break;
        case "Q":
          boundingBox.addQuadraticCurve(
            x,
            y,
            seg[1],
            seg[2],
            seg[3],
            seg[4]
          );
          break;
        case "C":
          boundingBox.addBezierCurve(
            x,
            y,
            seg[1],
            seg[2],
            seg[3],
            seg[4],
            seg[5],
            seg[6]
          );
          break;
      }

    });

  const { x1, y1, x2, y2 } = boundingBox;
  const left   = Math.min(x1, x2);
  const top    = Math.min(y1, y2);
  const width  = Math.abs(x1 - x2);
  const height = Math.abs(y1 - y2);

  return new DOMRect(left, top, width, height);
}
