import { z } from "zod";

export const SlotSchema = z.object({
  value: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/),
  label: z.string().min(1),
});
export type Slot = z.infer<typeof SlotSchema>;

export const CutoffRuleSchema = z.object({
  before: z.string().regex(/^\d{2}:\d{2}$/),
  earliestOffsetDays: z.number().int().min(0),
  slots: z.union([z.literal("all"), z.array(z.string())]),
});
export type CutoffRule = z.infer<typeof CutoffRuleSchema>;

export const DeliverySettingsSchema = z.object({
  timezone: z.string().default("Asia/Dubai"),
  slots: z.array(SlotSchema).min(1),
  cutoffs: z.array(CutoffRuleSchema),
  maxDaysAhead: z.number().int().min(1).max(90).default(14),
  leadTimeDays: z.number().int().min(0).max(30).default(0),
  sameDayBufferMinutes: z.number().int().min(0).max(720).default(120),
  disabledWeekdays: z.array(z.number().int().min(0).max(6)).default([]),
  blackoutDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).default([]),
});
export type DeliverySettings = z.infer<typeof DeliverySettingsSchema>;

export const RuleTargetsSchema = z.object({
  collectionIds: z.array(z.string()).default([]),
  productIds: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});
export type RuleTargets = z.infer<typeof RuleTargetsSchema>;

export const RuleOverridesSchema = z.object({
  leadTimeDays: z.number().int().min(0).optional(),
  disabledWeekdays: z.array(z.number().int().min(0).max(6)).optional(),
  blackoutDates: z.array(z.string()).optional(),
  slots: z.array(z.string()).optional(),
  maxDaysAhead: z.number().int().min(1).max(90).optional(),
});
export type RuleOverrides = z.infer<typeof RuleOverridesSchema>;

export const DeliveryRuleSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  priority: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
  targets: RuleTargetsSchema,
  overrides: RuleOverridesSchema,
});
export type DeliveryRule = z.infer<typeof DeliveryRuleSchema>;

export const DEFAULT_SETTINGS: DeliverySettings = {
  timezone: "Asia/Dubai",
  slots: [
    { value: "09:00-11:00", label: "9:00 AM – 11:00 AM" },
    { value: "11:00-13:00", label: "11:00 AM – 1:00 PM" },
    { value: "13:00-15:00", label: "1:00 PM – 3:00 PM" },
    { value: "15:00-17:00", label: "3:00 PM – 5:00 PM" },
    { value: "17:00-19:00", label: "5:00 PM – 7:00 PM" },
  ],
  // Same-day until 16:00 (buffer-filtered); after 16:00 → next day, all windows.
  cutoffs: [
    { before: "16:00", earliestOffsetDays: 0, slots: "all" },
    { before: "24:00", earliestOffsetDays: 1, slots: "all" },
  ],
  maxDaysAhead: 14,
  leadTimeDays: 0,
  sameDayBufferMinutes: 120,
  disabledWeekdays: [],
  blackoutDates: [],
};

export interface ProductData {
  productId: string;
  collectionIds: string[];
  tags: string[];
}

export interface AvailabilityResponse {
  timezone: string;
  minDate: string;
  maxDate: string;
  disabledWeekdays: number[];
  blackoutDates: string[];
  defaultSlots: Slot[];
  slotsByDate: Record<string, Slot[]>;
  attrDate: string;
  attrSlot: string;
}
