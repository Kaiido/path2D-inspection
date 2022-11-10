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

export {
  tau,
  abs,
  deg,
  rad,
  epsilon,
  allAreFinite,
  almostEqual,
  currentPathSymbol,
  internalPathDataSymbol
};
