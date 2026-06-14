---
created: 2026-06-14T17:03:58.403Z
title: Add network icon and favicon with Icons8 attribution
area: ui
files:
  - src/app/layout.tsx
  - src/app/page.tsx
  - public/
---

## Problem

The website has no favicon or branded icon. The Icons8 "Network" icon (https://icons8.com/icon/92036/network) has been chosen as the visual identity. Icons8 requires attribution in the page footer.

## Solution

1. Download the Icons8 Network icon in appropriate sizes (16x16, 32x32, 180x180 for apple-touch-icon) and place in `public/`.
2. Wire up favicon in `src/app/layout.tsx` via Next.js metadata (`icons` config).
3. Add the required attribution link at the bottom of the main page (`src/app/page.tsx`):
   `<a target="_blank" href="https://icons8.com/icon/92036/network">Network</a> icon by <a target="_blank" href="https://icons8.com">Icons8</a>`
4. Style the attribution as a small, unobtrusive footer line.

Note: Two icon image files were provided by the user at capture time (PNG format).
