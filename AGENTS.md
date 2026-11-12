# AGENTS.md — PLVS Website

This repository owns presentation for the PLVS website. Run
`npm run check -- <input-directory>` before pushing. Use the PLVS exporter to produce inputs
from exact source commits. CI uses its pinned reference to make builds reproducible.

- Keep user guide changes, policy wording and review records, and Sharesets validation in PLVS.
- Keep public URLs and download and preview paths stable. Treat published Sharesets payloads and
  previews as immutable.
- Keep the site renderer independent of PLVS application modules. Add needed product facts to the
  input contract at their source.
- Publish verified commits through the PLVS production workflow, which owns the Pages lock,
  domain, and live Catalogue history comparison.
