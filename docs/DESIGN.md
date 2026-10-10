# Workspace design

The default palette uses #0B0F0C for the canvas, #171E16 for raised controls, #F1F1E9 for text and #F5A332 for amber actions. Inter is hosted with the static build. Muted olive borders and restrained status tones keep order data legible without neon effects or an external dashboard template. The brand mark is CSS geometry; navigation uses consistent Lucide icons.

The left rail supports collapse and current-page state; small screens use an overlay menu. Page headers, filters, tab views, data tables, status badges, metric cards, timeline, immutable note feed, structured price conflict, drawers and dialogs share the same primitives. Tables scroll inside their own container; the page itself does not overflow. Dialogs trap focus, close on Escape and return focus to their trigger. Loading, empty, permission and server conflict states are real UI states.

Preference storage contains only theme and saved order views. Authentication/CSRF remains in the HttpOnly cookie and module memory. Dark/light themes, reduced motion, keyboard Ctrl/Cmd+K search, arrows/Enter/Escape and 390/768/1024/1280/1440 widths are exercised against real Staff API fixture data. Screenshots are test artifacts, not seeded production metrics.
