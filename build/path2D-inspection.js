(function () {
  'use strict';

  // dictionary representing every x-y vectors of every segment types
  // used for transformation
  const pointsMap = {
    Z: [],
    L: [ { x: 0, y: 1 } ],
    M: [ { x: 0, y: 1 } ],
    A: [ { x: 0, y: 1 }, { x: 5, y: 6 } ],
    C: [ { x: 0, y: 1 }, { x: 2, y: 3 }, { x: 4, y: 5 } ],
    Q: [ { x: 0, y: 1 }, { x: 2, y: 3 } ]
  };

  // internal use only
  class PathSegment {
    constructor(type, values = []) {
      this.type = type;
      this.values = values;
    }
    stringify() {
      return this.type + this.values.join(" ");
    }
    toExternal() {
      const { type, values } = this;
      return { type, values };
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
      target = new PathSegment(type, values.slice());
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

  function closePath() {
    this.push(new PathSegment("Z"));
  }

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

  function lineTo(x, y) {

    if (this.isEmpty()) {
      this.moveTo(x, y);
      return;
    }
    if (!allAreFinite([ x, y ])) {
      return;
    }
    this.push(new PathSegment("L", [ x, y ]));

    const { lastPoint } = this;
    lastPoint.x = x;
    lastPoint.y = y;

    return;

  }

  function moveTo(x, y) {

    if (!allAreFinite([ x, y ])) {
      return;
    }

    this.push(new PathSegment("M", [ x, y ]));

    const { lastPoint } = this;
    lastPoint.x = x;
    lastPoint.y = y;

  }

  function rect(x, y, width, height) {

    this.moveTo(x, y);
    this.lineTo(x + width, y);
    this.lineTo(x + width, y + height);
    this.lineTo(x, y + height);
    this.closePath();

    const { lastPoint } = this;
    lastPoint.x = x;
    lastPoint.y = y;

  }

  /*
   * based on
   * https://source.chromium.org/chromium/chromium/src/+/main:third_party/skia/modules/canvaskit/htmlcanvas/path2d.js
   * and https://observablehq.com/@toja/ellipse-and-elliptical-arc-conversion
   */
  function getEllipsePointForAngle(cx, cy, rx, ry, phi, theta) {
    const { sin, cos } = Math;

    const M = abs(rx) * cos(theta),
          N = abs(ry) * sin(theta);

    return [
      cx + cos(phi) * M - sin(phi) * N,
      cy + sin(phi) * M + cos(phi) * N
    ];
  }
  function getEndpointParameters(cx, cy, rx, ry, phi, theta, dTheta) {

    const [ x1, y1 ] = getEllipsePointForAngle(cx, cy, rx, ry, phi, theta);
    const [ x2, y2 ] = getEllipsePointForAngle(cx, cy, rx, ry, phi, theta + dTheta);

    const fa = abs(dTheta) > Math.PI ? 1 : 0;
    const fs = dTheta > 0 ? 1 : 0;

    return { x1, y1, x2, y2, fa, fs };
  }
  function arcToOval(x, y, rx, ry, rotation, startDegrees, deltaDegrees, shouldLineTo) {

    const { x1, y1, x2, y2, fa, fs } = getEndpointParameters(
            x,
            y,
            rx,
            ry,
            rotation,
            rad(startDegrees),
            rad(deltaDegrees)
          ),
          arcSegment = new PathSegment("A", [ rx, ry, deg(rotation), fa, fs, x2, y2 ]),
          { lastPoint } = this;

    if (shouldLineTo) {
      this.lineTo(x1, y1);
    }

    lastPoint.x = x2;
    lastPoint.y = y2;

    this.push(arcSegment);

  }

  function ellipse(
    x,
    y,
    radiusX,
    radiusY,
    rotation,
    startAngle,
    endAngle,
    ccw = false
  ) {

    if (!allAreFinite([
      x,
      y,
      radiusX,
      radiusY,
      rotation,
      startAngle,
      endAngle
    ])) {
      return;
    }
    if (radiusX < 0 || radiusY < 0) {
      throw new DOMException("radii cannot be negative", "IndexSizeError");
    }
    let newStartAngle = startAngle % tau;
    if (newStartAngle <= 0) {
      newStartAngle += tau;
    }

    let delta = newStartAngle - startAngle;
    startAngle = newStartAngle;
    endAngle += delta;

    if (!ccw && (endAngle - startAngle) >= tau) {
      // Draw complete ellipse
      endAngle = startAngle + tau;
    }
    else if (ccw && (startAngle - endAngle) >= tau) {
      // Draw complete ellipse
      endAngle = startAngle - tau;
    }
    else if (!ccw && startAngle > endAngle) {
      endAngle = startAngle + (tau - (startAngle - endAngle) % tau);
    }
    else if (ccw && startAngle < endAngle) {
      endAngle = startAngle - (tau - (endAngle - startAngle) % tau);
    }

    let sweepDegrees = deg(endAngle - startAngle);
    let startDegrees = deg(startAngle);

    // draw in 2 180 degree segments because trying to draw all 360 degrees at once
    // draws nothing.
    if (almostEqual(abs(sweepDegrees), 360)) {
      const halfSweep = sweepDegrees / 2;
      arcToOval.call(
        this,
        x,
        y,
        radiusX,
        radiusY,
        rotation,
        startDegrees,
        halfSweep,
        true
      );
      arcToOval.call(
        this,
        x,
        y,
        radiusX,
        radiusY,
        rotation,
        startDegrees + halfSweep,
        halfSweep,
        false
      );
    }
    else {
      arcToOval.call(
        this,
        x,
        y,
        radiusX,
        radiusY,
        rotation,
        startDegrees,
        sweepDegrees,
        true
      );
    }

  }

  function arc(x, y, radius, startAngle, endAngle, ccw = false) {
    return this.ellipse(x, y, radius, radius, 0, startAngle, endAngle, ccw);
  }

  function bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {

    if (!allAreFinite([ cp1x, cp1y, cp2x, cp2y, x, y ])) {
      return;
    }
    this.ensureThereIsASubpath(cp1x, cp1y);
    this.push(new PathSegment("C", [ cp1x, cp1y, cp2x, cp2y, x, y ]));

    const { lastPoint } = this;
    lastPoint.x = x;
    lastPoint.y = y;

  }

  function quadraticCurveTo(cpx, cpy, x, y) {

    if (!allAreFinite([ cpx, cpy, x, y ])) {
      return;
    }
    this.ensureThereIsASubpath(cpx, cpy);
    this.push(new PathSegment("Q", [ cpx, cpy, x, y ]));

    const { lastPoint } = this;
    lastPoint.x = x;
    lastPoint.y = y;

  }

  /*
   * based on
   * https://source.chromium.org/chromium/chromium/src/+/main:third_party/d3/src/d3.js?q=arcTo&ss=chromium%2Fchromium%2Fsrc
   */

  function arcTo(x1, y1, x2, y2, radius) {
    if (!allAreFinite([ x1, y1, x2, y2, radius ])) {
      return;
    }
    this.ensureThereIsASubpath(x1, y1);
    if (radius < 0) {
      throw new DOMException("radii cannot be negative", "IndexSizeError");
    }

    const { lastPoint } = this;
    const x0 = lastPoint.x;
    const y0 = lastPoint.y;

    const x21 = x2 - x1;
    const y21 = y2 - y1;
    const x01 = x0 - x1;
    const y01 = y0 - y1;
    const l01_2 = x01 * x01 + y01 * y01;

    if (this.isEmpty()) {
      this.moveTo(x1, y1);
    }
    // Or, is (x1,y1) coincident with (x0,y0)? Do nothing.
    else if (l01_2 <= epsilon) {
      return;
    }
    // Or, are (x0,y0), (x1,y1) and (x2,y2) collinear?
    // Equivalently, is (x1,y1) coincident with (x2,y2)?
    // Or, is the radius zero? Line to (x1,y1).
    else if (almostEqual(y01 * x21, y21 * x01) || !radius) {
      this.lineTo(x1, y1);
    }
    // Otherwise, draw an arc
    else {
      const x20 = x2 - x0;
      const y20 = y2 - y0;
      const l21_2 = x21 * x21 + y21 * y21;
      const l20_2 = x20 * x20 + y20 * y20;
      const l21 = Math.sqrt(l21_2);
      const l01 = Math.sqrt(l01_2);
      const adjacent = l21_2 + l01_2 - l20_2;
      const hypot = 2 * l21 * l01;
      const arccosine = Math.acos(adjacent / hypot);
      const l = radius * Math.tan((Math.PI - arccosine) / 2);
      const t01 = l / l01;
      const t21 = l / l21;

      // If the start tangent is not coincident with (x0,y0), line to.
      if (!almostEqual(t01, 1)) {
        this.lineTo((x1 + t01 * x01), (y1 + t01 * y01));
      }

      const sweep = y01 * x20 > x01 * y20 ? 1 : 0;
      const endX = lastPoint.x = x1 + t21 * x21;
      const endY = lastPoint.y = y1 + t21 * y21;

      this.push(new PathSegment("A", [ radius, radius, 0, 0, sweep, endX, endY ]));
    }
  }

  // https://github.com/Kaiido/roundRect/blob/main/roundRect.js
  function getConstructorName(instance) {

    return Object(instance) === instance &&
        instance instanceof Path2D
      ? "Path2D"
      : instance instanceof globalThis?.CanvasRenderingContext2D
        ? "CanvasRenderingContext2D"
        : instance instanceof globalThis?.OffscreenCanvasRenderingContext2D
          ? "OffscreenCanvasRenderingContext2D"
          : instance?.constructor.name || instance;

  }
  function getErrorMessageHeader(instance) {

    return `Failed to execute 'roundRect' on '${ getConstructorName(instance) }':`;

  }
  function roundRect(x, y, w, h, radii) {

    function toDOMPointInit(value) {

      const { x, y, z, w } = value;
      return { x, y, z, w };

    }
    function toUnrestrictedNumber(value) {

      return +value;

    }
    function parseRadiiArgument(value) {

      /*
       * https://webidl.spec.whatwg.org/#es-union
       * with 'optional (unrestricted double or DOMPointInit
       *   or sequence<(unrestricted double or DOMPointInit)>) radii = 0'
       */

      const type = typeof value;

      if (type === "undefined" || value === null) {

        return [ 0 ];

      }
      if (type === "function") {

        return [ NaN ];

      }
      if (type === "object") {

        if (typeof value[Symbol.iterator] === "function") {

          return [ ...value ].map((elem) => {
            // https://webidl.spec.whatwg.org/#es-union
            // with '(unrestricted double or DOMPointInit)'
            const elemType = typeof elem;
            if (elemType === "undefined" || elem === null) {
              return 0;
            }
            if (elemType === "function") {
              return NaN;
            }
            if (elemType === "object") {
              return toDOMPointInit(elem);
            }
            return toUnrestrictedNumber(elem);
          });

        }

        return [ toDOMPointInit(value) ];

      }

      return [ toUnrestrictedNumber(value) ];

    }
    function toCornerPoint(value) {

      const asNumber = toUnrestrictedNumber(value);
      if (Number.isFinite(asNumber)) {

        return {
          x: asNumber,
          y: asNumber
        };

      }
      if (Object(value) === value) {

        return {
          x: toUnrestrictedNumber(value.x ?? 0),
          y: toUnrestrictedNumber(value.y ?? 0)
        };

      }

      return {
        x: NaN,
        y: NaN
      };

    }
    function fixOverlappingCorners(corners) {

      const [ upperLeft, upperRight, lowerRight, lowerLeft ] = corners;
      const factors = [
        Math.abs(w) / (upperLeft.x + upperRight.x),
        Math.abs(h) / (upperRight.y + lowerRight.y),
        Math.abs(w) / (lowerRight.x + lowerLeft.x),
        Math.abs(h) / (upperLeft.y + lowerLeft.y)
      ];
      const minFactor = Math.min(...factors);
      if (minFactor <= 1) {

        for (const radii of corners) {

          radii.x *= minFactor;
          radii.y *= minFactor;

        }

      }

    }

    if (!([ x, y, w, h ].every((input) => Number.isFinite(input)))) {

      return;

    }

    radii = parseRadiiArgument(radii);

    let upperLeft, upperRight, lowerRight, lowerLeft;

    if (radii.length === 4) {

      upperLeft  = toCornerPoint(radii[0]);
      upperRight = toCornerPoint(radii[1]);
      lowerRight = toCornerPoint(radii[2]);
      lowerLeft  = toCornerPoint(radii[3]);

    }
    else if (radii.length === 3) {

      upperLeft  = toCornerPoint(radii[0]);
      upperRight = toCornerPoint(radii[1]);
      lowerLeft  = toCornerPoint(radii[1]);
      lowerRight = toCornerPoint(radii[2]);

    }
    else if (radii.length === 2) {

      upperLeft  = toCornerPoint(radii[0]);
      lowerRight = toCornerPoint(radii[0]);
      upperRight = toCornerPoint(radii[1]);
      lowerLeft  = toCornerPoint(radii[1]);

    }
    else if (radii.length === 1) {

      upperLeft  = toCornerPoint(radii[0]);
      upperRight = toCornerPoint(radii[0]);
      lowerRight = toCornerPoint(radii[0]);
      lowerLeft  = toCornerPoint(radii[0]);

    }
    else {

      throw new RangeError(
        `${
        getErrorMessageHeader(this)
      } ${
        radii.length
      } is not a valid size for radii sequence.`
      );

    }

    const corners = [ upperLeft, upperRight, lowerRight, lowerLeft ];
    const negativeCorner = corners.find(({ x, y }) => x < 0 || y < 0);

    if (corners.some(({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y))) {

      return;

    }

    if (negativeCorner) {

      throw new RangeError(`${
      getErrorMessageHeader(this)
    } Radius value ${
      negativeCorner
    } is negative.`
      );

    }

    fixOverlappingCorners(corners);

    if (w < 0 && h < 0) {

      this.moveTo(
        x - upperLeft.x,
        y
      );
      this.ellipse(
        x + w + upperRight.x,
        y - upperRight.y,
        upperRight.x,
        upperRight.y,
        0,
        -Math.PI * 1.5,
        -Math.PI
      );
      this.ellipse(
        x + w + lowerRight.x,
        y + h + lowerRight.y,
        lowerRight.x,
        lowerRight.y,
        0,
        -Math.PI,
        -Math.PI / 2
      );
      this.ellipse(
        x - lowerLeft.x,
        y + h + lowerLeft.y,
        lowerLeft.x,
        lowerLeft.y,
        0,
        -Math.PI / 2,
        0
      );
      this.ellipse(
        x - upperLeft.x,
        y - upperLeft.y,
        upperLeft.x,
        upperLeft.y,
        0,
        0,
        -Math.PI / 2
      );

    }
    else if (w < 0) {

      this.moveTo(
        x - upperLeft.x,
        y
      );
      this.ellipse(
        x + w + upperRight.x,
        y + upperRight.y,
        upperRight.x,
        upperRight.y,
        0,
        -Math.PI / 2,
        -Math.PI,
        1
      );
      this.ellipse(
        x + w + lowerRight.x,
        y + h - lowerRight.y,
        lowerRight.x,
        lowerRight.y,
        0,
        -Math.PI,
        -Math.PI * 1.5,
        1
      );
      this.ellipse(
        x - lowerLeft.x,
        y + h - lowerLeft.y,
        lowerLeft.x,
        lowerLeft.y,
        0,
        Math.PI / 2,
        0,
        1
      );
      this.ellipse(
        x - upperLeft.x,
        y + upperLeft.y,
        upperLeft.x,
        upperLeft.y,
        0,
        0,
        -Math.PI / 2,
        1
      );

    }
    else if (h < 0) {

      this.moveTo(
        x + upperLeft.x,
        y
      );
      this.ellipse(
        x + w - upperRight.x,
        y - upperRight.y,
        upperRight.x,
        upperRight.y,
        0,
        Math.PI / 2,
        0,
        1
      );
      this.ellipse(
        x + w - lowerRight.x,
        y + h + lowerRight.y,
        lowerRight.x,
        lowerRight.y,
        0,
        0,
        -Math.PI / 2,
        1
      );
      this.ellipse(
        x + lowerLeft.x,
        y + h + lowerLeft.y,
        lowerLeft.x,
        lowerLeft.y,
        0,
        -Math.PI / 2,
        -Math.PI,
        1
      );
      this.ellipse(
        x + upperLeft.x,
        y - upperLeft.y,
        upperLeft.x,
        upperLeft.y,
        0,
        -Math.PI,
        -Math.PI * 1.5,
        1
      );

    }
    else {

      this.moveTo(
        x + upperLeft.x,
        y
      );
      this.ellipse(
        x + w - upperRight.x,
        y + upperRight.y,
        upperRight.x,
        upperRight.y,
        0,
        -Math.PI / 2,
        0
      );
      this.ellipse(
        x + w - lowerRight.x,
        y + h - lowerRight.y,
        lowerRight.x,
        lowerRight.y,
        0,
        0,
        Math.PI / 2
      );
      this.ellipse(
        x + lowerLeft.x,
        y + h - lowerLeft.y,
        lowerLeft.x,
        lowerLeft.y,
        0,
        Math.PI / 2,
        Math.PI
      );
      this.ellipse(
        x + upperLeft.x,
        y + upperLeft.y,
        upperLeft.x,
        upperLeft.y,
        0,
        Math.PI,
        Math.PI * 1.5
      );

    }

    this.closePath();
    this.moveTo(x, y);

  }

  var geom = /*#__PURE__*/Object.freeze({
    __proto__: null,
    closePath: closePath,
    lineTo: lineTo,
    moveTo: moveTo,
    rect: rect,
    ellipse: ellipse,
    arc: arc,
    bezierCurveTo: bezierCurveTo,
    quadraticCurveTo: quadraticCurveTo,
    arcTo: arcTo,
    roundRect: roundRect
  });

  var paramCounts = { a: 7, c: 6, h: 1, l: 2, m: 2, r: 4, q: 4, s: 4, t: 2, v: 1, z: 0 };

  var SPECIAL_SPACES = [
    0x1680, 0x180E, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006,
    0x2007, 0x2008, 0x2009, 0x200A, 0x202F, 0x205F, 0x3000, 0xFEFF
  ];

  function isSpace(ch) {
    return (ch === 0x0A) || (ch === 0x0D) || (ch === 0x2028) || (ch === 0x2029) || // Line terminators
      // White spaces
      (ch === 0x20) || (ch === 0x09) || (ch === 0x0B) || (ch === 0x0C) || (ch === 0xA0) ||
      (ch >= 0x1680 && SPECIAL_SPACES.indexOf(ch) >= 0);
  }

  function isCommand(code) {
    /*eslint-disable no-bitwise*/
    switch (code | 0x20) {
      case 0x6D/* m */:
      case 0x7A/* z */:
      case 0x6C/* l */:
      case 0x68/* h */:
      case 0x76/* v */:
      case 0x63/* c */:
      case 0x73/* s */:
      case 0x71/* q */:
      case 0x74/* t */:
      case 0x61/* a */:
      case 0x72/* r */:
        return true;
    }
    return false;
  }

  function isArc(code) {
    return (code | 0x20) === 0x61;
  }

  function isDigit(code) {
    return (code >= 48 && code <= 57);   // 0..9
  }

  function isDigitStart(code) {
    return (code >= 48 && code <= 57) || /* 0..9 */
            code === 0x2B || /* + */
            code === 0x2D || /* - */
            code === 0x2E;   /* . */
  }


  function State(path) {
    this.index  = 0;
    this.path   = path;
    this.max    = path.length;
    this.result = [];
    this.param  = 0.0;
    this.err    = '';
    this.segmentStart = 0;
    this.data   = [];
  }

  function skipSpaces(state) {
    while (state.index < state.max && isSpace(state.path.charCodeAt(state.index))) {
      state.index++;
    }
  }


  function scanFlag(state) {
    var ch = state.path.charCodeAt(state.index);

    if (ch === 0x30/* 0 */) {
      state.param = 0;
      state.index++;
      return;
    }

    if (ch === 0x31/* 1 */) {
      state.param = 1;
      state.index++;
      return;
    }

    state.err = 'SvgPath: arc flag can be 0 or 1 only (at pos ' + state.index + ')';
  }


  function scanParam(state) {
    var start = state.index,
        index = start,
        max = state.max,
        zeroFirst = false,
        hasCeiling = false,
        hasDecimal = false,
        hasDot = false,
        ch;

    if (index >= max) {
      state.err = 'SvgPath: missed param (at pos ' + index + ')';
      return;
    }
    ch = state.path.charCodeAt(index);

    if (ch === 0x2B/* + */ || ch === 0x2D/* - */) {
      index++;
      ch = (index < max) ? state.path.charCodeAt(index) : 0;
    }

    // This logic is shamelessly borrowed from Esprima
    // https://github.com/ariya/esprimas
    //
    if (!isDigit(ch) && ch !== 0x2E/* . */) {
      state.err = 'SvgPath: param should start with 0..9 or `.` (at pos ' + index + ')';
      return;
    }

    if (ch !== 0x2E/* . */) {
      zeroFirst = (ch === 0x30/* 0 */);
      index++;

      ch = (index < max) ? state.path.charCodeAt(index) : 0;

      if (zeroFirst && index < max) {
        // decimal number starts with '0' such as '09' is illegal.
        if (ch && isDigit(ch)) {
          state.err = 'SvgPath: numbers started with `0` such as `09` are illegal (at pos ' + start + ')';
          return;
        }
      }

      while (index < max && isDigit(state.path.charCodeAt(index))) {
        index++;
        hasCeiling = true;
      }
      ch = (index < max) ? state.path.charCodeAt(index) : 0;
    }

    if (ch === 0x2E/* . */) {
      hasDot = true;
      index++;
      while (isDigit(state.path.charCodeAt(index))) {
        index++;
        hasDecimal = true;
      }
      ch = (index < max) ? state.path.charCodeAt(index) : 0;
    }

    if (ch === 0x65/* e */ || ch === 0x45/* E */) {
      if (hasDot && !hasCeiling && !hasDecimal) {
        state.err = 'SvgPath: invalid float exponent (at pos ' + index + ')';
        return;
      }

      index++;

      ch = (index < max) ? state.path.charCodeAt(index) : 0;
      if (ch === 0x2B/* + */ || ch === 0x2D/* - */) {
        index++;
      }
      if (index < max && isDigit(state.path.charCodeAt(index))) {
        while (index < max && isDigit(state.path.charCodeAt(index))) {
          index++;
        }
      } else {
        state.err = 'SvgPath: invalid float exponent (at pos ' + index + ')';
        return;
      }
    }

    state.index = index;
    state.param = parseFloat(state.path.slice(start, index)) + 0.0;
  }


  function finalizeSegment(state) {
    var cmd, cmdLC;

    // Process duplicated commands (without comand name)

    // This logic is shamelessly borrowed from Raphael
    // https://github.com/DmitryBaranovskiy/raphael/
    //
    cmd   = state.path[state.segmentStart];
    cmdLC = cmd.toLowerCase();

    var params = state.data;

    if (cmdLC === 'm' && params.length > 2) {
      state.result.push([ cmd, params[0], params[1] ]);
      params = params.slice(2);
      cmdLC = 'l';
      cmd = (cmd === 'm') ? 'l' : 'L';
    }

    if (cmdLC === 'r') {
      state.result.push([ cmd ].concat(params));
    } else {

      while (params.length >= paramCounts[cmdLC]) {
        state.result.push([ cmd ].concat(params.splice(0, paramCounts[cmdLC])));
        if (!paramCounts[cmdLC]) {
          break;
        }
      }
    }
  }


  function scanSegment(state) {
    var max = state.max,
        cmdCode, is_arc, comma_found, need_params, i;

    state.segmentStart = state.index;
    cmdCode = state.path.charCodeAt(state.index);
    is_arc = isArc(cmdCode);

    if (!isCommand(cmdCode)) {
      state.err = 'SvgPath: bad command ' + state.path[state.index] + ' (at pos ' + state.index + ')';
      return;
    }

    need_params = paramCounts[state.path[state.index].toLowerCase()];

    state.index++;
    skipSpaces(state);

    state.data = [];

    if (!need_params) {
      // Z
      finalizeSegment(state);
      return;
    }

    comma_found = false;

    for (;;) {
      for (i = need_params; i > 0; i--) {
        if (is_arc && (i === 3 || i === 4)) scanFlag(state);
        else scanParam(state);

        if (state.err.length) {
          finalizeSegment(state);
          return;
        }
        state.data.push(state.param);

        skipSpaces(state);
        comma_found = false;

        if (state.index < max && state.path.charCodeAt(state.index) === 0x2C/* , */) {
          state.index++;
          skipSpaces(state);
          comma_found = true;
        }
      }

      // after ',' param is mandatory
      if (comma_found) {
        continue;
      }

      if (state.index >= state.max) {
        break;
      }

      // Stop on next segment
      if (!isDigitStart(state.path.charCodeAt(state.index))) {
        break;
      }
    }

    finalizeSegment(state);
  }


  /* Returns array of segments:
   *
   * [
   *   [ command, coord1, coord2, ... ]
   * ]
   */
  function pathParse(svgPath) {
    var state = new State(svgPath);
    var max = state.max;

    skipSpaces(state);

    while (state.index < max && !state.err.length) {
      scanSegment(state);
    }

    if (state.result.length) {
      if ('mM'.indexOf(state.result[0][0]) < 0) {
        state.err = 'SvgPath: string should start with `M` or `m`';
        state.result = [];
      } else {
        state.result[0][0] = 'M';
      }
    }

    return {
      err: state.err,
      segments: state.result
    };
  }

  // Convert an arc to a sequence of cubic bézier curves
  //

  var TAU = Math.PI * 2;


  /* eslint-disable space-infix-ops */

  // Calculate an angle between two unit vectors
  //
  // Since we measure angle between radii of circular arcs,
  // we can use simplified math (without length normalization)
  //
  function unit_vector_angle(ux, uy, vx, vy) {
    var sign = (ux * vy - uy * vx < 0) ? -1 : 1;
    var dot  = ux * vx + uy * vy;

    // Add this to work with arbitrary vectors:
    // dot /= Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy);

    // rounding errors, e.g. -1.0000000000000002 can screw up this
    if (dot >  1.0) { dot =  1.0; }
    if (dot < -1.0) { dot = -1.0; }

    return sign * Math.acos(dot);
  }


  // Convert from endpoint to center parameterization,
  // see http://www.w3.org/TR/SVG11/implnote.html#ArcImplementationNotes
  //
  // Return [cx, cy, theta1, delta_theta]
  //
  function get_arc_center(x1, y1, x2, y2, fa, fs, rx, ry, sin_phi, cos_phi) {
    // Step 1.
    //
    // Moving an ellipse so origin will be the middlepoint between our two
    // points. After that, rotate it to line up ellipse axes with coordinate
    // axes.
    //
    var x1p =  cos_phi*(x1-x2)/2 + sin_phi*(y1-y2)/2;
    var y1p = -sin_phi*(x1-x2)/2 + cos_phi*(y1-y2)/2;

    var rx_sq  =  rx * rx;
    var ry_sq  =  ry * ry;
    var x1p_sq = x1p * x1p;
    var y1p_sq = y1p * y1p;

    // Step 2.
    //
    // Compute coordinates of the centre of this ellipse (cx', cy')
    // in the new coordinate system.
    //
    var radicant = (rx_sq * ry_sq) - (rx_sq * y1p_sq) - (ry_sq * x1p_sq);

    if (radicant < 0) {
      // due to rounding errors it might be e.g. -1.3877787807814457e-17
      radicant = 0;
    }

    radicant /=   (rx_sq * y1p_sq) + (ry_sq * x1p_sq);
    radicant = Math.sqrt(radicant) * (fa === fs ? -1 : 1);

    var cxp = radicant *  rx/ry * y1p;
    var cyp = radicant * -ry/rx * x1p;

    // Step 3.
    //
    // Transform back to get centre coordinates (cx, cy) in the original
    // coordinate system.
    //
    var cx = cos_phi*cxp - sin_phi*cyp + (x1+x2)/2;
    var cy = sin_phi*cxp + cos_phi*cyp + (y1+y2)/2;

    // Step 4.
    //
    // Compute angles (theta1, delta_theta).
    //
    var v1x =  (x1p - cxp) / rx;
    var v1y =  (y1p - cyp) / ry;
    var v2x = (-x1p - cxp) / rx;
    var v2y = (-y1p - cyp) / ry;

    var theta1 = unit_vector_angle(1, 0, v1x, v1y);
    var delta_theta = unit_vector_angle(v1x, v1y, v2x, v2y);

    if (fs === 0 && delta_theta > 0) {
      delta_theta -= TAU;
    }
    if (fs === 1 && delta_theta < 0) {
      delta_theta += TAU;
    }

    return [ cx, cy, theta1, delta_theta ];
  }

  //
  // Approximate one unit arc segment with bézier curves,
  // see http://math.stackexchange.com/questions/873224
  //
  function approximate_unit_arc(theta1, delta_theta) {
    var alpha = 4/3 * Math.tan(delta_theta/4);

    var x1 = Math.cos(theta1);
    var y1 = Math.sin(theta1);
    var x2 = Math.cos(theta1 + delta_theta);
    var y2 = Math.sin(theta1 + delta_theta);

    return [ x1, y1, x1 - y1*alpha, y1 + x1*alpha, x2 + y2*alpha, y2 - x2*alpha, x2, y2 ];
  }

  function a2c(x1, y1, x2, y2, fa, fs, rx, ry, phi) {
    var sin_phi = Math.sin(phi * TAU / 360);
    var cos_phi = Math.cos(phi * TAU / 360);

    // Make sure radii are valid
    //
    var x1p =  cos_phi*(x1-x2)/2 + sin_phi*(y1-y2)/2;
    var y1p = -sin_phi*(x1-x2)/2 + cos_phi*(y1-y2)/2;

    if (x1p === 0 && y1p === 0) {
      // we're asked to draw line to itself
      return [];
    }

    if (rx === 0 || ry === 0) {
      // one of the radii is zero
      return [];
    }


    // Compensate out-of-range radii
    //
    rx = Math.abs(rx);
    ry = Math.abs(ry);

    var lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
    if (lambda > 1) {
      rx *= Math.sqrt(lambda);
      ry *= Math.sqrt(lambda);
    }


    // Get center parameters (cx, cy, theta1, delta_theta)
    //
    var cc = get_arc_center(x1, y1, x2, y2, fa, fs, rx, ry, sin_phi, cos_phi);

    var result = [];
    var theta1 = cc[2];
    var delta_theta = cc[3];

    // Split an arc to multiple segments, so each segment
    // will be less than τ/4 (= 90°)
    //
    var segments = Math.max(Math.ceil(Math.abs(delta_theta) / (TAU / 4)), 1);
    delta_theta /= segments;

    for (var i = 0; i < segments; i++) {
      result.push(approximate_unit_arc(theta1, delta_theta));
      theta1 += delta_theta;
    }

    // We have a bezier approximation of a unit circle,
    // now need to transform back to the original ellipse
    //
    return result.map(function (curve) {
      for (var i = 0; i < curve.length; i += 2) {
        var x = curve[i + 0];
        var y = curve[i + 1];

        // scale
        x *= rx;
        y *= ry;

        // rotate
        var xp = cos_phi*x - sin_phi*y;
        var yp = sin_phi*x + cos_phi*y;

        // translate
        curve[i + 0] = xp + cc[0];
        curve[i + 1] = yp + cc[1];
      }

      return curve;
    });
  }

  // SVG Path transformations library


  // Class constructor
  //
  function SvgPath(path) {
    if (!(this instanceof SvgPath)) { return new SvgPath(path); }

    var pstate = pathParse(path);

    // Array of path segments.
    // Each segment is array [command, param1, param2, ...]
    this.segments = pstate.segments;

    // Error message on parse error.
    this.err      = pstate.err;
  }

  SvgPath.from = function (src) {
    if (typeof src === 'string') return new SvgPath(src);

    if (src instanceof SvgPath) {
      // Create empty object
      var s = new SvgPath('');

      // Clone properies
      s.err = src.err;
      s.segments = src.segments.map(function (sgm) { return sgm.slice(); });

      return s;
    }

    throw new Error('SvgPath.from: invalid param type ' + src);
  };


  // Convert processed SVG Path back to string
  //
  SvgPath.prototype.toString = function () {
    var result = '', prevCmd = '', cmdSkipped = false;

    for (var i = 0, len = this.segments.length; i < len; i++) {
      var segment = this.segments[i];
      var cmd = segment[0];

      // Command not repeating => store
      if (cmd !== prevCmd || cmd === 'm' || cmd === 'M') {
        // workaround for FontForge SVG importing bug, keep space between "z m".
        if (cmd === 'm' && prevCmd === 'z') result += ' ';
        result += cmd;

        cmdSkipped = false;
      } else {
        cmdSkipped = true;
      }

      // Store segment params
      for (var pos = 1; pos < segment.length; pos++) {
        var val = segment[pos];
        // Space can be skipped
        // 1. After command (always)
        // 2. For negative value (with '-' at start)
        if (pos === 1) {
          if (cmdSkipped && val >= 0) result += ' ';
        } else if (val >= 0) result += ' ';

        result += val;
      }

      prevCmd = cmd;
    }

    return result;
  };


  // Apply iterator function to all segments. If function returns result,
  // current segment will be replaced to array of returned segments.
  // If empty array is returned, current regment will be deleted.
  //
  SvgPath.prototype.iterate = function (iterator) {
    var segments = this.segments,
        replacements = {},
        needReplace = false,
        lastX = 0,
        lastY = 0,
        countourStartX = 0,
        countourStartY = 0;
    var i, j, newSegments;

    segments.forEach(function (s, index) {

      var res = iterator(s, index, lastX, lastY);

      if (Array.isArray(res)) {
        replacements[index] = res;
        needReplace = true;
      }

      var isRelative = (s[0] === s[0].toLowerCase());

      // calculate absolute X and Y
      switch (s[0]) {
        case 'm':
        case 'M':
          lastX = s[1] + (isRelative ? lastX : 0);
          lastY = s[2] + (isRelative ? lastY : 0);
          countourStartX = lastX;
          countourStartY = lastY;
          return;

        case 'h':
        case 'H':
          lastX = s[1] + (isRelative ? lastX : 0);
          return;

        case 'v':
        case 'V':
          lastY = s[1] + (isRelative ? lastY : 0);
          return;

        case 'z':
        case 'Z':
          // That make sence for multiple contours
          lastX = countourStartX;
          lastY = countourStartY;
          return;

        default:
          lastX = s[s.length - 2] + (isRelative ? lastX : 0);
          lastY = s[s.length - 1] + (isRelative ? lastY : 0);
      }
    });

    // Replace segments if iterator return results

    if (!needReplace) { return this; }

    newSegments = [];

    for (i = 0; i < segments.length; i++) {
      if (typeof replacements[i] !== 'undefined') {
        for (j = 0; j < replacements[i].length; j++) {
          newSegments.push(replacements[i][j]);
        }
      } else {
        newSegments.push(segments[i]);
      }
    }

    this.segments = newSegments;

    return this;
  };


  // Converts segments from relative to absolute
  //
  SvgPath.prototype.abs = function () {

    this.iterate(function (s, index, x, y) {
      var name = s[0],
          nameUC = name.toUpperCase(),
          i;

      // Skip absolute commands
      if (name === nameUC) { return; }

      s[0] = nameUC;

      switch (name) {
        case 'v':
          // v has shifted coords parity
          s[1] += y;
          return;

        case 'a':
          // ARC is: ['A', rx, ry, x-axis-rotation, large-arc-flag, sweep-flag, x, y]
          // touch x, y only
          s[6] += x;
          s[7] += y;
          return;

        default:
          for (i = 1; i < s.length; i++) {
            s[i] += i % 2 ? x : y; // odd values are X, even - Y
          }
      }
    }, true);

    return this;
  };


  // Converts arcs to cubic bézier curves
  //
  SvgPath.prototype.unarc = function () {
    this.iterate(function (s, index, x, y) {
      var new_segments, nextX, nextY, result = [], name = s[0];

      // Skip anything except arcs
      if (name !== 'A' && name !== 'a') { return null; }

      if (name === 'a') {
        // convert relative arc coordinates to absolute
        nextX = x + s[6];
        nextY = y + s[7];
      } else {
        nextX = s[6];
        nextY = s[7];
      }

      new_segments = a2c(x, y, nextX, nextY, s[4], s[5], s[1], s[2], s[3]);

      // Degenerated arcs can be ignored by renderer, but should not be dropped
      // to avoid collisions with `S A S` and so on. Replace with empty line.
      if (new_segments.length === 0) {
        return [ [ s[0] === 'a' ? 'l' : 'L', s[6], s[7] ] ];
      }

      new_segments.forEach(function (s) {
        result.push([ 'C', s[2], s[3], s[4], s[5], s[6], s[7] ]);
      });

      return result;
    });

    return this;
  };


  // Converts smooth curves (with missed control point) to generic curves
  //
  SvgPath.prototype.unshort = function () {
    var segments = this.segments;
    var prevControlX, prevControlY, prevSegment;
    var curControlX, curControlY;

    // TODO: add lazy evaluation flag when relative commands supported

    this.iterate(function (s, idx, x, y) {
      var name = s[0], nameUC = name.toUpperCase(), isRelative;

      // First command MUST be M|m, it's safe to skip.
      // Protect from access to [-1] for sure.
      if (!idx) { return; }

      if (nameUC === 'T') { // quadratic curve
        isRelative = (name === 't');

        prevSegment = segments[idx - 1];

        if (prevSegment[0] === 'Q') {
          prevControlX = prevSegment[1] - x;
          prevControlY = prevSegment[2] - y;
        } else if (prevSegment[0] === 'q') {
          prevControlX = prevSegment[1] - prevSegment[3];
          prevControlY = prevSegment[2] - prevSegment[4];
        } else {
          prevControlX = 0;
          prevControlY = 0;
        }

        curControlX = -prevControlX;
        curControlY = -prevControlY;

        if (!isRelative) {
          curControlX += x;
          curControlY += y;
        }

        segments[idx] = [
          isRelative ? 'q' : 'Q',
          curControlX, curControlY,
          s[1], s[2]
        ];

      } else if (nameUC === 'S') { // cubic curve
        isRelative = (name === 's');

        prevSegment = segments[idx - 1];

        if (prevSegment[0] === 'C') {
          prevControlX = prevSegment[3] - x;
          prevControlY = prevSegment[4] - y;
        } else if (prevSegment[0] === 'c') {
          prevControlX = prevSegment[3] - prevSegment[5];
          prevControlY = prevSegment[4] - prevSegment[6];
        } else {
          prevControlX = 0;
          prevControlY = 0;
        }

        curControlX = -prevControlX;
        curControlY = -prevControlY;

        if (!isRelative) {
          curControlX += x;
          curControlY += y;
        }

        segments[idx] = [
          isRelative ? 'c' : 'C',
          curControlX, curControlY,
          s[1], s[2], s[3], s[4]
        ];
      }
    });

    return this;
  };

  // internal use only

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

  // from https://github.com/gabelerner/canvg/blob/860e418aca67b9a41e858a223d74d375793ec364/canvg.js#L449
  function BoundingBox(x1, y1, x2, y2) { // pass in initial points if you want
    this.x1 = Number.NaN;
    this.y1 = Number.NaN;
    this.x2 = Number.NaN;
    this.y2 = Number.NaN;

    this.addPoint(x1, y1);
    this.addPoint(x2, y2);
  }

  BoundingBox.prototype = {

    width: function () {
      return this.x2 - this.x1;
    },

    height: function () {
      return this.y2 - this.y1;
    },

    addPoint: function (x, y) {
      /* eslint no-eq-null: 0, eqeqeq: 0 */
      if (x != null) {
        if (isNaN(this.x1) || isNaN(this.x2)) {
          this.x1 = x;
          this.x2 = x;
        }
        if (x < this.x1) this.x1 = x;
        if (x > this.x2) this.x2 = x;
      }

      if (y != null) {
        if (isNaN(this.y1) || isNaN(this.y2)) {
          this.y1 = y;
          this.y2 = y;
        }
        if (y < this.y1) this.y1 = y;
        if (y > this.y2) this.y2 = y;
      }
    },

    addX: function (x) {
      this.addPoint(x, null);
    },

    addY: function (y) {
      this.addPoint(null, y);
    },

    addQuadraticCurve: function (p0x, p0y, p1x, p1y, p2x, p2y) {
      const cp1x = p0x + 2 / 3 * (p1x - p0x); // CP1 = QP0 + 2/3 *(QP1-QP0)
      const cp1y = p0y + 2 / 3 * (p1y - p0y); // CP1 = QP0 + 2/3 *(QP1-QP0)
      const cp2x = cp1x + 1 / 3 * (p2x - p0x); // CP2 = CP1 + 1/3 *(QP2-QP0)
      const cp2y = cp1y + 1 / 3 * (p2y - p0y); // CP2 = CP1 + 1/3 *(QP2-QP0)
      this.addBezierCurve(p0x, p0y, cp1x, cp1y, cp2x, cp2y, p2x, p2y);
    },

    addBezierCurve: function (p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y) {
      // from http://blog.hackers-cafe.net/2009/06/how-to-calculate-bezier-curves-bounding.html
      const p0 = [ p0x, p0y ];
      const p1 = [ p1x, p1y ];
      const p2 = [ p2x, p2y ];
      const p3 = [ p3x, p3y ];

      this.addPoint(p0[0], p0[1]);
      this.addPoint(p3[0], p3[1]);

      let i = 0;
      function f(t) {
        return Math.pow(1 - t, 3) * p0[i]
          + 3 * Math.pow(1 - t, 2) * t * p1[i]
          + 3 * (1 - t) * Math.pow(t, 2) * p2[i]
          + Math.pow(t, 3) * p3[i];
      }

      for (i = 0; i <= 1; i++) {

        const b = 6 * p0[i] - 12 * p1[i] + 6 * p2[i];
        const a = -3 * p0[i] + 9 * p1[i] - 9 * p2[i] + 3 * p3[i];
        const c = 3 * p1[i] - 3 * p0[i];

        if (a == 0) {
          if (b == 0) continue;
          const t = -c / b;
          if (0 < t && t < 1) {
            if (i == 0) this.addX(f(t));
            if (i == 1) this.addY(f(t));
          }
          continue;
        }

        const b2ac = Math.pow(b, 2) - 4 * c * a;
        if (b2ac < 0) continue;
        const t1 = (-b + Math.sqrt(b2ac)) / (2 * a);
        if (0 < t1 && t1 < 1) {
          if (i == 0) this.addX(f(t1));
          if (i == 1) this.addY(f(t1));
        }
        const t2 = (-b - Math.sqrt(b2ac)) / (2 * a);
        if (0 < t2 && t2 < 1) {
          if (i == 0) this.addX(f(t2));
          if (i == 1) this.addY(f(t2));
        }
      }
    }

  };

  function getBBox(d) {
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
  const consumers = [
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

  // http://geoexamples.com/path-properties/ v1.0.10 Copyright 2021 Roger Veciana i Rovira
  function t(t,n,e){return n in t?Object.defineProperty(t,n,{value:e,enumerable:!0,configurable:!0,writable:!0}):t[n]=e,t}function n(t){return function(t){if(Array.isArray(t))return e(t)}(t)||function(t){if("undefined"!=typeof Symbol&&Symbol.iterator in Object(t))return Array.from(t)}(t)||function(t,n){if(!t)return;if("string"==typeof t)return e(t,n);var i=Object.prototype.toString.call(t).slice(8,-1);"Object"===i&&t.constructor&&(i=t.constructor.name);if("Map"===i||"Set"===i)return Array.from(t);if("Arguments"===i||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(i))return e(t,n)}(t)||function(){throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function e(t,n){(null==n||n>t.length)&&(n=t.length);for(var e=0,i=new Array(n);e<n;e++)i[e]=t[e];return i}var i={a:7,c:6,h:1,l:2,m:2,q:4,s:4,t:2,v:1,z:0},h=/([astvzqmhlc])([^astvzqmhlc]*)/gi,r=/-?[0-9]*\.?[0-9]+(?:e[-+]?\d+)?/gi,s=function(t){var n=t.match(r);return n?n.map(Number):[]},a=function(n,e,i,h){var r=this;t(this,"x0",void 0),t(this,"x1",void 0),t(this,"y0",void 0),t(this,"y1",void 0),t(this,"getTotalLength",(function(){return Math.sqrt(Math.pow(r.x0-r.x1,2)+Math.pow(r.y0-r.y1,2))})),t(this,"getPointAtLength",(function(t){var n=t/Math.sqrt(Math.pow(r.x0-r.x1,2)+Math.pow(r.y0-r.y1,2));n=Number.isNaN(n)?1:n;var e=(r.x1-r.x0)*n,i=(r.y1-r.y0)*n;return {x:r.x0+e,y:r.y0+i}})),t(this,"getTangentAtLength",(function(t){var n=Math.sqrt((r.x1-r.x0)*(r.x1-r.x0)+(r.y1-r.y0)*(r.y1-r.y0));return {x:(r.x1-r.x0)/n,y:(r.y1-r.y0)/n}})),t(this,"getPropertiesAtLength",(function(t){var n=r.getPointAtLength(t),e=r.getTangentAtLength(t);return {x:n.x,y:n.y,tangentX:e.x,tangentY:e.y}})),this.x0=n,this.x1=e,this.y0=i,this.y1=h;},o=function(n,e,i,h,r,s,a,o,l){var c=this;t(this,"x0",void 0),t(this,"y0",void 0),t(this,"rx",void 0),t(this,"ry",void 0),t(this,"xAxisRotate",void 0),t(this,"LargeArcFlag",void 0),t(this,"SweepFlag",void 0),t(this,"x1",void 0),t(this,"y1",void 0),t(this,"length",void 0),t(this,"getTotalLength",(function(){return c.length})),t(this,"getPointAtLength",(function(t){t<0?t=0:t>c.length&&(t=c.length);var n=g({x:c.x0,y:c.y0},c.rx,c.ry,c.xAxisRotate,c.LargeArcFlag,c.SweepFlag,{x:c.x1,y:c.y1},t/c.length);return {x:n.x,y:n.y}})),t(this,"getTangentAtLength",(function(t){t<0?t=0:t>c.length&&(t=c.length);var n,e=.05,i=c.getPointAtLength(t);t<0?t=0:t>c.length&&(t=c.length);var h=(n=t<c.length-e?c.getPointAtLength(t+e):c.getPointAtLength(t-e)).x-i.x,r=n.y-i.y,s=Math.sqrt(h*h+r*r);return t<c.length-e?{x:-h/s,y:-r/s}:{x:h/s,y:r/s}})),t(this,"getPropertiesAtLength",(function(t){var n=c.getTangentAtLength(t),e=c.getPointAtLength(t);return {x:e.x,y:e.y,tangentX:n.x,tangentY:n.y}})),this.x0=n,this.y0=e,this.rx=i,this.ry=h,this.xAxisRotate=r,this.LargeArcFlag=s,this.SweepFlag=a,this.x1=o,this.y1=l;var f=u(300,(function(t){return g({x:n,y:e},i,h,r,s,a,{x:o,y:l},t)}));this.length=f.arcLength;},g=function(t,n,e,i,h,r,s,a){n=Math.abs(n),e=Math.abs(e),i=l(i,360);var o=c(i);if(t.x===s.x&&t.y===s.y)return {x:t.x,y:t.y,ellipticalArcAngle:0};if(0===n||0===e)return {x:0,y:0,ellipticalArcAngle:0};var g=(t.x-s.x)/2,u=(t.y-s.y)/2,f={x:Math.cos(o)*g+Math.sin(o)*u,y:-Math.sin(o)*g+Math.cos(o)*u},y=Math.pow(f.x,2)/Math.pow(n,2)+Math.pow(f.y,2)/Math.pow(e,2);y>1&&(n=Math.sqrt(y)*n,e=Math.sqrt(y)*e);var p=(Math.pow(n,2)*Math.pow(e,2)-Math.pow(n,2)*Math.pow(f.y,2)-Math.pow(e,2)*Math.pow(f.x,2))/(Math.pow(n,2)*Math.pow(f.y,2)+Math.pow(e,2)*Math.pow(f.x,2));p=p<0?0:p;var v=(h!==r?1:-1)*Math.sqrt(p),M=v*(n*f.y/e),L=v*(-e*f.x/n),w={x:Math.cos(o)*M-Math.sin(o)*L+(t.x+s.x)/2,y:Math.sin(o)*M+Math.cos(o)*L+(t.y+s.y)/2},A={x:(f.x-M)/n,y:(f.y-L)/e},d=x({x:1,y:0},A),P=x(A,{x:(-f.x-M)/n,y:(-f.y-L)/e});!r&&P>0?P-=2*Math.PI:r&&P<0&&(P+=2*Math.PI);var b=d+(P%=2*Math.PI)*a,T=n*Math.cos(b),m=e*Math.sin(b);return {x:Math.cos(o)*T-Math.sin(o)*m+w.x,y:Math.sin(o)*T+Math.cos(o)*m+w.y,ellipticalArcStartAngle:d,ellipticalArcEndAngle:d+P,ellipticalArcAngle:b,ellipticalArcCenter:w,resultantRx:n,resultantRy:e}},u=function(t,n){t=t||500;for(var e,i=0,h=[],r=[],s=n(0),a=0;a<t;a++){var o=y(a*(1/t),0,1);e=n(o),i+=f(s,e),r.push([s,e]),h.push({t:o,arcLength:i}),s=e;}return e=n(1),r.push([s,e]),i+=f(s,e),h.push({t:1,arcLength:i}),{arcLength:i,arcLengthMap:h,approximationLines:r}},l=function(t,n){return (t%n+n)%n},c=function(t){return t*(Math.PI/180)},f=function(t,n){return Math.sqrt(Math.pow(n.x-t.x,2)+Math.pow(n.y-t.y,2))},y=function(t,n,e){return Math.min(Math.max(t,n),e)},x=function(t,n){var e=t.x*n.x+t.y*n.y,i=Math.sqrt((Math.pow(t.x,2)+Math.pow(t.y,2))*(Math.pow(n.x,2)+Math.pow(n.y,2)));return (t.x*n.y-t.y*n.x<0?-1:1)*Math.acos(e/i)},p=[[],[],[-.5773502691896257,.5773502691896257],[0,-.7745966692414834,.7745966692414834],[-.33998104358485626,.33998104358485626,-.8611363115940526,.8611363115940526],[0,-.5384693101056831,.5384693101056831,-.906179845938664,.906179845938664],[.6612093864662645,-.6612093864662645,-.2386191860831969,.2386191860831969,-.932469514203152,.932469514203152],[0,.4058451513773972,-.4058451513773972,-.7415311855993945,.7415311855993945,-.9491079123427585,.9491079123427585],[-.1834346424956498,.1834346424956498,-.525532409916329,.525532409916329,-.7966664774136267,.7966664774136267,-.9602898564975363,.9602898564975363],[0,-.8360311073266358,.8360311073266358,-.9681602395076261,.9681602395076261,-.3242534234038089,.3242534234038089,-.6133714327005904,.6133714327005904],[-.14887433898163122,.14887433898163122,-.4333953941292472,.4333953941292472,-.6794095682990244,.6794095682990244,-.8650633666889845,.8650633666889845,-.9739065285171717,.9739065285171717],[0,-.26954315595234496,.26954315595234496,-.5190961292068118,.5190961292068118,-.7301520055740494,.7301520055740494,-.8870625997680953,.8870625997680953,-.978228658146057,.978228658146057],[-.1252334085114689,.1252334085114689,-.3678314989981802,.3678314989981802,-.5873179542866175,.5873179542866175,-.7699026741943047,.7699026741943047,-.9041172563704749,.9041172563704749,-.9815606342467192,.9815606342467192],[0,-.2304583159551348,.2304583159551348,-.44849275103644687,.44849275103644687,-.6423493394403402,.6423493394403402,-.8015780907333099,.8015780907333099,-.9175983992229779,.9175983992229779,-.9841830547185881,.9841830547185881],[-.10805494870734367,.10805494870734367,-.31911236892788974,.31911236892788974,-.5152486363581541,.5152486363581541,-.6872929048116855,.6872929048116855,-.827201315069765,.827201315069765,-.9284348836635735,.9284348836635735,-.9862838086968123,.9862838086968123],[0,-.20119409399743451,.20119409399743451,-.3941513470775634,.3941513470775634,-.5709721726085388,.5709721726085388,-.7244177313601701,.7244177313601701,-.8482065834104272,.8482065834104272,-.937273392400706,.937273392400706,-.9879925180204854,.9879925180204854],[-.09501250983763744,.09501250983763744,-.2816035507792589,.2816035507792589,-.45801677765722737,.45801677765722737,-.6178762444026438,.6178762444026438,-.755404408355003,.755404408355003,-.8656312023878318,.8656312023878318,-.9445750230732326,.9445750230732326,-.9894009349916499,.9894009349916499],[0,-.17848418149584785,.17848418149584785,-.3512317634538763,.3512317634538763,-.5126905370864769,.5126905370864769,-.6576711592166907,.6576711592166907,-.7815140038968014,.7815140038968014,-.8802391537269859,.8802391537269859,-.9506755217687678,.9506755217687678,-.9905754753144174,.9905754753144174],[-.0847750130417353,.0847750130417353,-.2518862256915055,.2518862256915055,-.41175116146284263,.41175116146284263,-.5597708310739475,.5597708310739475,-.6916870430603532,.6916870430603532,-.8037049589725231,.8037049589725231,-.8926024664975557,.8926024664975557,-.9558239495713977,.9558239495713977,-.9915651684209309,.9915651684209309],[0,-.16035864564022537,.16035864564022537,-.31656409996362983,.31656409996362983,-.46457074137596094,.46457074137596094,-.600545304661681,.600545304661681,-.7209661773352294,.7209661773352294,-.8227146565371428,.8227146565371428,-.9031559036148179,.9031559036148179,-.96020815213483,.96020815213483,-.9924068438435844,.9924068438435844],[-.07652652113349734,.07652652113349734,-.22778585114164507,.22778585114164507,-.37370608871541955,.37370608871541955,-.5108670019508271,.5108670019508271,-.636053680726515,.636053680726515,-.7463319064601508,.7463319064601508,-.8391169718222188,.8391169718222188,-.912234428251326,.912234428251326,-.9639719272779138,.9639719272779138,-.9931285991850949,.9931285991850949],[0,-.1455618541608951,.1455618541608951,-.2880213168024011,.2880213168024011,-.4243421202074388,.4243421202074388,-.5516188358872198,.5516188358872198,-.6671388041974123,.6671388041974123,-.7684399634756779,.7684399634756779,-.8533633645833173,.8533633645833173,-.9200993341504008,.9200993341504008,-.9672268385663063,.9672268385663063,-.9937521706203895,.9937521706203895],[-.06973927331972223,.06973927331972223,-.20786042668822127,.20786042668822127,-.34193582089208424,.34193582089208424,-.469355837986757,.469355837986757,-.5876404035069116,.5876404035069116,-.6944872631866827,.6944872631866827,-.7878168059792081,.7878168059792081,-.8658125777203002,.8658125777203002,-.926956772187174,.926956772187174,-.9700604978354287,.9700604978354287,-.9942945854823992,.9942945854823992],[0,-.1332568242984661,.1332568242984661,-.26413568097034495,.26413568097034495,-.3903010380302908,.3903010380302908,-.5095014778460075,.5095014778460075,-.6196098757636461,.6196098757636461,-.7186613631319502,.7186613631319502,-.8048884016188399,.8048884016188399,-.8767523582704416,.8767523582704416,-.9329710868260161,.9329710868260161,-.9725424712181152,.9725424712181152,-.9947693349975522,.9947693349975522],[-.06405689286260563,.06405689286260563,-.1911188674736163,.1911188674736163,-.3150426796961634,.3150426796961634,-.4337935076260451,.4337935076260451,-.5454214713888396,.5454214713888396,-.6480936519369755,.6480936519369755,-.7401241915785544,.7401241915785544,-.820001985973903,.820001985973903,-.8864155270044011,.8864155270044011,-.9382745520027328,.9382745520027328,-.9747285559713095,.9747285559713095,-.9951872199970213,.9951872199970213]],v=[[],[],[1,1],[.8888888888888888,.5555555555555556,.5555555555555556],[.6521451548625461,.6521451548625461,.34785484513745385,.34785484513745385],[.5688888888888889,.47862867049936647,.47862867049936647,.23692688505618908,.23692688505618908],[.3607615730481386,.3607615730481386,.46791393457269104,.46791393457269104,.17132449237917036,.17132449237917036],[.4179591836734694,.3818300505051189,.3818300505051189,.27970539148927664,.27970539148927664,.1294849661688697,.1294849661688697],[.362683783378362,.362683783378362,.31370664587788727,.31370664587788727,.22238103445337448,.22238103445337448,.10122853629037626,.10122853629037626],[.3302393550012598,.1806481606948574,.1806481606948574,.08127438836157441,.08127438836157441,.31234707704000286,.31234707704000286,.26061069640293544,.26061069640293544],[.29552422471475287,.29552422471475287,.26926671930999635,.26926671930999635,.21908636251598204,.21908636251598204,.1494513491505806,.1494513491505806,.06667134430868814,.06667134430868814],[.2729250867779006,.26280454451024665,.26280454451024665,.23319376459199048,.23319376459199048,.18629021092773426,.18629021092773426,.1255803694649046,.1255803694649046,.05566856711617366,.05566856711617366],[.24914704581340277,.24914704581340277,.2334925365383548,.2334925365383548,.20316742672306592,.20316742672306592,.16007832854334622,.16007832854334622,.10693932599531843,.10693932599531843,.04717533638651183,.04717533638651183],[.2325515532308739,.22628318026289723,.22628318026289723,.2078160475368885,.2078160475368885,.17814598076194574,.17814598076194574,.13887351021978725,.13887351021978725,.09212149983772845,.09212149983772845,.04048400476531588,.04048400476531588],[.2152638534631578,.2152638534631578,.2051984637212956,.2051984637212956,.18553839747793782,.18553839747793782,.15720316715819355,.15720316715819355,.12151857068790319,.12151857068790319,.08015808715976021,.08015808715976021,.03511946033175186,.03511946033175186],[.2025782419255613,.19843148532711158,.19843148532711158,.1861610000155622,.1861610000155622,.16626920581699392,.16626920581699392,.13957067792615432,.13957067792615432,.10715922046717194,.10715922046717194,.07036604748810812,.07036604748810812,.03075324199611727,.03075324199611727],[.1894506104550685,.1894506104550685,.18260341504492358,.18260341504492358,.16915651939500254,.16915651939500254,.14959598881657674,.14959598881657674,.12462897125553388,.12462897125553388,.09515851168249279,.09515851168249279,.062253523938647894,.062253523938647894,.027152459411754096,.027152459411754096],[.17944647035620653,.17656270536699264,.17656270536699264,.16800410215645004,.16800410215645004,.15404576107681028,.15404576107681028,.13513636846852548,.13513636846852548,.11188384719340397,.11188384719340397,.08503614831717918,.08503614831717918,.0554595293739872,.0554595293739872,.02414830286854793,.02414830286854793],[.1691423829631436,.1691423829631436,.16427648374583273,.16427648374583273,.15468467512626524,.15468467512626524,.14064291467065065,.14064291467065065,.12255520671147846,.12255520671147846,.10094204410628717,.10094204410628717,.07642573025488905,.07642573025488905,.0497145488949698,.0497145488949698,.02161601352648331,.02161601352648331],[.1610544498487837,.15896884339395434,.15896884339395434,.15276604206585967,.15276604206585967,.1426067021736066,.1426067021736066,.12875396253933621,.12875396253933621,.11156664554733399,.11156664554733399,.09149002162245,.09149002162245,.06904454273764123,.06904454273764123,.0448142267656996,.0448142267656996,.019461788229726478,.019461788229726478],[.15275338713072584,.15275338713072584,.14917298647260374,.14917298647260374,.14209610931838204,.14209610931838204,.13168863844917664,.13168863844917664,.11819453196151841,.11819453196151841,.10193011981724044,.10193011981724044,.08327674157670475,.08327674157670475,.06267204833410907,.06267204833410907,.04060142980038694,.04060142980038694,.017614007139152118,.017614007139152118],[.14608113364969041,.14452440398997005,.14452440398997005,.13988739479107315,.13988739479107315,.13226893863333747,.13226893863333747,.12183141605372853,.12183141605372853,.10879729916714838,.10879729916714838,.09344442345603386,.09344442345603386,.0761001136283793,.0761001136283793,.057134425426857205,.057134425426857205,.036953789770852494,.036953789770852494,.016017228257774335,.016017228257774335],[.13925187285563198,.13925187285563198,.13654149834601517,.13654149834601517,.13117350478706238,.13117350478706238,.12325237681051242,.12325237681051242,.11293229608053922,.11293229608053922,.10041414444288096,.10041414444288096,.08594160621706773,.08594160621706773,.06979646842452049,.06979646842452049,.052293335152683286,.052293335152683286,.03377490158481415,.03377490158481415,.0146279952982722,.0146279952982722],[.13365457218610619,.1324620394046966,.1324620394046966,.12890572218808216,.12890572218808216,.12304908430672953,.12304908430672953,.11499664022241136,.11499664022241136,.10489209146454141,.10489209146454141,.09291576606003515,.09291576606003515,.07928141177671895,.07928141177671895,.06423242140852585,.06423242140852585,.04803767173108467,.04803767173108467,.030988005856979445,.030988005856979445,.013411859487141771,.013411859487141771],[.12793819534675216,.12793819534675216,.1258374563468283,.1258374563468283,.12167047292780339,.12167047292780339,.1155056680537256,.1155056680537256,.10744427011596563,.10744427011596563,.09761865210411388,.09761865210411388,.08619016153195327,.08619016153195327,.0733464814110803,.0733464814110803,.05929858491543678,.05929858491543678,.04427743881741981,.04427743881741981,.028531388628933663,.028531388628933663,.0123412297999872,.0123412297999872]],M=[[1],[1,1],[1,2,1],[1,3,3,1]],L=function(t,n,e){return {x:(1-e)*(1-e)*(1-e)*t[0]+3*(1-e)*(1-e)*e*t[1]+3*(1-e)*e*e*t[2]+e*e*e*t[3],y:(1-e)*(1-e)*(1-e)*n[0]+3*(1-e)*(1-e)*e*n[1]+3*(1-e)*e*e*n[2]+e*e*e*n[3]}},w=function(t,n,e){return d([3*(t[1]-t[0]),3*(t[2]-t[1]),3*(t[3]-t[2])],[3*(n[1]-n[0]),3*(n[2]-n[1]),3*(n[3]-n[2])],e)},A=function(t,n,e){var i,h,r;i=e/2,h=0;for(var s=0;s<20;s++)r=i*p[20][s]+i,h+=v[20][s]*T(t,n,r);return i*h},d=function(t,n,e){return {x:(1-e)*(1-e)*t[0]+2*(1-e)*e*t[1]+e*e*t[2],y:(1-e)*(1-e)*n[0]+2*(1-e)*e*n[1]+e*e*n[2]}},P=function(t,n,e){void 0===e&&(e=1);var i=t[0]-2*t[1]+t[2],h=n[0]-2*n[1]+n[2],r=2*t[1]-2*t[0],s=2*n[1]-2*n[0],a=4*(i*i+h*h),o=4*(i*r+h*s),g=r*r+s*s;if(0===a)return e*Math.sqrt(Math.pow(t[2]-t[0],2)+Math.pow(n[2]-n[0],2));var u=o/(2*a),l=e+u,c=g/a-u*u,f=l*l+c>0?Math.sqrt(l*l+c):0,y=u*u+c>0?Math.sqrt(u*u+c):0,x=u+Math.sqrt(u*u+c)!==0?c*Math.log(Math.abs((l+f)/(u+y))):0;return Math.sqrt(a)/2*(l*f-u*y+x)},b=function(t,n,e){return {x:2*(1-e)*(t[1]-t[0])+2*e*(t[2]-t[1]),y:2*(1-e)*(n[1]-n[0])+2*e*(n[2]-n[1])}};function T(t,n,e){var i=m(1,e,t),h=m(1,e,n),r=i*i+h*h;return Math.sqrt(r)}var m=function t(n,e,i){var h,r,s=i.length-1;if(0===s)return 0;if(0===n){r=0;for(var a=0;a<=s;a++)r+=M[s][a]*Math.pow(1-e,s-a)*Math.pow(e,a)*i[a];return r}h=new Array(s);for(var o=0;o<s;o++)h[o]=s*(i[o+1]-i[o]);return t(n-1,e,h)},q=function(t,n,e){for(var i=1,h=t/n,r=(t-e(h))/n,s=0;i>.001;){var a=e(h+r),o=Math.abs(t-a)/n;if(o<i)i=o,h+=r;else {var g=e(h-r),u=Math.abs(t-g)/n;u<i?(i=u,h-=r):r/=2;}if(++s>500)break}return h},_=function(n,e,i,h,r,s,a,o){var g=this;t(this,"a",void 0),t(this,"b",void 0),t(this,"c",void 0),t(this,"d",void 0),t(this,"length",void 0),t(this,"getArcLength",void 0),t(this,"getPoint",void 0),t(this,"getDerivative",void 0),t(this,"getTotalLength",(function(){return g.length})),t(this,"getPointAtLength",(function(t){var n=[g.a.x,g.b.x,g.c.x,g.d.x],e=[g.a.y,g.b.y,g.c.y,g.d.y],i=q(t,g.length,(function(t){return g.getArcLength(n,e,t)}));return g.getPoint(n,e,i)})),t(this,"getTangentAtLength",(function(t){var n=[g.a.x,g.b.x,g.c.x,g.d.x],e=[g.a.y,g.b.y,g.c.y,g.d.y],i=q(t,g.length,(function(t){return g.getArcLength(n,e,t)})),h=g.getDerivative(n,e,i),r=Math.sqrt(h.x*h.x+h.y*h.y);return r>0?{x:h.x/r,y:h.y/r}:{x:0,y:0}})),t(this,"getPropertiesAtLength",(function(t){var n,e=[g.a.x,g.b.x,g.c.x,g.d.x],i=[g.a.y,g.b.y,g.c.y,g.d.y],h=q(t,g.length,(function(t){return g.getArcLength(e,i,t)})),r=g.getDerivative(e,i,h),s=Math.sqrt(r.x*r.x+r.y*r.y);n=s>0?{x:r.x/s,y:r.y/s}:{x:0,y:0};var a=g.getPoint(e,i,h);return {x:a.x,y:a.y,tangentX:n.x,tangentY:n.y}})),t(this,"getC",(function(){return g.c})),t(this,"getD",(function(){return g.d})),this.a={x:n,y:e},this.b={x:i,y:h},this.c={x:r,y:s},void 0!==a&&void 0!==o?(this.getArcLength=A,this.getPoint=L,this.getDerivative=w,this.d={x:a,y:o}):(this.getArcLength=P,this.getPoint=d,this.getDerivative=b,this.d={x:0,y:0}),this.length=this.getArcLength([this.a.x,this.b.x,this.c.x,this.d.x],[this.a.y,this.b.y,this.c.y,this.d.y],1);},S=function(e){var r=this;t(this,"length",0),t(this,"partial_lengths",[]),t(this,"functions",[]),t(this,"initial_point",null),t(this,"getPartAtLength",(function(t){t<0?t=0:t>r.length&&(t=r.length);for(var n=r.partial_lengths.length-1;r.partial_lengths[n]>=t&&n>0;)n--;return n++,{fraction:t-r.partial_lengths[n-1],i:n}})),t(this,"getTotalLength",(function(){return r.length})),t(this,"getPointAtLength",(function(t){var n=r.getPartAtLength(t),e=r.functions[n.i];if(e)return e.getPointAtLength(n.fraction);if(r.initial_point)return r.initial_point;throw new Error("Wrong function at this part.")})),t(this,"getTangentAtLength",(function(t){var n=r.getPartAtLength(t),e=r.functions[n.i];if(e)return e.getTangentAtLength(n.fraction);if(r.initial_point)return {x:0,y:0};throw new Error("Wrong function at this part.")})),t(this,"getPropertiesAtLength",(function(t){var n=r.getPartAtLength(t),e=r.functions[n.i];if(e)return e.getPropertiesAtLength(n.fraction);if(r.initial_point)return {x:r.initial_point.x,y:r.initial_point.y,tangentX:0,tangentY:0};throw new Error("Wrong function at this part.")})),t(this,"getParts",(function(){for(var t=[],n=0;n<r.functions.length;n++)if(null!==r.functions[n]){r.functions[n]=r.functions[n];var e={start:r.functions[n].getPointAtLength(0),end:r.functions[n].getPointAtLength(r.partial_lengths[n]-r.partial_lengths[n-1]),length:r.partial_lengths[n]-r.partial_lengths[n-1],getPointAtLength:r.functions[n].getPointAtLength,getTangentAtLength:r.functions[n].getTangentAtLength,getPropertiesAtLength:r.functions[n].getPropertiesAtLength};t.push(e);}return t}));for(var g,u=function(t){var e=(t&&t.length>0?t:"M0,0").match(h);if(!e)throw new Error("No path elements found in string ".concat(t));return e.reduce((function(t,e){var h=e.charAt(0),r=h.toLowerCase(),a=s(e.substr(1));for("m"===r&&a.length>2&&(t.push([h].concat(n(a.splice(0,2)))),r="l",h="m"===h?"l":"L");a.length>=0;){if(a.length===i[r]){t.push([h].concat(n(a.splice(0,i[r]))));break}if(a.length<i[r])throw new Error('Malformed path data: "'.concat(h,'" must have ').concat(i[r]," elements and has ").concat(a.length,": ").concat(e));t.push([h].concat(n(a.splice(0,i[r]))));}return t}),[])}(e),l=[0,0],c=[0,0],f=[0,0],y=0;y<u.length;y++){if("M"===u[y][0])f=[(l=[u[y][1],u[y][2]])[0],l[1]],this.functions.push(null),0===y&&(this.initial_point={x:u[y][1],y:u[y][2]});else if("m"===u[y][0])f=[(l=[u[y][1]+l[0],u[y][2]+l[1]])[0],l[1]],this.functions.push(null);else if("L"===u[y][0])this.length+=Math.sqrt(Math.pow(l[0]-u[y][1],2)+Math.pow(l[1]-u[y][2],2)),this.functions.push(new a(l[0],u[y][1],l[1],u[y][2])),l=[u[y][1],u[y][2]];else if("l"===u[y][0])this.length+=Math.sqrt(Math.pow(u[y][1],2)+Math.pow(u[y][2],2)),this.functions.push(new a(l[0],u[y][1]+l[0],l[1],u[y][2]+l[1])),l=[u[y][1]+l[0],u[y][2]+l[1]];else if("H"===u[y][0])this.length+=Math.abs(l[0]-u[y][1]),this.functions.push(new a(l[0],u[y][1],l[1],l[1])),l[0]=u[y][1];else if("h"===u[y][0])this.length+=Math.abs(u[y][1]),this.functions.push(new a(l[0],l[0]+u[y][1],l[1],l[1])),l[0]=u[y][1]+l[0];else if("V"===u[y][0])this.length+=Math.abs(l[1]-u[y][1]),this.functions.push(new a(l[0],l[0],l[1],u[y][1])),l[1]=u[y][1];else if("v"===u[y][0])this.length+=Math.abs(u[y][1]),this.functions.push(new a(l[0],l[0],l[1],l[1]+u[y][1])),l[1]=u[y][1]+l[1];else if("z"===u[y][0]||"Z"===u[y][0])this.length+=Math.sqrt(Math.pow(f[0]-l[0],2)+Math.pow(f[1]-l[1],2)),this.functions.push(new a(l[0],f[0],l[1],f[1])),l=[f[0],f[1]];else if("C"===u[y][0])g=new _(l[0],l[1],u[y][1],u[y][2],u[y][3],u[y][4],u[y][5],u[y][6]),this.length+=g.getTotalLength(),l=[u[y][5],u[y][6]],this.functions.push(g);else if("c"===u[y][0])(g=new _(l[0],l[1],l[0]+u[y][1],l[1]+u[y][2],l[0]+u[y][3],l[1]+u[y][4],l[0]+u[y][5],l[1]+u[y][6])).getTotalLength()>0?(this.length+=g.getTotalLength(),this.functions.push(g),l=[u[y][5]+l[0],u[y][6]+l[1]]):this.functions.push(new a(l[0],l[0],l[1],l[1]));else if("S"===u[y][0]){if(y>0&&["C","c","S","s"].indexOf(u[y-1][0])>-1){if(g){var x=g.getC();g=new _(l[0],l[1],2*l[0]-x.x,2*l[1]-x.y,u[y][1],u[y][2],u[y][3],u[y][4]);}}else g=new _(l[0],l[1],l[0],l[1],u[y][1],u[y][2],u[y][3],u[y][4]);g&&(this.length+=g.getTotalLength(),l=[u[y][3],u[y][4]],this.functions.push(g));}else if("s"===u[y][0]){if(y>0&&["C","c","S","s"].indexOf(u[y-1][0])>-1){if(g){var p=g.getC(),v=g.getD();g=new _(l[0],l[1],l[0]+v.x-p.x,l[1]+v.y-p.y,l[0]+u[y][1],l[1]+u[y][2],l[0]+u[y][3],l[1]+u[y][4]);}}else g=new _(l[0],l[1],l[0],l[1],l[0]+u[y][1],l[1]+u[y][2],l[0]+u[y][3],l[1]+u[y][4]);g&&(this.length+=g.getTotalLength(),l=[u[y][3]+l[0],u[y][4]+l[1]],this.functions.push(g));}else if("Q"===u[y][0]){if(l[0]==u[y][1]&&l[1]==u[y][2]){var M=new a(u[y][1],u[y][3],u[y][2],u[y][4]);this.length+=M.getTotalLength(),this.functions.push(M);}else g=new _(l[0],l[1],u[y][1],u[y][2],u[y][3],u[y][4],void 0,void 0),this.length+=g.getTotalLength(),this.functions.push(g);l=[u[y][3],u[y][4]],c=[u[y][1],u[y][2]];}else if("q"===u[y][0]){if(0!=u[y][1]||0!=u[y][2])g=new _(l[0],l[1],l[0]+u[y][1],l[1]+u[y][2],l[0]+u[y][3],l[1]+u[y][4],void 0,void 0),this.length+=g.getTotalLength(),this.functions.push(g);else {var L=new a(l[0]+u[y][1],l[0]+u[y][3],l[1]+u[y][2],l[1]+u[y][4]);this.length+=L.getTotalLength(),this.functions.push(L);}c=[l[0]+u[y][1],l[1]+u[y][2]],l=[u[y][3]+l[0],u[y][4]+l[1]];}else if("T"===u[y][0]){if(y>0&&["Q","q","T","t"].indexOf(u[y-1][0])>-1)g=new _(l[0],l[1],2*l[0]-c[0],2*l[1]-c[1],u[y][1],u[y][2],void 0,void 0),this.functions.push(g),this.length+=g.getTotalLength();else {var w=new a(l[0],u[y][1],l[1],u[y][2]);this.functions.push(w),this.length+=w.getTotalLength();}c=[2*l[0]-c[0],2*l[1]-c[1]],l=[u[y][1],u[y][2]];}else if("t"===u[y][0]){if(y>0&&["Q","q","T","t"].indexOf(u[y-1][0])>-1)g=new _(l[0],l[1],2*l[0]-c[0],2*l[1]-c[1],l[0]+u[y][1],l[1]+u[y][2],void 0,void 0),this.length+=g.getTotalLength(),this.functions.push(g);else {var A=new a(l[0],l[0]+u[y][1],l[1],l[1]+u[y][2]);this.length+=A.getTotalLength(),this.functions.push(A);}c=[2*l[0]-c[0],2*l[1]-c[1]],l=[u[y][1]+l[0],u[y][2]+l[0]];}else if("A"===u[y][0]){var d=new o(l[0],l[1],u[y][1],u[y][2],u[y][3],1===u[y][4],1===u[y][5],u[y][6],u[y][7]);this.length+=d.getTotalLength(),l=[u[y][6],u[y][7]],this.functions.push(d);}else if("a"===u[y][0]){var P=new o(l[0],l[1],u[y][1],u[y][2],u[y][3],1===u[y][4],1===u[y][5],l[0]+u[y][6],l[1]+u[y][7]);this.length+=P.getTotalLength(),l=[l[0]+u[y][6],l[1]+u[y][7]],this.functions.push(P);}this.partial_lengths.push(this.length);}},C=function(n){var e=this;if(t(this,"inst",void 0),t(this,"getTotalLength",(function(){return e.inst.getTotalLength()})),t(this,"getPointAtLength",(function(t){return e.inst.getPointAtLength(t)})),t(this,"getTangentAtLength",(function(t){return e.inst.getTangentAtLength(t)})),t(this,"getPropertiesAtLength",(function(t){return e.inst.getPropertiesAtLength(t)})),t(this,"getParts",(function(){return e.inst.getParts()})),this.inst=new S(n),!(this instanceof C))return new C(n)};

  let Original = globalThis.Path2D;
  const path2DMap = new WeakMap();
  const pathDataMap = new WeakMap();
  const currentPathSymbol = Symbol("currentPath");
  const noLengthSegments = new Set([ "Z", "M" ]);


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
      getTotalLength() {
        const properties = new C(this.toSVGString());
        return properties.getTotalLength();
      }
      getPointAtLength(length) {
        const properties = new C(this.toSVGString());
        const { x, y } = properties.getPointAtLength(length);
        return new DOMPoint(x, y);
      }
      getPathSegmentAtLength(length) {
        const properties = new C(this.toSVGString());
        const parts = properties.getParts();
        const segments = this.getPathData();
        let totalLength = 0;
        let j = 0;
        for (let i = 0; i < segments.length; i++) {
          const segment = segments[i];
          if (noLengthSegments.has(segment.type) && i < segments.length) {
            continue;
          }
          const part = parts[j++];
          totalLength += part.length;
          if (totalLength > length) {
            return segment;
          }
        }
        return segments[segments.length - 1] || null;
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
      static __Path2D = Original;
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
}`  ;
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
  else {
    Original = Original.__Path2D;
  }

})();
