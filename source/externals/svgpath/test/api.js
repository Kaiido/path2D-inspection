import * as assert from 'assert';
import svgpath from '../index.mjs';

function roundPath(path, d) {
  var contourStartDeltaX = 0, contourStartDeltaY = 0, deltaX = 0, deltaY = 0, l;

  d = d || 0;

  path.segments.forEach(function (s) {
    var isRelative = (s[0].toLowerCase() === s[0]);

    switch (s[0]) {
      case 'H':
      case 'h':
        if (isRelative) { s[1] += deltaX; }
        deltaX = s[1] - s[1].toFixed(d);
        s[1] = +s[1].toFixed(d);
        return;

      case 'V':
      case 'v':
        if (isRelative) { s[1] += deltaY; }
        deltaY = s[1] - s[1].toFixed(d);
        s[1] = +s[1].toFixed(d);
        return;

      case 'Z':
      case 'z':
        deltaX = contourStartDeltaX;
        deltaY = contourStartDeltaY;
        return;

      case 'M':
      case 'm':
        if (isRelative) {
          s[1] += deltaX;
          s[2] += deltaY;
        }

        deltaX = s[1] - s[1].toFixed(d);
        deltaY = s[2] - s[2].toFixed(d);

        contourStartDeltaX = deltaX;
        contourStartDeltaY = deltaY;

        s[1] = +s[1].toFixed(d);
        s[2] = +s[2].toFixed(d);
        return;

      case 'A':
      case 'a':
        // [cmd, rx, ry, x-axis-rotation, large-arc-flag, sweep-flag, x, y]
        if (isRelative) {
          s[6] += deltaX;
          s[7] += deltaY;
        }

        deltaX = s[6] - s[6].toFixed(d);
        deltaY = s[7] - s[7].toFixed(d);

        s[1] = +s[1].toFixed(d);
        s[2] = +s[2].toFixed(d);
        s[3] = +s[3].toFixed(d + 2); // better precision for rotation
        s[6] = +s[6].toFixed(d);
        s[7] = +s[7].toFixed(d);
        return;

      default:
        // a c l q s t
        l = s.length;

        if (isRelative) {
          s[l - 2] += deltaX;
          s[l - 1] += deltaY;
        }

        deltaX = s[l - 2] - s[l - 2].toFixed(d);
        deltaY = s[l - 1] - s[l - 1].toFixed(d);

        s.forEach(function (val, i) {
          if (!i) { return; }
          s[i] = +s[i].toFixed(d);
        });
        return;
    }
  });

  return path;
}

