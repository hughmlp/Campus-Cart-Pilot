---
name: Embedded pilot access
description: Browser-dependent invitation-cookie loss can block onboarding despite successful code verification.
---
Role saving must work with a server-validated invitation supplied in the same authenticated request; do not make a separate invitation cookie the sole proof.

**Why:** In the user's embedded preview, invitation verification succeeded but the immediately following role save lacked the accepted cookie. A standalone test browser retained it and initially missed this failure.

**How to apply:** Test onboarding with the pilot-access cookie absent or deliberately stripped. Preserve sign-in, verified campus-email, and server-side invitation validation; never bypass access checks to fix cookie transport.
