---
name: Unpatched dependencies
description: Security remediation when an upstream package has no patched release.
---

When no patched release exists, prefer removing or replacing the dependency path with a maintained engine or native API that preserves the behavior the app actually uses. Do not relabel an affected package or suppress its finding to make a scan pass.

**Why:** An upstream dependency may remain vulnerable even in its latest release; upgrading its parent alone does not necessarily resolve it.

**How to apply:** Check current upstream releases before choosing a fix. If a replacement is needed, verify request/response behavior and file-discovery semantics, not only the absence of the vulnerable package.
