import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Badge,
  Box,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { loadBothMetafields } from "../lib/metafields.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const { settings, rules } = await loadBothMetafields(admin.graphql);

  return json({
    ruleCount: rules.length,
    activeRuleCount: rules.filter((r) => r.active).length,
    timezone: settings.timezone,
    slotCount: settings.slots.length,
    maxDaysAhead: settings.maxDaysAhead,
    leadTimeDays: settings.leadTimeDays,
    sameDayBufferMinutes: settings.sameDayBufferMinutes,
  });
};

export default function Dashboard() {
  const data = useLoaderData<typeof loader>();

  return (
    <Page title="Figur Delivery Scheduler">
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Overview
                </Text>
                <InlineStack gap="400" wrap>
                  <StatCard label="Rules" value={`${data.activeRuleCount} active / ${data.ruleCount} total`} />
                  <StatCard label="Timezone" value={data.timezone} />
                  <StatCard label="Time slots" value={`${data.slotCount} available`} />
                  <StatCard label="Lead time" value={data.leadTimeDays === 0 ? "None" : `${data.leadTimeDays} day(s)`} />
                  <StatCard label="Same-day buffer" value={data.sameDayBufferMinutes === 0 ? "None" : `${data.sameDayBufferMinutes} min`} />
                  <StatCard label="Booking window" value={`${data.maxDaysAhead} days ahead`} />
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Quick actions
                </Text>
                <InlineStack gap="300">
                  <Button url="/app/settings" variant="primary">
                    Edit global settings
                  </Button>
                  <Button url="/app/rules">Manage rules</Button>
                  <Button url="/app/rules/new" variant="plain">
                    + New rule
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  How it works
                </Text>
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd">
                    <strong>Global settings</strong> define the default delivery
                    schedule — time slots, cutoff rules, lead time, and blackout
                    dates — applied to every order.
                  </Text>
                  <Text as="p" variant="bodyMd">
                    <strong>Rules</strong> let you override those defaults for
                    specific collections, products, or tags. Rules are merged
                    most-restrictively so every product in a cart can be fulfilled.
                  </Text>
                  <Text as="p" variant="bodyMd">
                    The storefront delivery picker calls the{" "}
                    <code>/apps/delivery/availability</code> endpoint on every
                    cart update to compute the correct dates and time slots in
                    real time.
                  </Text>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Box
      background="bg-surface-secondary"
      borderRadius="200"
      padding="300"
      minWidth="140px"
    >
      <BlockStack gap="100">
        <Text as="p" variant="bodySm" tone="subdued">
          {label}
        </Text>
        <Text as="p" variant="bodyMd" fontWeight="semibold">
          {value}
        </Text>
      </BlockStack>
    </Box>
  );
}
