import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  ResourceList,
  ResourceItem,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Badge,
  EmptyState,
  Banner,
} from "@shopify/polaris";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import { loadRules, saveRules } from "../lib/metafields.server";
import type { DeliveryRule } from "../lib/types";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const rules = await loadRules(admin.graphql);
  return json({ rules });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const { intent, ruleId } = (await request.json()) as {
    intent: string;
    ruleId: string;
  };

  const rules = await loadRules(admin.graphql);

  if (intent === "delete") {
    const updated = rules.filter((r) => r.id !== ruleId);
    await saveRules(admin.graphql, updated);
    return json({ ok: true });
  }

  if (intent === "toggle") {
    const updated = rules.map((r) =>
      r.id === ruleId ? { ...r, active: !r.active } : r
    );
    await saveRules(admin.graphql, updated);
    return json({ ok: true });
  }

  return json({ ok: false, error: "Unknown intent" });
};

export default function RulesIndex() {
  const { rules } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const handleToggle = (ruleId: string) => {
    submit(JSON.stringify({ intent: "toggle", ruleId }), {
      method: "POST",
      encType: "application/json",
    });
  };

  const handleDelete = (ruleId: string) => {
    if (!confirm("Delete this rule?")) return;
    submit(JSON.stringify({ intent: "delete", ruleId }), {
      method: "POST",
      encType: "application/json",
    });
  };

  const targetSummary = (rule: DeliveryRule) => {
    const parts: string[] = [];
    if (rule.targets.collectionIds.length > 0)
      parts.push(`${rule.targets.collectionIds.length} collection(s)`);
    if (rule.targets.productIds.length > 0)
      parts.push(`${rule.targets.productIds.length} product(s)`);
    if (rule.targets.tags.length > 0)
      parts.push(`tags: ${rule.targets.tags.join(", ")}`);
    return parts.join(" · ") || "No targets";
  };

  const overrideSummary = (rule: DeliveryRule) => {
    const parts: string[] = [];
    if (rule.overrides.leadTimeDays !== undefined)
      parts.push(`${rule.overrides.leadTimeDays}d lead`);
    if (rule.overrides.slots?.length)
      parts.push(`${rule.overrides.slots.length} slots`);
    if (rule.overrides.disabledWeekdays?.length)
      parts.push(`${rule.overrides.disabledWeekdays.length} day(s) off`);
    if (rule.overrides.blackoutDates?.length)
      parts.push(`${rule.overrides.blackoutDates.length} blackout(s)`);
    return parts.join(" · ") || "No overrides";
  };

  return (
    <Page
      title="Delivery Rules"
      subtitle="Override global settings for specific collections, products, or tags."
      primaryAction={{
        content: "New rule",
        url: "/app/rules/new",
      }}
    >
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            {rules.length === 0 ? (
              <Card>
                <EmptyState
                  heading="No rules yet"
                  image=""
                  action={{ content: "Create first rule", url: "/app/rules/new" }}
                >
                  <Text as="p" variant="bodyMd">
                    Rules let you apply different delivery schedules to specific
                    collections, products, or tags. If no rule matches the cart,
                    the global settings apply.
                  </Text>
                </EmptyState>
              </Card>
            ) : (
              <Card padding="0">
                <ResourceList
                  items={rules as DeliveryRule[]}
                  renderItem={(rule) => (
                    <ResourceItem
                      id={rule.id}
                      url={`/app/rules/${rule.id}`}
                      accessibilityLabel={`Edit ${rule.name}`}
                    >
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack gap="100">
                          <InlineStack gap="200" blockAlign="center">
                            <Text as="span" variant="bodyMd" fontWeight="semibold">
                              {rule.name}
                            </Text>
                            <Badge tone={rule.active ? "success" : "info"}>
                              {rule.active ? "Active" : "Inactive"}
                            </Badge>
                          </InlineStack>
                          <Text as="span" variant="bodySm" tone="subdued">
                            {targetSummary(rule)} · {overrideSummary(rule)}
                          </Text>
                        </BlockStack>
                        <InlineStack gap="200">
                          <Button
                            variant="plain"
                            onClick={() => handleToggle(rule.id)}
                          >
                            {rule.active ? "Disable" : "Enable"}
                          </Button>
                          <Button
                            variant="plain"
                            tone="critical"
                            onClick={() => handleDelete(rule.id)}
                          >
                            Delete
                          </Button>
                        </InlineStack>
                      </InlineStack>
                    </ResourceItem>
                  )}
                />
              </Card>
            )}
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
