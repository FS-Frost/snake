class Static {
    private static _p5: p5;

    static setP5(p: p5) {
        Static._p5 = p;
    }

    static getP5(): p5 {
        return Static._p5;
    }
}

export const p = Static.getP5;

export default Static;
