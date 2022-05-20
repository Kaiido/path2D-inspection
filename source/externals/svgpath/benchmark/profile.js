import * as fs from 'fs';
import * as path from 'path';
import SvgPath from '../index.mjs';

var data = fs.readFileSync(path.join(__dirname, '/samples/big.txt'), 'utf8').split(/[\r\n]/);


var p = [];

data.forEach(function (path) {
  p.push(new SvgPath(path));
});
