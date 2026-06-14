import {
  DeliverySettings,
  DeliveryRule,
  DeliverySettingsSchema,
  DEFAULT_SETTINGS,
} from "./types";

const NAMESPACE = "$app:delivery";
const KEY_SETTINGS = "settings";
const KEY_RULES = "rules";

type GraphQLFn = (
  query: string,
  options?: { variables?: object }
) => Promise<Response>;

interface MetafieldNode {
  value: string;
}

interface ShopMetafieldsData {
  shop: {
    id: string;
    settings?: MetafieldNode | null;
    rules?: MetafieldNode | null;
  };
}

const SHOP_METAFIELDS_QUERY = `#graphql
  query DeliveryAppMetafields {
    shop {
      id
      settings: metafield(namespace: "$app:delivery", key: "settings") { value }
      rules: metafield(namespace: "$app:delivery", key: "rules") { value }
    }
  }
`;

const METAFIELDS_SET_MUTATION = `#graphql
  mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { key namespace value }
      userErrors { field message }
    }
  }
`;

async function runShopQuery(graphql: GraphQLFn): Promise<ShopMetafieldsData> {
  const res = await graphql(SHOP_METAFIELDS_QUERY);
  const body = (await res.json()) as { data: ShopMetafieldsData };
  return body.data;
}

function parseSettings(raw: string | null | undefined): DeliverySettings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return DeliverySettingsSchema.parse(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function parseRules(raw: string | null | undefined): DeliveryRule[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as DeliveryRule[];
  } catch {
    return [];
  }
}

export async function loadSettings(
  graphql: GraphQLFn
): Promise<DeliverySettings> {
  const data = await runShopQuery(graphql);
  return parseSettings(data.shop.settings?.value);
}

export async function saveSettings(
  graphql: GraphQLFn,
  settings: DeliverySettings
): Promise<void> {
  const data = await runShopQuery(graphql);
  const shopGid = data.shop.id;

  const res = await graphql(METAFIELDS_SET_MUTATION, {
    variables: {
      metafields: [
        {
          namespace: NAMESPACE,
          key: KEY_SETTINGS,
          ownerId: shopGid,
          type: "json",
          value: JSON.stringify(settings),
        },
      ],
    },
  });
  const body = (await res.json()) as {
    data: { metafieldsSet: { userErrors: { message: string }[] } };
  };
  const errors = body.data?.metafieldsSet?.userErrors;
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(", "));
}

export async function loadRules(graphql: GraphQLFn): Promise<DeliveryRule[]> {
  const data = await runShopQuery(graphql);
  return parseRules(data.shop.rules?.value);
}

export async function saveRules(
  graphql: GraphQLFn,
  rules: DeliveryRule[]
): Promise<void> {
  const data = await runShopQuery(graphql);
  const shopGid = data.shop.id;

  const res = await graphql(METAFIELDS_SET_MUTATION, {
    variables: {
      metafields: [
        {
          namespace: NAMESPACE,
          key: KEY_RULES,
          ownerId: shopGid,
          type: "json",
          value: JSON.stringify(rules),
        },
      ],
    },
  });
  const body = (await res.json()) as {
    data: { metafieldsSet: { userErrors: { message: string }[] } };
  };
  const errors = body.data?.metafieldsSet?.userErrors;
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(", "));
}

export async function loadBothMetafields(graphql: GraphQLFn): Promise<{
  settings: DeliverySettings;
  rules: DeliveryRule[];
}> {
  const data = await runShopQuery(graphql);
  return {
    settings: parseSettings(data.shop.settings?.value),
    rules: parseRules(data.shop.rules?.value),
  };
}
