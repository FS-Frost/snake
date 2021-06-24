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
        bundle: true,
        minify: true,
        target: "es2018",
    },
};
