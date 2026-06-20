const js = require("@eslint/js");
const html = require("eslint-plugin-html");

module.exports = [
    js.configs.recommended,
    {
        files: ["**/*.html"],
        plugins: { html },
    },
    {
        languageOptions: {
            ecmaVersion: 2015,
            sourceType: "script",
            globals: {
                window: "readonly",
                document: "readonly",
                L: "readonly",
                Intl: "readonly",
                fetch: "readonly",
                setTimeout: "readonly",
                clearTimeout: "readonly",
                console: "readonly",
            },
        },
    },
];
