import { useState } from "react";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { login } from "../../shopify.server";
import styles from "./styles.css?url";

export const links = () => [{ rel: "stylesheet", href: styles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const errors = await login(request);
  return { errors };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = await login(request);
  return { errors };
};

export default function Auth() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [shop, setShop] = useState("");

  const errors = actionData?.errors || loaderData.errors;

  return (
    <div className="login">
      <div className="login__card">
        <h1 className="login__title">Figur Delivery Scheduler</h1>
        <Form method="post">
          <label>
            <span>Shop domain</span>
            <input
              type="text"
              name="shop"
              value={shop}
              onChange={(e) => setShop(e.target.value)}
              placeholder="your-store.myshopify.com"
            />
          </label>
          {errors?.shop && <p className="login__error">{errors.shop}</p>}
          <button type="submit">Install app</button>
        </Form>
      </div>
    </div>
  );
}