describe('API', function () {

  describe('from', function () {
    it('string', function () {
      assert.strictEqual(
        svgpath.from('M0 0 L 10 10').toString(),
        'M0 0L10 10'
      );
    });

    it('SvgPath instance', function () {
      assert.strictEqual(
        svgpath.from(svgpath.from('M0 0 L 10 10')).toString(),
        'M0 0L10 10'
      );
    });

    it('invalid', function () {
      assert.throws(function () { svgpath.from([]); });
    });
  });

  describe('toString', function () {
    it('should not collapse multiple M', function () {
      assert.strictEqual(
        svgpath('M 10 10 M 10 100 M 100 100 M 100 10 Z').toString(),
        'M10 10M10 100M100 100M100 10Z'
      );
    });

    it('should not collapse multiple m', function () {
      assert.strictEqual(
        svgpath('m 10 10 m 10 100 m 100 100 m 100 10 z').toString(),
        'M10 10m10 100m100 100m100 10z'
      );
    });
  });

  describe('unshort - cubic', function () {
    it("shouldn't change full arc", function () {
      assert.strictEqual(
        svgpath('M10 10 C 20 20, 40 20, 50 10').unshort().toString(),
        'M10 10C20 20 40 20 50 10'
      );
    });

    it('should reflect control point after full path', function () {
      assert.strictEqual(
        svgpath('M10 10 C 20 20, 40 20, 50 10 S 80 0, 90 10').unshort().toString(),
        'M10 10C20 20 40 20 50 10 60 0 80 0 90 10'
      );
    });

    it('should copy starting point if not followed by a path', function () {
      assert.strictEqual(
        svgpath('M10 10 S 50 50, 90 10').unshort().toString(),
        'M10 10C10 10 50 50 90 10'
      );
    });

    it('should handle relative paths', function () {
      assert.strictEqual(
        svgpath('M30 50 c 10 30, 30 30, 40 0 s 30 -30, 40 0').unshort().toString(),
        'M30 50c10 30 30 30 40 0 10-30 30-30 40 0'
      );
    });
  });

  describe('unshort - quadratic', function () {
    it("shouldn't change full arc", function () {
      assert.strictEqual(
        svgpath('M10 10 Q 50 50, 90 10').unshort().toString(),
        'M10 10Q50 50 90 10'
      );
    });

    it('should reflect control point after full path', function () {
      assert.strictEqual(
        svgpath('M30 50 Q 50 90, 90 50 T 150 50').unshort().toString(),
        'M30 50Q50 90 90 50 130 10 150 50'
      );
    });

    it('should copy starting point if not followed by a path', function () {
      assert.strictEqual(
        svgpath('M10 30 T150 50').unshort().toString(),
        'M10 30Q10 30 150 50'
      );
    });

    it('should handle relative paths', function () {
      assert.strictEqual(
        svgpath('M30 50 q 20 20, 40 0 t 40 0').unshort().toString(),
        'M30 50q20 20 40 0 20-20 40 0'
      );
    });
  });

  describe('abs', function () {
    it('should convert line', function () {
      assert.strictEqual(
        svgpath('M10 10 l 30 30').abs().toString(),
        'M10 10L40 40'
      );
    });

    it("shouldn't process existing line", function () {
      assert.strictEqual(
        svgpath('M10 10 L30 30').abs().toString(),
        'M10 10L30 30'
      );
    });

    it('should convert multi-segment curve', function () {
      assert.strictEqual(
        svgpath('M10 10 c 10 30 30 30 40, 0 10 -30 20 -30 40 0').abs().toString(),
        'M10 10C20 40 40 40 50 10 60-20 70-20 90 10'
      );
    });

    it('should handle horizontal lines', function () {
      assert.strictEqual(
        svgpath('M10 10H40h50').abs().toString(),
        'M10 10H40 90'
      );
    });

    it('should handle vertical lines', function () {
      assert.strictEqual(
        svgpath('M10 10V40v50').abs().toString(),
        'M10 10V40 90'
      );
    });

    it('should handle arcs', function () {
      assert.strictEqual(
        svgpath('M40 30a20 40 -45 0 1 20 50').abs().toString(),
        'M40 30A20 40-45 0 1 60 80'
      );
    });

    it('should track position after z', function () {
      assert.strictEqual(
        svgpath('M10 10 l10 0 l0 10 Z l 0 10 l 10 0 z l-1-1').abs().toString(),
        'M10 10L20 10 20 20ZL10 20 20 20ZL9 9'
      );
    });
  });

  describe('unarc', function () {
    it('almost complete arc gets expanded to 4 curves', function () {
      assert.strictEqual(
        roundPath(svgpath('M100 100 A30 50 0 1 1 110 110').unarc(), 0).toString(),
        'M100 100C89 83 87 54 96 33 105 12 122 7 136 20 149 33 154 61 147 84 141 108 125 119 110 110'
      );
    });

    it('small arc gets expanded to one curve', function () {
      assert.strictEqual(
        roundPath(svgpath('M100 100 a30 50 0 0 1 30 30').unarc(), 0).toString(),
        'M100 100C113 98 125 110 130 130'
      );
    });

    it('unarc a circle', function () {
      assert.strictEqual(
        roundPath(svgpath('M 100, 100 m -75, 0 a 75,75 0 1,0 150,0 a 75,75 0 1,0 -150,0').unarc(), 0).toString(),
        'M100 100m-75 0C25 141 59 175 100 175 141 175 175 141 175 100 175 59 141 25 100 25 59 25 25 59 25 100'
      );
    });

    it('rounding errors', function () {
      // Coverage
      //
      // Due to rounding errors, with these exact arguments radicant
      // will be -9.974659986866641e-17, causing Math.sqrt() of that to be NaN
      //
      assert.strictEqual(
        roundPath(svgpath('M-0.5 0 A 0.09188163040671497 0.011583783896639943 0 0 1 0 0.5').unarc(), 5).toString(),
        'M-0.5 0C0.59517-0.01741 1.59491 0.08041 1.73298 0.21848 1.87105 0.35655 1.09517 0.48259 0 0.5'
      );
    });

    it('rounding errors #2', function () {
      // Coverage
      //
      // Due to rounding errors this will compute Math.acos(-1.0000000000000002)
      // and fail when calculating vector between angles
      //
      assert.strictEqual(
        roundPath(svgpath('M-0.07467194809578359 -0.3862391309812665' +
            'A1.2618792965076864 0.2013618852943182 90 0 1 -0.7558937461581081 -0.8010219619609416')
          .unarc(), 5).toString(),

        'M-0.07467-0.38624C-0.09295 0.79262-0.26026 1.65542-0.44838 1.54088' +
        '-0.63649 1.42634-0.77417 0.37784-0.75589-0.80102'
      );
    });

    it("we're already there", function () {
      // Asked to draw a curve between a point and itself. According to spec,
      // nothing shall be drawn in this case.
      //
      assert.strictEqual(
        roundPath(svgpath('M100 100A123 456 90 0 1 100 100').unarc(), 0).toString(),
        'M100 100L100 100'
      );

      assert.strictEqual(
        roundPath(svgpath('M100 100a123 456 90 0 1 0 0').unarc(), 0).toString(),
        'M100 100l0 0'
      );
    });

    it('radii are zero', function () {
      // both rx and ry are zero
      assert.strictEqual(
        roundPath(svgpath('M100 100A0 0 0 0 1 110 110').unarc(), 0).toString(),
        'M100 100L110 110'
      );

      // rx is zero
      assert.strictEqual(
        roundPath(svgpath('M100 100A0 100 0 0 1 110 110').unarc(), 0).toString(),
        'M100 100L110 110'
      );
    });
  });
});
