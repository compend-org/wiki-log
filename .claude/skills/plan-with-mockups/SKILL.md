---
name: plan-with-mockups
description: Plan a UI feature and show it as screenshots of mockups on the real site running on localhost, faked by injecting DOM into the live pages. Use when asked for a feature plan "with screenshots", "with a mockup", or "show me what you're thinking" for a UI change.
---

# Plan a feature with mockups on the real site

The goal is a plan the user can judge by looking at it: screenshots of the real
localhost pages, with the proposed UI faked in, then the implementation plan
and open questions.

Mockups are throwaway. Don't change repo code or the database to make them.
Every mockup is DOM injected into the running page, and nothing is saved.

## 1. Read before drawing

- Read the pages and components the feature touches, and the schema behind them.
- Find the real data to shoot: a seed record with pictures and enough rows to
  look like real use (query the local DB for the best candidate).
- Note the site's look: CSS variables, fonts, spacing, existing patterns
  (dialogs, inline forms, hover cards). Mockups reuse these, so the proposal
  looks like it belongs.

## 2. Run the site

- Start this worktree's dev server on a free port, in the background:
  `npx next dev -p <port>`, logging to the scratchpad.
- Use the shared local Supabase. Don't reset it or apply migrations for a mockup.
- Log in as a seed user when a page needs one. In wiki-log every seed account's
  password is `password`. Get a session from the local auth API
  (`POST http://127.0.0.1:54321/auth/v1/token?grant_type=password`) and set it as
  the `sb-127-auth-token` cookie: `base64-` + base64url(JSON session), split into
  `.0`, `.1`, … chunks of 3180 characters when longer.

## 3. Shoot with one script

Write a single Playwright script in the scratchpad (`npm i playwright-core`
there; use the Chromium under `~/Library/Caches/ms-playwright` or installed
Chrome). The T3 preview's screenshot timed out last time; `preview_evaluate` is
fine for trying an injection, but take the screenshots with the script.

The script:
- Sets the auth cookie, opens each page, waits for it to load.
- Runs one injection function per mockup with `page.evaluate`. Clone real
  elements (pictures, titles, ranks) rather than hard-coding them, and style
  with the site's CSS variables.
- Uses realistic fake content in the site's voice, including one long case and
  one empty case.
- Shoots desktop (~820 wide) and phone (390 wide) for every screen.
- Uses a tall viewport, not `fullPage: true` (fixed footers land mid-page).
- Prefixes files by round: `r1-list-desktop.png`, `r1-list-phone.png`, …

Keeping everything in one script makes re-shooting after feedback a single run.

## 4. What to shoot

- **Today:** the unchanged page, for comparison.
- **The proposal**, each state that matters: empty, filled, long content,
  editing, errors or limits if relevant.
- **Phone** versions of all of it, including sheets/dialogs and the
  on-screen keyboard where text is typed.
- **One rejected alternative**, if there was a real contender, with why not.

## 5. Check every shot before showing it

Read each PNG. Fix glitches (uneven images, overflow, clipped text, wrong
widths) and re-shoot. Don't show the user a screenshot you haven't looked at.

## 6. Report

In this order:

1. **What it looks like:** each screenshot embedded by absolute path
   (`![caption](/abs/path.png)`), with one or two sentences on what it shows
   and why.
2. **Implementation:** numbered steps naming the real files, functions and
   tables (migration, reads, writes, UI), plus what's deliberately left out.
3. **Questions before I build:** the decisions that are the user's.
4. The dev server's port, which stays running.

## Review rounds (only when asked)

If the user asks for reviewers, write a brief in the scratchpad (product, feature,
design, screenshot paths, relevant files, "read only, don't edit code") asking
for strict scores out of 10 for usability, look, and mobile, with concrete
changes for anything under the bar. Each round gets fresh reviewers. Revise,
re-shoot with the next round prefix, and report the scores each round.
