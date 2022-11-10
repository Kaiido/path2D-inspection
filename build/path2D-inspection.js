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

    return {
      left:   Math.min(x1, x2),
      top:    Math.min(y1, y2),
      right:  Math.max(x1, x2),
      bottom: Math.max(y1, y2),
      width:  Math.abs(x1 - x2),
      height: Math.abs(y1 - y2)
    };
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

  let Original = globalThis.Path2D;
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
