class Static {
  static setP5(p2) {
    Static._p5 = p2;
  }
  static getP5() {
    return Static._p5;
  }
}
export const p = Static.getP5;
export default Static;
