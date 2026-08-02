---
name: Legal documents
description: Shared rendering and source of truth for the subscription agreement and privacy policy
---

The subscription agreement and privacy policy are maintained as structured section data and rendered through one shared legal-document page component.

**Why:** Both documents use the same navigation, theme, footer, typography, and responsive layout; centralizing rendering prevents formatting drift when legal text changes.

**How to apply:** Update the corresponding section data rather than duplicating JSX in page components, and verify both `/legal/subscription-agreement` and `/privacy-policy` after edits.