## Summary

Shorten the root README by keeping the “what/why/how to run” essentials plus development/contributing info, while removing or collapsing long, deep-dive reference sections that make the file hard to scan.

## Current State Analysis

- The project README at [README.md](file:///workspace/README.md) is long and highly detailed.
- The majority of length comes from:
  - Deep-dive API explanations (per-layer clipping details, gitver replacement details)
  - A full “Security & Bot Protection” section with configuration and examples
  - Multiple extended examples and long explanatory prose
- The repository itself is small and serverless-focused:
  - Main endpoint: [banner.js](file:///workspace/api/banner.js)
  - Static editor: [index.html](file:///workspace/public/index.html)
  - No test harness is defined in [package.json](file:///workspace/package.json)

## Proposed Changes

### 1) Rewrite README structure for scanability (single pass)

Update [README.md](file:///workspace/README.md) to a shorter structure:

- Header (keep centered title; keep banner image if it still feels useful)
- One-sentence description (tightened)
- Features (reduce to ~4–5 bullets, merging overlapping items)
- Quick Start
  - Vercel deploy button (keep)
  - Local development steps (keep; keep the “open localhost” line)
- API (short)
  - Endpoint: `GET /api/banner`
  - Query parameters table (keep, but only the top-level parameters)
  - Layer formats (keep the `text=` and `image=` formats with one example each)
  - One line for layer ordering (keep)
  - One short “Advanced behavior” note pointing to source for details:
    - Clipping behavior, gitver expansion, caching, rate limiting/bot protection → “See [api/banner.js](file:///workspace/api/banner.js)”
- Examples (keep 1–2 examples total; remove extras)
- Development (must stay, per requirement)
  - Directory structure block (keep, possibly shortened)
  - Performance/config bullets (keep but tighten wording)
- License + Contributing (keep)

### 2) Remove high-length sections that are not essential for first-time usage

Delete or replace with a single-line note (with a code pointer):

- “Per-Layer Content Clipping” deep-dive section
- “GitHub Version Badge in Text” deep-dive section
- Entire “Security & Bot Protection” section (replace with a single bullet/note: “Includes basic bot protection (rate limit + UA checks). See banner.js for configuration.”)

## Assumptions & Decisions (Locked)

- Goal is a README that is quick to scan for new users; advanced details are discoverable by reading the implementation.
- No new documentation files will be created (the change stays confined to README only).
- The README will continue to be valid for both API consumers and contributors by preserving the Development + Contributing sections.

## Verification Steps

- Open [README.md](file:///workspace/README.md) and confirm:
  - Markdown renders cleanly (tables/code blocks)
  - All links still work (LICENSE, api/banner.js, local dev URL)
  - The shortened README still contains: deploy instructions, local dev instructions, API endpoint, core parameters, layer formats, development/contributing info
