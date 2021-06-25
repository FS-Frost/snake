/** @type {import("snowpack").SnowpackUserConfig } */
module.exports = {
    root: "./src",
    mount: {},
    plugins: [],
    packageOptions: {},
    devOptions: {
        open: "none",
    },
    buildOptions: {
        out: "./docs",
    },
    optimize: {
        bundle: false,
        minify: false,
        target: "es2018",
    },
};
