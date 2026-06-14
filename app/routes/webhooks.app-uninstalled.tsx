import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { sessionStorageExport as sessionStorage } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session } = await authenticate.webhook(request);
  if (session) {
    await sessionStorage.deleteSession(session.id);
  }
  return new Response(null, { status: 200 });
};
