# Path2D Inspection prototype

This project explores ways to enhance the [WHATWG Path2D](https://developer.mozilla.org/en-US/docs/Web/API/Path2D) interface.

## What's wrong with the current Path2D interface?

The Path2D interface greatly improved the way we write Canvas 2D code, with easy to reference path declarations that can be used by many methods of the Canvas 2D API. However as it stands, this interface is completely opaque and thus doesn't unleash all its power.

## What enhancements?

We use SVG as a prior-art example of what methods could be useful for this interface.  

Currently we added a few new methods to the Path2D interface:

### `Path2D.prototype.toSVGString()` Returns an SVG path declaration string representing the current path data.

```js
const def = path.toSVGString();
// "M0 0L150 150L180 150A30 30 0 0 1 120 150"
```
*Beware, `new Path2D(svgString).toSVGString()` doesn't necessarily match `svgString`.*


### `Path2D.prototype.getBBox()` Returns the bounding box of the Path2D object.
```js
const box = path.getBBox();
/*
 *  {
 *    left:   0
 *    top:    0
 *    right:  180
 *    bottom: 180
 *    width:  180
 *    height: 180
 *  }
 */
```

### `Path2D.prototype.getPathData()` Returns an Array of [SVGPathSegments](https://www.w3.org/TR/svg-paths/#InterfaceSVGPathSegment).

*Note that unlike in SVG this method doesn't accept the `normalize` option. Path2D always uses absolute commands.*  
```js
const segments = path.getPathData();
/*[
 *  {
 *    "type": "M",
 *    "values": [
 *      0,
 *      0
 *    ]
 *  },
 *  {
 *    "type": "L",
 *    "values": [
 *      150,
 *      150
 *    ]
 *  },
 *  ...
 */
```

### `Path2D.prototype.setPathData(sequence<SVGPathSegment>)` set the Path2D segments to the passed ones.

```js
path.setPathData([
    {
      type: "M",
      values: [
        0,
        0
      ]
    },
    {
      type: "L",
      values: [
        10,
        10
      ]
    }
  ]);
ctx.stroke(path); // draws a line from 0,0 to 10,10
```

## Planned additions:

- `Path2D.prototype.getTotalLength()`
- `Path2D.prototype.getPointAtLength()`
- `Path2D.prototype.getPathSegmentAtLength()`

## Can I use this in my own project?

This is not recommended no. This project is really just a prototype to see what could be useful additions to the specifications and doesn't aim neither 100% bug free code (testing is still done manually and doesn't cover much) nor do we aim at good performances in any way.  
Obviously we won't prevent you from using it, but you are warned.

But if you're not afraid and want to see if this can be useful then please do so and let us your feedback.

## Credits

We want to thank Vitaly Puzrin and all the contributors of https://github.com/fontello/svgpath for their awesome SVG path data parser.  
We also thank the authors of https://github.com/icons8/svg-path-bounding-box who saved us a few hours of work.
