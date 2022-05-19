/*
 * This lists all the consumers of Path2D objects,
 * we need to override them so they use the up to date Path2D object.
 * [ method, indexOfPath2DArgument ]
 */
const Context2DProto = globalThis.CanvasRenderingContext2D?.prototype;
const OffscreenContext2DProto = globalThis.OffscreenCanvasRenderingContext2D?.prototype;
const Path2DProto = globalThis.Path2D.prototype;
// beware the globalThis.Path2D constructor is itself a consumer
// it is not part of this list but should be handled separately
export const consumers = [
  [ Context2DProto, [
    "clip",
    "drawFocusIfNeeded",
    "scrollPathIntoView",
    "isPointInPath",
    "isPointInStroke",
    "fill",
    "scrollPathIntoView",
    "stroke"
  ] ],
  [ OffscreenContext2DProto, [
    "clip",
    "isPointInPath",
    "isPointInStroke",
    "fill",
    "stroke"
  ] ],
  [ Path2DProto, [
    "addPath"
  ] ]
];
