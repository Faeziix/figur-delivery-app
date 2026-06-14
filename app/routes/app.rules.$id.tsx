import { useState, useCallback } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useActionData, useLoaderData, useNavigate, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Checkbox,
  RangeSlider,
  Button,
  BlockStack,
  InlineStack,
  Text,
  Divider,
  Banner,
  Badge,
  Tag,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { loadRules, saveRules } from "../lib/metafields.server";
import {
  type DeliveryRule,
  type RuleOverrides,
  DEFAULT_SETTINGS,
} from "../lib/types";

function newRule(): DeliveryRule {
  return {
    id: crypto.randomUUID(),
    name: "",
    priority: 0,
    active: true,
    targets: { collectionIds: [], productIds: [], tags: [] },
    overrides: {},
  };
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const rules = await loadRules(admin.graphql);
  const rule =
    params.id === "new"
      ? newRule()
      : (rules.find((r) => r.id === params.id) ?? null);
  if (!rule) throw new Response("Rule not found", { status: 404 });
  return json({ rule, isNew: params.id === "new" });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const body = (await request.json()) as DeliveryRule;
  const rules = await loadRules(admin.graphql);
  const isNew = params.id === "new";

  if (isNew) {
    await saveRules(admin.graphql, [...rules, body]);
  } else {
    const idx = rules.findIndex((r) => r.id === body.id);
    if (idx === -1) return json({ ok: false, error: "Rule not found" });
    const updated = [...rules];
    updated[idx] = body;
    await saveRules(admin.graphql, updated);
  }

  return redirect("/app/rules");
};

const WEEKDAYS = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

