/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                memo: {
                    background: "hsl(var(--memo-background))",
                    foreground: "hsl(var(--memo-foreground))",
                    card: {
                        DEFAULT: "hsl(var(--memo-card))",
                        foreground: "hsl(var(--memo-card-foreground))",
                    },
                    popover: {
                        DEFAULT: "hsl(var(--memo-popover))",
                        foreground: "hsl(var(--memo-popover-foreground))",
                    },
                    primary: {
                        DEFAULT: "hsl(var(--memo-primary))",
                        foreground: "hsl(var(--memo-primary-foreground))",
                    },
                    secondary: {
                        DEFAULT: "hsl(var(--memo-secondary))",
                        foreground: "hsl(var(--memo-secondary-foreground))",
                    },
                    muted: {
                        DEFAULT: "hsl(var(--memo-muted))",
                        foreground: "hsl(var(--memo-muted-foreground))",
                    },
                    accent: {
                        DEFAULT: "hsl(var(--memo-accent))",
                        foreground: "hsl(var(--memo-accent-foreground))",
                    },
                    destructive: {
                        DEFAULT: "hsl(var(--memo-destructive))",
                        foreground: "hsl(var(--memo-destructive-foreground))",
                    },
                    border: "hsl(var(--memo-border))",
                    input: "hsl(var(--memo-input))",
                    ring: "hsl(var(--memo-ring))",
                },
            },
            borderRadius: {
                memo: "var(--memo-radius)",
            },
        },
    },
    plugins: [],
};
