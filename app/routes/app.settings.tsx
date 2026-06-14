import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  Select,
  RangeSlider,
  Checkbox,
  TextField,
  Button,
  BlockStack,
  InlineStack,
  Text,
  Divider,
  Banner,
  DataTable,
  ButtonGroup,
  Box,
  Badge,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticate } from "../shopify.server";
import {
  loadSettings,
  saveSettings,
} from "../lib/metafields.server";
import {
  DeliverySettingsSchema,
  DEFAULT_SETTINGS,
  type DeliverySettings,
  type Slot,
  type CutoffRule,
} from "../lib/types";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const settings = await loadSettings(admin.graphql);
  return json({ settings });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const body = (await request.json()) as DeliverySettings;
  try {
    const settings = DeliverySettingsSchema.parse(body);
    await saveSettings(admin.graphql, settings);
    return json({ ok: true, error: null });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Invalid settings";
    return json({ ok: false, error: msg });
  }
};

const TIMEZONES = [
  { label: "Asia/Dubai (GMT+4)", value: "Asia/Dubai" },
  { label: "Asia/Riyadh (GMT+3)", value: "Asia/Riyadh" },
  { label: "Asia/Kuwait (GMT+3)", value: "Asia/Kuwait" },
  { label: "Europe/London (GMT+0/+1)", value: "Europe/London" },
  { label: "America/New_York (EST)", value: "America/New_York" },
  { label: "UTC", value: "UTC" },
];

const WEEKDAYS = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

