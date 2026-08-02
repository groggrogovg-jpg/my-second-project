---
name: Theme switching
description: Theme persistence and shared dark-mode behavior
---

The application uses the existing `.dark` CSS token set. Theme state is shared through a React provider, persisted under the `theme` localStorage key, and applied to the document root without a page reload.

**Why:** The interface needs a consistent light/dark mode across routes, including the mobile navigation and the editor's separate header, while preserving the existing shadcn/Tailwind styling.

**How to apply:** Reuse the shared theme toggle and provider for any new header or standalone page chrome; keep `light` as the default and preserve the `theme` storage key.