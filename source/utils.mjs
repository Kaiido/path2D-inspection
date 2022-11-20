/* eslint brace-style: [ 2, "stroustrup", { allowSingleLine: true } ] */
const tau = Math.PI * 2;
const epsilon = 1e-6;
function abs(val) { return Math.abs(val); }
function deg(rad) { return rad * 180 / Math.PI; }
function rad(deg) { return deg * Math.PI / 180; }
function allAreFinite(args) {
  return !args.some((arg) => arg !== undefined && !Number.isFinite(arg));
}
function almostEqual(floata, floatb) {
  // using d3.js's "epsilon" instead of CanvasKit's 1e-5
  return abs(floata - floatb) < epsilon;
}

const currentPathSymbol = Symbol("currentPath");
const internalPathDataSymbol = Symbol("pathData");

// DOMMatrix.fromMatrix() will validate and fixup the dict
// By extracting only the 2D properties we actually end up with
// a validate and fixup 2D dict.
// The error message will say fromMatrix instead of addPath, but that's ok.
function createDOMMatrixFrom2DInit(val) {
  if (!val || typeof val !== "object") {
    return new DOMMatrix();
  }
  const {
    a, b, c, d, e, f,
    m11, m12, m21, m22, m41, m42
  } = val;
  const dict2D = {
    is2D: true,
    a, b, c, d, e, f,
    m11, m12, m21, m22, m41, m42
  };
  return DOMMatrix.fromMatrix(dict2D);
}
function isValid2DDOMMatrix(mat) {
  return [ "m11", "m12", "m21", "m22", "m41", "m42" ]
    .every((key) => Number.isFinite(mat[key]));
}

export {
  tau,
  abs,
  deg,
  rad,
  epsilon,
  allAreFinite,
  almostEqual,
  currentPathSymbol,
  internalPathDataSymbol,
  createDOMMatrixFrom2DInit,
  isValid2DDOMMatrix
};
