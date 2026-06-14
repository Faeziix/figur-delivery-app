# Figur Delivery Scheduler

The Shopify app that decides which delivery dates and time windows a customer may
pick in the cart, computed live from per-shop settings and per-product rules.

## Language

**Window** (delivery window):
A 2-hour delivery slot the customer can choose, e.g. `5:00 PM – 7:00 PM`.
_Avoid_: Slot is the code-level name (`Slot`, `slots`); say "window" in customer- and merchant-facing language. Both refer to the same thing.

**Cutoff**:
A time-of-day threshold that decides the **earliest day** an order can be delivered (same day vs +N days), evaluated in the shop **timezone**.
_Avoid_: Deadline.

**Same-day buffer**:
The minimum lead time before a **same-day window** may be offered — a same-day window is shown only if it **ends** at least this long after the order time. Applies to same-day only.
_Avoid_: Lead time (that's a separate, day-granular concept), prep time.

**Lead time**:
A whole-day minimum prep offset (`leadTimeDays`) added on top of cutoff logic. Distinct from the same-day buffer, which is minute-granular.

**Same-day delivery** / **Next-day delivery**:
Earliest day equals the order day / the day after. Determined by the matching cutoff's `earliestOffsetDays`.

**Blackout date**:
A specific calendar date that is never deliverable (holiday, closure).

**Disabled weekday**:
A weekday that is never deliverable (e.g. always-closed Fridays).

**Rule** (delivery rule):
A per-collection / per-product / per-tag override of the global settings, merged most-restrictively across every product in the cart.

**Availability**:
The computed response sent to the storefront picker: `minDate`, `maxDate`, disabled days, blackout dates, the default window list, and `slotsByDate` (per-day overrides — currently the buffer-filtered same-day list).

## Relationships

- A **shop** has one global **settings** record and zero or more **rules** (both stored as `$app:delivery` metafields).
- **Availability** is derived from **settings** + matching **rules** + the current time in the shop **timezone**.
- A **cutoff** sets the earliest day; the **same-day buffer** then filters that day's **windows**; **blackout dates** / **disabled weekdays** remove whole days.
- The **same-day buffer** only ever affects same-day **windows** — next-day and later are always beyond the buffer.

## Example dialogue

> **Dev:** "If someone orders at 3:59 PM, what same-day **windows** do they see?"
> **Merchant:** "Just 5–7 PM — every earlier window has already ended within the 2-hour **buffer**."
> **Dev:** "And at 4:00 PM exactly?"
> **Merchant:** "That's past the 4 PM **cutoff** — it rolls to **next-day**, and next-day shows every window up to our 7 PM close."

## Flagged ambiguities

- "buffer" vs "lead time" — resolved: **same-day buffer** is minute-granular and same-day only; **lead time** is whole-day and applies to all cutoff logic.
- "slot" vs "window" — same concept; "window" is the human-facing term, `Slot` is the code type.
