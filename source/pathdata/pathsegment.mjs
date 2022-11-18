// dictionary representing every x-y vectors of every segment types
// used for transformation
const pointsMap = {
  Z: [],
  L: [ { x: 0, y: 1 } ],
  M: [ { x: 0, y: 1 } ],
  A: [ { x: 0, y: 1 }, { x: 5, y: 6 } ], // Doesn't work
  C: [ { x: 0, y: 1 }, { x: 2, y: 3 }, { x: 4, y: 5 } ],
  Q: [ { x: 0, y: 1 }, { x: 2, y: 3 } ]
};

// internal use only
export class PathSegment {
  constructor(type, values = []) {
    this.type = type;
    this.values = values.slice();
  }
  stringify() {
    return this.type + this.values.join(" ");
  }
  toExternal() {
    const { type, values } = this;
    return { type, values: values.slice() };
  }
  transformSelf(mat) {
    return transformSegment(this, mat, this);
  }
  transform(mat) {
    return transformSegment(this, mat);
  }
}

/* eslint no-use-before-define: "off" */
function transformSegment(source, mat, target) {
  const { values, type } = source;
  if (!target) {
    target = new PathSegment(type, values);
  }
  if (!(mat instanceof DOMMatrix)) {
    return target;
  }
  const pointsIndices = pointsMap[type];
  for (const { x, y } of pointsIndices) {
    const newPt = mat.transformPoint({
      x: values[x],
      y: values[y]
    });
    target.values[x] = newPt.x;
    target.values[y] = newPt.y;
  }
  return target;
}
