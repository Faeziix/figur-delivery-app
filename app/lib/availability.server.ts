import type {
  DeliverySettings,
  DeliveryRule,
  ProductData,
  Slot,
  AvailabilityResponse,
  CutoffRule,
} from "./types";

function nowInTimezone(tz: string): {
  isoDate: string;
  hour: number;
  minute: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  return {
    isoDate: `${get("year")}-${get("month")}-${get("day")}`,
    hour: parseInt(get("hour"), 10),
    minute: parseInt(get("minute"), 10),
  };
}

function addDays(isoDate: string, n: number): string {
  const d = new Date(isoDate + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function dayOfWeek(isoDate: string): number {
  return new Date(isoDate + "T12:00:00Z").getUTCDay();
}

function isDisabledDay(
  isoDate: string,
  disabledWeekdays: number[],
  blackoutDates: string[]
): boolean {
  return (
    disabledWeekdays.includes(dayOfWeek(isoDate)) ||
    blackoutDates.includes(isoDate)
  );
}

function applyLeadTimeAndCutoff(
  now: { isoDate: string; hour: number; minute: number },
  leadTimeDays: number,
  cutoffs: CutoffRule[],
  disabledWeekdays: number[],
  blackoutDates: string[],
  allSlots: Slot[]
): {
  minDate: string;
  slotsByDate: Record<string, Slot[]>;
} {
  const currentMinutes = now.hour * 60 + now.minute;
  const slotsByDate: Record<string, Slot[]> = {};

  const sortedCutoffs = [...cutoffs].sort((a, b) => {
    const toMin = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    return toMin(a.before) - toMin(b.before);
  });

  let cutoffMatch = sortedCutoffs[sortedCutoffs.length - 1];
  for (const rule of sortedCutoffs) {
    const [h, m] = rule.before.split(":").map(Number);
    const limitMinutes = h * 60 + m;
    if (currentMinutes < limitMinutes) {
      cutoffMatch = rule;
      break;
    }
  }

  const cutoffOffsetDays = cutoffMatch.earliestOffsetDays;
  const cutoffSlots: Slot[] =
    cutoffMatch.slots === "all"
      ? allSlots
      : allSlots.filter(
          (s) =>
            (cutoffMatch.slots as string[]).includes(s.value)
        );

  const rawEarliest = addDays(
    now.isoDate,
    Math.max(leadTimeDays, cutoffOffsetDays)
  );

  let minDate = rawEarliest;
  let safety = 0;
  while (isDisabledDay(minDate, disabledWeekdays, blackoutDates) && safety < 60) {
    minDate = addDays(minDate, 1);
    safety++;
  }

  const isEarliestCutoffDay =
    rawEarliest === addDays(now.isoDate, cutoffOffsetDays) &&
    leadTimeDays <= cutoffOffsetDays;

  if (isEarliestCutoffDay && !isDisabledDay(minDate, disabledWeekdays, blackoutDates)) {
    slotsByDate[minDate] = cutoffSlots;
  }

  if (
    cutoffOffsetDays === 0 &&
    leadTimeDays === 0 &&
    !isDisabledDay(now.isoDate, disabledWeekdays, blackoutDates)
  ) {
    slotsByDate[now.isoDate] = cutoffSlots;
  }

  return { minDate, slotsByDate };
}

function mergeRules(
  settings: DeliverySettings,
  matchingRules: DeliveryRule[]
): DeliverySettings {
  if (matchingRules.length === 0) return settings;

  const leadTimeDays = Math.max(
    settings.leadTimeDays,
    ...matchingRules
      .map((r) => r.overrides.leadTimeDays)
      .filter((v): v is number => v !== undefined)
  );

  const disabledWeekdays = [
    ...new Set([
      ...settings.disabledWeekdays,
      ...matchingRules.flatMap((r) => r.overrides.disabledWeekdays ?? []),
    ]),
  ];

  const blackoutDates = [
    ...new Set([
      ...settings.blackoutDates,
      ...matchingRules.flatMap((r) => r.overrides.blackoutDates ?? []),
    ]),
  ];

  const maxDaysAhead = Math.min(
    settings.maxDaysAhead,
    ...matchingRules
      .map((r) => r.overrides.maxDaysAhead)
      .filter((v): v is number => v !== undefined)
  );

  const ruleSlotSets = matchingRules
    .map((r) => r.overrides.slots)
    .filter((v): v is string[] => v !== undefined && v.length > 0);

  let slots = settings.slots;
  if (ruleSlotSets.length > 0) {
    const intersection = settings.slots.filter((s) =>
      ruleSlotSets.every((set) => set.includes(s.value))
    );
    slots = intersection.length > 0 ? intersection : settings.slots;
  }

  return {
    ...settings,
    leadTimeDays,
    disabledWeekdays,
    blackoutDates,
    maxDaysAhead,
    slots,
  };
}

function findMatchingRules(
  rules: DeliveryRule[],
  products: ProductData[]
): DeliveryRule[] {
  return rules.filter((rule) => {
    if (!rule.active) return false;
    return products.some((product) => {
      const idMatch = rule.targets.productIds.includes(product.productId);
      const collectionMatch = rule.targets.collectionIds.some((cid) =>
        product.collectionIds.includes(cid)
      );
      const tagMatch = rule.targets.tags.some((tag) =>
        product.tags.includes(tag)
      );
      return idMatch || collectionMatch || tagMatch;
    });
  });
}

export function computeAvailability(
  settings: DeliverySettings,
  rules: DeliveryRule[],
  products: ProductData[],
  attrDate = "Delivery Date",
  attrSlot = "Delivery Slot"
): AvailabilityResponse {
  const matchingRules = findMatchingRules(rules, products);
  const effective = mergeRules(settings, matchingRules);

  const now = nowInTimezone(effective.timezone);
  const maxDate = addDays(now.isoDate, effective.maxDaysAhead);

  const { minDate, slotsByDate } = applyLeadTimeAndCutoff(
    now,
    effective.leadTimeDays,
    effective.cutoffs,
    effective.disabledWeekdays,
    effective.blackoutDates,
    effective.slots
  );

  return {
    timezone: effective.timezone,
    minDate,
    maxDate,
    disabledWeekdays: effective.disabledWeekdays,
    blackoutDates: effective.blackoutDates,
    defaultSlots: effective.slots,
    slotsByDate,
    attrDate,
    attrSlot,
  };
}

export async function fetchProductData(
  shop: string,
  accessToken: string,
  productIds: string[]
): Promise<ProductData[]> {
  if (productIds.length === 0) return [];

  const QUERY = `#graphql
    query ProductCollections($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Product {
          id
          tags
          collections(first: 20) {
            nodes { id }
          }
        }
      }
    }
  `;

  const res = await fetch(
    `https://${shop}/admin/api/2025-01/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query: QUERY, variables: { ids: productIds } }),
    }
  );

  if (!res.ok) return [];

  const body = await res.json() as {
    data: {
      nodes: Array<{
        id: string;
        tags: string[];
        collections: { nodes: { id: string }[] };
      } | null>;
    };
  };

  return (body.data?.nodes ?? [])
    .filter((n): n is NonNullable<typeof n> => n !== null)
    .map((node) => ({
      productId: node.id,
      collectionIds: node.collections.nodes.map((c) => c.id),
      tags: node.tags,
    }));
}
