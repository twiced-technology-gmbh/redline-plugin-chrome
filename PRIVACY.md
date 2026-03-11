# Privacy Policy — Redline Chrome Extension

**Last updated:** March 11, 2026

## Data Collection

Redline does **not** collect, transmit, or store any personal data. All annotation data remains entirely on your local machine.

## How It Works

When you activate the annotation overlay, the extension:

1. Injects a drawing canvas into the currently active tab
2. Captures element metadata (CSS selectors, computed styles, HTML snippets) for elements you select
3. Takes a screenshot of the visible tab using Chrome's `captureVisibleTab` API
4. Saves everything as a JSON file downloaded to your local machine

## What Is NOT Collected

- No browsing history
- No personal information
- No analytics or telemetry
- No data sent to external servers
- No cookies or tracking

## Permissions

| Permission | Why |
|------------|-----|
| `activeTab` | Inject the annotation overlay into the tab you choose to annotate |
| `scripting` | Inject the drawing canvas and element inspection scripts |
| `host_permissions` | Allow annotation on any web app you're developing |

## Contact

For questions about this privacy policy, open an issue at [github.com/twiced-technology-gmbh/redline-plugin-chrome](https://github.com/twiced-technology-gmbh/redline-plugin-chrome/issues).
