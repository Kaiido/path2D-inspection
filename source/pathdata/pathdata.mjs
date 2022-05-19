// internal use only
import * as geom from "../geometry/geometry.mjs";
import SvgPath from "../externals/svgpath/index.js";
import { PathSegment } from "./pathsegment.mjs";

const SVGPathData_commands = {
  Z: (instance) =>
    instance.closePath(),
  M: (instance, params) =>
    instance.moveTo(...params),
  L: (instance, params) =>
    instance.lineTo(...params),
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
    const pathdata = path.getPathData();
    for (let seg of pathdata) {
      this.push(seg.transform(mat));
    }
  }
  getPathData() {
    // clone to Array
    return Array.from(this).map(({ type, values }) => ({ type, values }));
  }
}
Object.assign(PathData.prototype, geom);

export default PathData;
