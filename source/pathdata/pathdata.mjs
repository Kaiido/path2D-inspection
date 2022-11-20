// internal use only
import * as geom from "../geometry/geometry.mjs";
import SvgPath from "../externals/svgpath/index.mjs";
import { PathSegment } from "./pathsegment.mjs";
import {
  internalPathDataSymbol,
  createDOMMatrixFrom2DInit,
  isValid2DDOMMatrix
} from "../utils.mjs";

const SVGPathData_commands = {
  Z: (instance) =>
    instance.closePath(),
  M: (instance, params) =>
    instance.moveTo(...params),
  L: (instance, params) =>
    instance.lineTo(...params),
  H: (instance, [ x, ...extraParams ]) =>
    instance.lineTo(x, instance.lastPoint.y, ...extraParams),
  V: (instance, params) =>
    instance.lineTo(instance.lastPoint.x, ...params),
  C: (instance, params) =>
    instance.bezierCurveTo(...params),
  Q: (instance, params) =>
    instance.quadraticCurveTo(...params)
};

class PathData extends Array {
  constructor(data = "") {
    super();
    this.needNewSubpath = true;
    if (typeof data === "string") {
      const parsed = new SvgPath(data)
        .abs()
        .unshort()
        .unarc();

      if (!Array.isArray(parsed.segments)) {
        return;
      }

      this.lastPoint = { x: NaN, y: NaN };

      for (const [ command, ...params ] of parsed.segments) {
        const op = SVGPathData_commands[command];
        if (typeof op === "function") {
          op(this, params);
        }
      }
    }
    else if (data && isNaN(data)) {
      // ok to throw on non iterables
      for (const { type, values } of data) {
        /*
         * The specs are unclear as to what should happen if we input bullshit here
         * The current path-data-polyfill (https://github.com/jarek-foksa/path-data-polyfill)
         * does just append the bullshit to the 'd' attribute. We do the same.
         */
        this.push(new PathSegment(type, values));
        this.lastPoint = data.lastPoint;
      }
    }
  }
  isEmpty() {
    return !this.length;
  }
  stringify() {
    return this.map((path_seg) => path_seg.stringify()).join("");
  }
  toExternal() {
    return this.map((path_seg) => path_seg.toExternal());
  }
  ensureThereIsASubpath(x, y) {
    if (this.needNewSubPath) {
      this.moveTo(x, y);
    }
  }
  addPath(path, mat) {
    if (typeof mat !== "object" && mat !== undefined) {
      throw new TypeError("Path2D.addPath: Argument 2 can't be converted to a dictionary.");
    }
    // https://drafts.fxtf.org/geometry/#create-a-dommatrix-from-the-2d-dictionary
    const matrix = createDOMMatrixFrom2DInit(mat);
    // https://html.spec.whatwg.org/multipage/canvas.html#dom-path2d-addpath (step 3)
    if (!isValid2DDOMMatrix(matrix)) {
      return;
    }
    // See #1
    // new Path2D(<SVG-string>) will decompose Arcs to bezier curves
    // This allows us to workaround an issue transforming Arcs
    const decomposed = new Path2D(path.toSVGString());
    const pathdata = decomposed[internalPathDataSymbol];
    for (let seg of pathdata) {
      this.push(seg.transform(matrix));
    }
  }
  getPathData() {
    // clone to Array
    return Array.from(this).map(({ type, values }) => ({ type, values }));
  }
}
Object.assign(PathData.prototype, geom);

export default PathData;