export default function SettingsPage() {
  const { settings: initial } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();

  const [settings, setSettings] = useState<DeliverySettings>(initial as DeliverySettings);
  const [newSlot, setNewSlot] = useState({ value: "", label: "" });
  const [newBlackout, setNewBlackout] = useState("");
  const [saving, setSaving] = useState(false);

  const update = useCallback(
    (key: keyof DeliverySettings, value: unknown) => {
      setSettings((s) => ({ ...s, [key]: value }));
    },
    []
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    submit(JSON.stringify(settings), {
      method: "POST",
      encType: "application/json",
    });
    setSaving(false);
  }, [settings, submit]);

  const toggleWeekday = (day: number) => {
    const current = settings.disabledWeekdays;
    update(
      "disabledWeekdays",
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day]
    );
  };

  const addSlot = () => {
    if (!newSlot.value || !newSlot.label) return;
    if (settings.slots.find((s) => s.value === newSlot.value)) return;
    update("slots", [...settings.slots, newSlot]);
    setNewSlot({ value: "", label: "" });
  };

  const removeSlot = (value: string) => {
    update("slots", settings.slots.filter((s) => s.value !== value));
  };

  const addBlackout = () => {
    if (!newBlackout || !/^\d{4}-\d{2}-\d{2}$/.test(newBlackout)) return;
    if (settings.blackoutDates.includes(newBlackout)) return;
    update("blackoutDates", [...settings.blackoutDates, newBlackout].sort());
    setNewBlackout("");
  };

  const removeBlackout = (date: string) => {
    update("blackoutDates", settings.blackoutDates.filter((d) => d !== date));
  };

  return (
    <Page
      title="Delivery Settings"
      subtitle="Global defaults applied to every order. Rules can override these per-collection."
      primaryAction={{
        content: "Save settings",
        onAction: handleSave,
        loading: saving,
      }}
    >
      <BlockStack gap="500">
        {actionData && (
          <Banner tone={actionData.ok ? "success" : "critical"}>
            {actionData.ok ? "Settings saved." : actionData.error}
          </Banner>
        )}

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Timezone & booking window</Text>
                <FormLayout>
                  <Select
                    label="Timezone"
                    options={TIMEZONES}
                    value={settings.timezone}
                    onChange={(v) => update("timezone", v)}
                    helpText="All cutoff times are evaluated in this timezone."
                  />
                  <FormLayout.Group>
                    <RangeSlider
                      label={`Max days ahead: ${settings.maxDaysAhead}`}
                      min={1}
                      max={90}
                      value={settings.maxDaysAhead}
                      onChange={(v) => update("maxDaysAhead", v)}
                    />
                    <RangeSlider
                      label={`Lead time (days): ${settings.leadTimeDays}`}
                      min={0}
                      max={14}
                      value={settings.leadTimeDays}
                      onChange={(v) => update("leadTimeDays", v)}
                      helpText="Minimum prep days added to all cutoff logic."
                    />
                  </FormLayout.Group>
                </FormLayout>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Disabled days</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  These weekdays will never appear as selectable on the calendar.
                </Text>
                <InlineStack gap="300" wrap>
                  {WEEKDAYS.map((day) => (
                    <Checkbox
                      key={day.value}
                      label={day.label}
                      checked={settings.disabledWeekdays.includes(day.value)}
                      onChange={() => toggleWeekday(day.value)}
                    />
                  ))}
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Cutoff rules</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Determines the earliest deliverable date and slots based on when
                  the order is placed. Rules are evaluated top-to-bottom.
                </Text>
                <DataTable
                  columnContentTypes={["text", "text", "text"]}
                  headings={["Before (local time)", "Earliest delivery", "Available slots"]}
                  rows={settings.cutoffs.map((c) => [
                    c.before,
                    c.earliestOffsetDays === 0
                      ? "Same day"
                      : `+${c.earliestOffsetDays} day(s)`,
                    c.slots === "all" ? "All slots" : (c.slots as string[]).join(", "),
                  ])}
                />
                <Text as="p" variant="bodySm" tone="subdued">
                  To edit cutoffs, modify them via the rules JSON editor in a
                  future update. Current values are shown for reference.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Time slots</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Available delivery windows shown to customers. Format: HH:MM-HH:MM
                </Text>
                <BlockStack gap="200">
                  {settings.slots.map((slot) => (
                    <InlineStack key={slot.value} align="space-between" blockAlign="center">
                      <InlineStack gap="200">
                        <Badge>{slot.value}</Badge>
                        <Text as="span" variant="bodyMd">{slot.label}</Text>
                      </InlineStack>
                      <Button
                        variant="plain"
                        tone="critical"
                        onClick={() => removeSlot(slot.value)}
                      >
                        Remove
                      </Button>
                    </InlineStack>
                  ))}
                </BlockStack>
                <Divider />
                <FormLayout>
                  <FormLayout.Group>
                    <TextField
                      label="Slot value"
                      placeholder="16:00-18:00"
                      value={newSlot.value}
                      onChange={(v) => setNewSlot((s) => ({ ...s, value: v }))}
                      autoComplete="off"
                    />
                    <TextField
                      label="Slot label"
                      placeholder="4:00 PM – 6:00 PM"
                      value={newSlot.label}
                      onChange={(v) => setNewSlot((s) => ({ ...s, label: v }))}
                      autoComplete="off"
                    />
                  </FormLayout.Group>
                  <Button onClick={addSlot}>Add slot</Button>
                </FormLayout>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Blackout dates</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Specific dates that are never available for delivery (holidays, closures).
                </Text>
                <BlockStack gap="200">
                  {settings.blackoutDates.length === 0 && (
                    <Text as="p" variant="bodySm" tone="subdued">
                      No blackout dates set.
                    </Text>
                  )}
                  {settings.blackoutDates.map((date) => (
                    <InlineStack key={date} align="space-between" blockAlign="center">
                      <Text as="span" variant="bodyMd">{date}</Text>
                      <Button
                        variant="plain"
                        tone="critical"
                        onClick={() => removeBlackout(date)}
                      >
                        Remove
                      </Button>
                    </InlineStack>
                  ))}
                </BlockStack>
                <InlineStack gap="200" blockAlign="end">
                  <TextField
                    label="Date (YYYY-MM-DD)"
                    value={newBlackout}
                    onChange={setNewBlackout}
                    placeholder="2026-12-25"
                    autoComplete="off"
                  />
                  <Box paddingBlockEnd="0">
                    <Button onClick={addBlackout}>Add date</Button>
                  </Box>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
