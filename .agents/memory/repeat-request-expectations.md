---
name: Repeat request expectations
description: What the user means by returning to the start when testing another request.
---
Returning to the start for another test request should show the first wizard step with an empty request draft, while preserving the signed-in participant, connected card, and prior recorded requests.

**Why:** The user explicitly clarified that reopening the existing request screen was not enough; they need an option to start a new request from the first screen. Deleting previous records is not a restart and was not requested.

**How to apply:** Keep repeat-request navigation separate from deleting data. Verify a returning participant can submit another request and that both records remain, without repeating unchanged profile setup.
