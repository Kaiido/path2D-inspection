export function arc(x, y, radius, startAngle, endAngle, ccw = false) {
  return this.ellipse(x, y, radius, radius, 0, startAngle, endAngle, ccw);
}
