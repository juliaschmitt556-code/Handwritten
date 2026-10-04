/* GENERATED FROM tokens.json -- DO NOT EDIT. Run scripts/build-tokens.mjs. */
// Portable design tokens (colors as hex). Web consumes the theme via
// src/index.css; mobile (Expo) and any other platform import this object so the
// whole product shares one source of truth.
export const tokens = {
  "color": {
    "light": {
      "background": "#fbf5f1",
      "foreground": "#463936",
      "border": "#e7d9d2",
      "card": "#fffbf5",
      "cardForeground": "#463936",
      "popover": "#fffbf5",
      "popoverForeground": "#463936",
      "primary": "#a85f68",
      "primaryForeground": "#fffdfb",
      "secondary": "#f2e2e1",
      "secondaryForeground": "#533b3c",
      "muted": "#f2ebe6",
      "mutedForeground": "#75635f",
      "accent": "#e3c7a5",
      "accentForeground": "#4e382b",
      "destructive": "#9c3f48",
      "destructiveForeground": "#fff8f7",
      "input": "#ddc8c0",
      "ring": "#a85f68",
      "chart1": "#a85f68",
      "chart2": "#be8b58",
      "chart3": "#77846b",
      "chart4": "#816476",
      "chart5": "#c67a61",
      "sidebar": "#f7ebe8",
      "sidebarForeground": "#463936",
      "sidebarBorder": "#e5d3ce",
      "sidebarPrimary": "#a85f68",
      "sidebarPrimaryForeground": "#fffdfb",
      "sidebarAccent": "#f1dfdd",
      "sidebarAccentForeground": "#533b3c",
      "sidebarRing": "#a85f68"
    },
    "dark": {
      "background": "#211918",
      "foreground": "#f7eee8",
      "border": "#4a3836",
      "card": "#2b211f",
      "cardForeground": "#f7eee8",
      "popover": "#2e2321",
      "popoverForeground": "#f7eee8",
      "primary": "#d58a93",
      "primaryForeground": "#301b20",
      "secondary": "#4d3538",
      "secondaryForeground": "#f9ecea",
      "muted": "#392d2b",
      "mutedForeground": "#c8b5af",
      "accent": "#72583e",
      "accentForeground": "#fff0d8",
      "destructive": "#713138",
      "destructiveForeground": "#ffe9e9",
      "input": "#5a4140",
      "ring": "#d58a93",
      "chart1": "#db9099",
      "chart2": "#d0a06a",
      "chart3": "#9cab8a",
      "chart4": "#b69ab4",
      "chart5": "#d58a6d",
      "sidebar": "#1a1413",
      "sidebarForeground": "#f4e8e3",
      "sidebarBorder": "#3d2d2b",
      "sidebarPrimary": "#d58a93",
      "sidebarPrimaryForeground": "#301b20",
      "sidebarAccent": "#352727",
      "sidebarAccentForeground": "#f4e8e3",
      "sidebarRing": "#d58a93"
    }
  },
  "fontFamily": {
    "sans": [
      "DM Sans",
      "sans-serif"
    ],
    "serif": [
      "Cormorant Garamond",
      "serif"
    ],
    "mono": [
      "Geist Mono",
      "monospace"
    ]
  },
  "radius": "0.75rem",
  "spacing": "0.25rem"
} as const;

export type Tokens = typeof tokens;
export default tokens;