export default function RuleEditor() {
  const { rule: initial, isNew } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigate = useNavigate();

  const [rule, setRule] = useState<DeliveryRule>(initial as DeliveryRule);
  const [newTag, setNewTag] = useState("");
  const [newCollectionId, setNewCollectionId] = useState("");
  const [newProductId, setNewProductId] = useState("");
  const [newBlackout, setNewBlackout] = useState("");
  const [saving, setSaving] = useState(false);

  const updateOverride = useCallback(
    (key: keyof RuleOverrides, value: unknown) => {
      setRule((r) => ({ ...r, overrides: { ...r.overrides, [key]: value } }));
    },
    []
  );

  const clearOverride = useCallback((key: keyof RuleOverrides) => {
    setRule((r) => {
      const overrides = { ...r.overrides };
      delete overrides[key];
      return { ...r, overrides };
    });
  }, []);

  const handleSave = () => {
    setSaving(true);
    submit(JSON.stringify(rule), { method: "POST", encType: "application/json" });
  };

  const toggleWeekday = (day: number) => {
    const current = rule.overrides.disabledWeekdays ?? [];
    updateOverride(
      "disabledWeekdays",
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day]
    );
  };

  const addTag = () => {
    const tag = newTag.trim();
    if (!tag || rule.targets.tags.includes(tag)) return;
    setRule((r) => ({ ...r, targets: { ...r.targets, tags: [...r.targets.tags, tag] } }));
    setNewTag("");
  };

  const addCollectionId = () => {
    const id = newCollectionId.trim();
    if (!id || rule.targets.collectionIds.includes(id)) return;
    setRule((r) => ({
      ...r,
      targets: { ...r.targets, collectionIds: [...r.targets.collectionIds, id] },
    }));
    setNewCollectionId("");
  };

  const addProductId = () => {
    const id = newProductId.trim();
    if (!id || rule.targets.productIds.includes(id)) return;
    setRule((r) => ({
      ...r,
      targets: { ...r.targets, productIds: [...r.targets.productIds, id] },
    }));
    setNewProductId("");
  };

  const addBlackout = () => {
    if (!newBlackout || !/^\d{4}-\d{2}-\d{2}$/.test(newBlackout)) return;
    const current = rule.overrides.blackoutDates ?? [];
    if (current.includes(newBlackout)) return;
    updateOverride("blackoutDates", [...current, newBlackout].sort());
    setNewBlackout("");
  };

  return (
    <Page
      title={isNew ? "New Rule" : `Edit: ${rule.name}`}
      backAction={{ content: "Rules", url: "/app/rules" }}
      primaryAction={{ content: "Save rule", onAction: handleSave, loading: saving }}
      secondaryActions={[{ content: "Cancel", onAction: () => navigate("/app/rules") }]}
    >
      <BlockStack gap="500">
        {actionData && !actionData.ok && (
          <Banner tone="critical">{actionData.error}</Banner>
        )}

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Rule details</Text>
                <FormLayout>
                  <TextField
                    label="Rule name"
                    value={rule.name}
                    onChange={(v) => setRule((r) => ({ ...r, name: v }))}
                    placeholder="Gift Boxes — 2 day lead"
                    autoComplete="off"
                  />
                  <FormLayout.Group>
                    <RangeSlider
                      label={`Priority: ${rule.priority}`}
                      min={0}
                      max={100}
                      value={rule.priority}
                      onChange={(v) => setRule((r) => ({ ...r, priority: v as number }))}
                      helpText="Higher values take precedence when merging rules."
                    />
                  </FormLayout.Group>
                  <Checkbox
                    label="Active"
                    checked={rule.active}
                    onChange={(v) => setRule((r) => ({ ...r, active: v }))}
                    helpText="Inactive rules are skipped when computing availability."
                  />
                </FormLayout>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Targets</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  This rule applies when any cart item matches at least one target.
                  Paste Shopify GIDs (e.g. gid://shopify/Collection/123456) or plain IDs.
                </Text>

                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">Collections</Text>
                  <InlineStack gap="200" wrap>
                    {rule.targets.collectionIds.map((id) => (
                      <Tag
                        key={id}
                        onRemove={() =>
                          setRule((r) => ({
                            ...r,
                            targets: {
                              ...r.targets,
                              collectionIds: r.targets.collectionIds.filter((c) => c !== id),
                            },
                          }))
                        }
                      >
                        {id.split("/").pop() ?? id}
                      </Tag>
                    ))}
                  </InlineStack>
                  <InlineStack gap="200" blockAlign="end">
                    <TextField
                      label="Collection GID"
                      labelHidden
                      value={newCollectionId}
                      onChange={setNewCollectionId}
                      placeholder="gid://shopify/Collection/123456"
                      autoComplete="off"
                    />
                    <Button onClick={addCollectionId}>Add</Button>
                  </InlineStack>
                </BlockStack>

                <Divider />

                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">Specific products</Text>
                  <InlineStack gap="200" wrap>
                    {rule.targets.productIds.map((id) => (
                      <Tag
                        key={id}
                        onRemove={() =>
                          setRule((r) => ({
                            ...r,
                            targets: {
                              ...r.targets,
                              productIds: r.targets.productIds.filter((p) => p !== id),
                            },
                          }))
                        }
                      >
                        {id.split("/").pop() ?? id}
                      </Tag>
                    ))}
                  </InlineStack>
                  <InlineStack gap="200" blockAlign="end">
                    <TextField
                      label="Product GID"
                      labelHidden
                      value={newProductId}
                      onChange={setNewProductId}
                      placeholder="gid://shopify/Product/789012"
                      autoComplete="off"
                    />
                    <Button onClick={addProductId}>Add</Button>
                  </InlineStack>
                </BlockStack>

                <Divider />

                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">Tags</Text>
                  <InlineStack gap="200" wrap>
                    {rule.targets.tags.map((tag) => (
                      <Tag
                        key={tag}
                        onRemove={() =>
                          setRule((r) => ({
                            ...r,
                            targets: {
                              ...r.targets,
                              tags: r.targets.tags.filter((t) => t !== tag),
                            },
                          }))
                        }
                      >
                        {tag}
                      </Tag>
                    ))}
                  </InlineStack>
                  <InlineStack gap="200" blockAlign="end">
                    <TextField
                      label="Tag"
                      labelHidden
                      value={newTag}
                      onChange={setNewTag}
                      placeholder="gift"
                      autoComplete="off"
                    />
                    <Button onClick={addTag}>Add</Button>
                  </InlineStack>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Overrides</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Leave a field unchecked to inherit from global settings.
                </Text>

                <FormLayout>
                  <BlockStack gap="200">
                    <Checkbox
                      label="Override lead time"
                      checked={rule.overrides.leadTimeDays !== undefined}
                      onChange={(v) =>
                        v ? updateOverride("leadTimeDays", 0) : clearOverride("leadTimeDays")
                      }
                    />
                    {rule.overrides.leadTimeDays !== undefined && (
                      <RangeSlider
                        label={`Lead time: ${rule.overrides.leadTimeDays} day(s)`}
                        min={0}
                        max={14}
                        value={rule.overrides.leadTimeDays}
                        onChange={(v) => updateOverride("leadTimeDays", v)}
                      />
                    )}
                  </BlockStack>

                  <BlockStack gap="200">
                    <Checkbox
                      label="Override max days ahead"
                      checked={rule.overrides.maxDaysAhead !== undefined}
                      onChange={(v) =>
                        v
                          ? updateOverride("maxDaysAhead", DEFAULT_SETTINGS.maxDaysAhead)
                          : clearOverride("maxDaysAhead")
                      }
                    />
                    {rule.overrides.maxDaysAhead !== undefined && (
                      <RangeSlider
                        label={`Max days: ${rule.overrides.maxDaysAhead}`}
                        min={1}
                        max={90}
                        value={rule.overrides.maxDaysAhead}
                        onChange={(v) => updateOverride("maxDaysAhead", v)}
                      />
                    )}
                  </BlockStack>

                  <BlockStack gap="200">
                    <Checkbox
                      label="Override disabled weekdays"
                      checked={rule.overrides.disabledWeekdays !== undefined}
                      onChange={(v) =>
                        v ? updateOverride("disabledWeekdays", []) : clearOverride("disabledWeekdays")
                      }
                    />
                    {rule.overrides.disabledWeekdays !== undefined && (
                      <InlineStack gap="300" wrap>
                        {WEEKDAYS.map((day) => (
                          <Checkbox
                            key={day.value}
                            label={day.label}
                            checked={(rule.overrides.disabledWeekdays ?? []).includes(day.value)}
                            onChange={() => toggleWeekday(day.value)}
                          />
                        ))}
                      </InlineStack>
                    )}
                  </BlockStack>

                  <BlockStack gap="200">
                    <Checkbox
                      label="Restrict available slots"
                      checked={rule.overrides.slots !== undefined}
                      onChange={(v) =>
                        v
                          ? updateOverride("slots", DEFAULT_SETTINGS.slots.map((s) => s.value))
                          : clearOverride("slots")
                      }
                    />
                    {rule.overrides.slots !== undefined && (
                      <BlockStack gap="100">
                        <Text as="p" variant="bodySm" tone="subdued">
                          Only checked slots will be available when this rule matches.
                        </Text>
                        {DEFAULT_SETTINGS.slots.map((slot) => (
                          <Checkbox
                            key={slot.value}
                            label={`${slot.value} — ${slot.label}`}
                            checked={(rule.overrides.slots ?? []).includes(slot.value)}
                            onChange={(checked) => {
                              const current = rule.overrides.slots ?? [];
                              updateOverride(
                                "slots",
                                checked
                                  ? [...current, slot.value]
                                  : current.filter((v) => v !== slot.value)
                              );
                            }}
                          />
                        ))}
                      </BlockStack>
                    )}
                  </BlockStack>

                  <BlockStack gap="200">
                    <Checkbox
                      label="Add blackout dates"
                      checked={rule.overrides.blackoutDates !== undefined}
                      onChange={(v) =>
                        v ? updateOverride("blackoutDates", []) : clearOverride("blackoutDates")
                      }
                    />
                    {rule.overrides.blackoutDates !== undefined && (
                      <BlockStack gap="200">
                        {(rule.overrides.blackoutDates ?? []).map((date) => (
                          <InlineStack key={date} align="space-between" blockAlign="center">
                            <Text as="span" variant="bodyMd">{date}</Text>
                            <Button
                              variant="plain"
                              tone="critical"
                              onClick={() =>
                                updateOverride(
                                  "blackoutDates",
                                  (rule.overrides.blackoutDates ?? []).filter((d) => d !== date)
                                )
                              }
                            >
                              Remove
                            </Button>
                          </InlineStack>
                        ))}
                        <InlineStack gap="200" blockAlign="end">
                          <TextField
                            label="Date"
                            labelHidden
                            value={newBlackout}
                            onChange={setNewBlackout}
                            placeholder="2026-12-25"
                            autoComplete="off"
                          />
                          <Button onClick={addBlackout}>Add</Button>
                        </InlineStack>
                      </BlockStack>
                    )}
                  </BlockStack>
                </FormLayout>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
