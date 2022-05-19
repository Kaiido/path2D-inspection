export function rect(x, y, width, height) {

  this.moveTo(x, y);
  this.lineTo(x + width, y);
  this.lineTo(x + width, y + height);
  this.lineTo(x, y + height);
  this.closePath();

  const { lastPoint } = this;
  lastPoint.x = x;
  lastPoint.y = y;

}
