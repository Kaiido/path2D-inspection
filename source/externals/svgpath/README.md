svgpath(-parser)
=======

The parser from [fontello's svgpath](https://github.com/fontello/svgpath).



Example
-------

```js
import SvgPath from "/svgpath/index.mjs";

var commands = svgpath(__your_path__)
  .toAbs()
  .unarc()
  .toString();
```


API
---

All methods are chainable (return self).


### new SvgPath(path) -> self

Constructor. Creates new `SvgPath` class instance with chainable methods.
`new` can be omited.


### SvgPath.from(path|SvgPath) -> self

Similar to `Array.from()`. Creates `SvgPath` instance from string or another
instance (data will be cloned).


### .abs() -> self

Converts all path commands to absolute.

### .unshort() -> self

Converts smooth curves `T`/`t`/`S`/`s` with "missed" control point to
generic curves (`Q`/`q`/`C`/`c`).


### .unarc() -> self

Replaces all arcs with bezier curves.


### .toString() -> string

Returns final path string.


### .iterate(function(segment, index, x, y)) -> self

Apply iterator to all path segments.

- Each iterator receives `segment`, `index`, `x` and `y` params.
  Where (x, y) - absolute coordinates of segment start point.
- Iterator can modify current segment directly (return nothing in this case).
- Iterator can return array of new segments to replace current one (`[]` means
  that current segment should be delated).


Support **the original** svgpath project (not this fork)
---------------

You can support this project via [Tidelift subscription](https://tidelift.com/subscription/pkg/npm-svgpath?utm_source=npm-svgpath&utm_medium=referral&utm_campaign=readme).
