---
name: Dev server does not hot-reload on backend changes
description: Why server-side edits don't take effect until the workflow is restarted
---

The dev script runs the backend directly without a file-watcher; Vite's HMR only covers the client bundle, not the server process.

**Why:** editing backend code and testing immediately can silently test stale behavior, leading to misdiagnosed bugs.

**How to apply:** after any backend change, restart the app workflow before testing via curl or screenshot.
