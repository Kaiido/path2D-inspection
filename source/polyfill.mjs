import PathData from "./pathdata/pathdata.mjs";
import getBBox from "./externals/bbox/getBBox.mjs";
import { consumers } from "./consumers.mjs";
const Original = globalThis.Path2D;
const path2DMap = new WeakMap();
const pathDataMap = new WeakMap();
const currentPathSymbol = Symbol("currentPath");

if (typeof Original.prototype.getPathData !== "function") {
  class Path2D {
    constructor(...args) {
      const mappedArgs = args.map((value) => value instanceof Path2D ?
        value.getPathData() : value
      );
      pathDataMap.set(this, new PathData(...mappedArgs));
    }
    getPathData() {
      return pathDataMap.get(this);
    }
    setPathData(segments) {
      path2DMap.delete(this);
      pathDataMap.set(this, new PathData(segments));
    }
    toSVGString() {
      return pathDataMap.get(this).stringify();
    }
    getBBox() {
      return getBBox(this.toSVGString());
    }
    get [currentPathSymbol]() {
      let path = path2DMap.get(this);
      if (!path) {
        path = new Original(this.toSVGString());
        path2DMap.set(this, path);
      }
      return path;
    }
    get [Symbol.toStringTag]() {
      return "Path2D";
    }
  }
  for (const key of Object.keys(Original.prototype)) {
    Path2D.prototype[key] = function (...args) {
      const pathData = pathDataMap.get(this);
      pathData[key].call(pathData, ...args);
    };
    Path2D.prototype[key][Symbol.toString] = () =>
/* eslint indent: 0 */
`function ${ key } {
    [native code]
}`;
  }
  Object.defineProperty(globalThis, "Path2D", {
    value: Path2D
  });

  for (const [ target, keys ] of consumers) {
    if (!target) {
      continue;
    }
    for (const key of keys) {
      const originalMethod = target[key];
      target[key] = function (...args) {
        const mappedArgs = args.map((value) => value instanceof Path2D ?
          value[currentPathSymbol] : value
        );
        return originalMethod.apply(this, mappedArgs);
      };
    }
  }
}
export { Original };
