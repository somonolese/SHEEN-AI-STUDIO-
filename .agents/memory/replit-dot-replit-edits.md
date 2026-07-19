---
name: Replit .replit edits
description: How to safely update .replit workflow configuration in a Replit project.
---

Direct edits to `.replit` and `replit.nix` are blocked by the agent editing system. To update them, write the full updated TOML to a temporary file in the workspace, then call `verifyAndReplaceDotReplit({ tempFilePath })` so Replit validates the file before replacing it.

**Why:** The agent file editor cannot directly modify managed configuration files, and an invalid .replit can break the project.
**How to apply:** When changing workflow commands or ports, write the new content to `/home/runner/workspace/.replit.new` (or similar) and call `verifyAndReplaceDotReplit` instead of using the Edit tool.
