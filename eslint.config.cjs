const js = require("@eslint/js");

module.exports = [
    js.configs.recommended,
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
