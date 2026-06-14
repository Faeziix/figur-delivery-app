import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { loadBothMetafields } from "../lib/metafields.server";
import {
  computeAvailability,
  fetchProductData,
} from "../lib/availability.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);

  if (!session?.accessToken) {
    return json({ error: "App not installed" }, { status: 403 });
  }

  let body: { productIds?: string[]; attrDate?: string; attrSlot?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Empty cart or malformed body — use empty product list
  }

  const productIds = (body.productIds ?? []).filter(Boolean);
  const attrDate = body.attrDate ?? "Delivery Date";
  const attrSlot = body.attrSlot ?? "Delivery Slot";

  const [{ settings, rules }, products] = await Promise.all([
    loadBothMetafields(async (q, opts) => {
      const res = await fetch(
        `https://${session.shop}/admin/api/2025-01/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": session.accessToken!,
          },
          body: JSON.stringify({ query: q, variables: opts?.variables }),
        }
      );
      return res;
    }),
    fetchProductData(session.shop, session.accessToken, productIds),
  ]);

  const availability = computeAvailability(
    settings,
    rules,
    products,
    attrDate,
    attrSlot
  );

  return json(availability, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": `https://${session.shop}`,
    },
  });
};

export const loader = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  if (!session?.accessToken) {
    return json({ error: "App not installed" }, { status: 403 });
  }

  const url = new URL(request.url);
  const productIds = url.searchParams.getAll("productIds[]").filter(Boolean);
  const attrDate = url.searchParams.get("attrDate") ?? "Delivery Date";
  const attrSlot = url.searchParams.get("attrSlot") ?? "Delivery Slot";

  const [{ settings, rules }, products] = await Promise.all([
    loadBothMetafields(async (q, opts) => {
      const res = await fetch(
        `https://${session.shop}/admin/api/2025-01/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": session.accessToken!,
          },
          body: JSON.stringify({ query: q, variables: opts?.variables }),
        }
      );
      return res;
    }),
    fetchProductData(session.shop, session.accessToken, productIds),
  ]);

  const availability = computeAvailability(
    settings,
    rules,
    products,
    attrDate,
    attrSlot
  );

  return json(availability, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
};
