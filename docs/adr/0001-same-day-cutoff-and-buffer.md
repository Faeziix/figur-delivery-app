# Same-day delivery: 4 PM cutoff + 2-hour END-based buffer

**Status:** accepted (2026-06-14)

Same-day delivery is offered for orders placed before **16:00** (Asia/Dubai);
at/after 16:00 the earliest day becomes next-day. On top of the cutoff, a same-day
**window is only offered if it ends at least 2 hours after the order time**, and
the operating day closes at **19:00** (last window 5–7 PM). The window list was
reduced to five clean back-to-back 2-hour slots (9–11, 11–1, 1–3, 3–5, 5–7).

## Considered options

- **Buffer on window _start_ (start ≥ now + 2h).** Rejected: stricter than the
  business wants and it makes the 4 PM cutoff unreachable — before 4 PM no window
  would ever start ≥ 2h ahead except 5–7 PM, so the cutoff would effectively be
  3 PM. END-based keeps the 4 PM cutoff meaningful (a 3:59 PM order still gets
  5–7 PM).
- **Fixed slot-subset bands, no real buffer** (the prior model: "before noon →
  only 4–6 PM"). Rejected: too coarse to express a rolling 2-hour buffer; the same
  evening slot was pinned regardless of how early the order came in.
- **Keep the 7 overlapping windows** (incl. 10–12 and 4–6). Rejected: under the
  buffer they surfaced redundant overlapping evening choices; five non-overlapping
  windows are clearer.

## Consequences

- The engine gained a `sameDayBufferMinutes` setting (`DEFAULT_SETTINGS = 120`);
  filtering lives in `app/lib/availability.server.ts` (`applyLeadTimeAndCutoff`).
- The **4 PM cutoff is deliberately stricter than the buffer alone** — the buffer
  by itself would allow same-day ordering until 5 PM (5–7 PM ends at 7). 4 PM is a
  hard operational wall on top.
- The buffer only filters same-day windows; if it ever empties the same-day list,
  the engine advances `minDate` to the next available day.
- Config is **code-defined** in `DEFAULT_SETTINGS`. Because `loadSettings` only
  falls back to defaults when **no** `$app:delivery/settings` metafield exists, an
  existing store must be migrated by the Settings page's **"Apply recommended
  schedule"** button, which overwrites slots + cutoffs + buffer in the metafield.
