import { Session } from "@shopify/shopify-api";
import { Redis } from "@upstash/redis";

const SESSION_TTL = 60 * 60 * 24 * 30;

function sessionKey(id: string) {
  return `delivery:session:${id}`;
}
function shopKey(shop: string) {
  return `delivery:shop:${shop}:sessions`;
}

let redis: Redis | null = null;

function resolveRedisCredentials(): { url: string; token: string } | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

function getRedis(): Redis | null {
  if (redis) return redis;
  const credentials = resolveRedisCredentials();
  if (!credentials) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[session] No Redis credentials found — sessions will not persist across serverless invocations."
      );
    }
    return null;
  }
  redis = new Redis(credentials);
  return redis;
}

type SessionMap = Record<string, object>;
type ShopIndex = Record<string, string[]>;

const memoryStore: SessionMap = {};
const shopIndex: ShopIndex = {};

function sessionFromObject(data: object): Session {
  return Session.fromPropertyArray(
    Object.entries(data).map(([k, v]) => [k, String(v)])
  );
}

export const sessionStorage = {
  async storeSession(session: Session): Promise<boolean> {
    const data = session.toObject();
    const r = getRedis();
    if (r) {
      await r.set(sessionKey(session.id), JSON.stringify(data), {
        ex: SESSION_TTL,
      });
      await r.sadd(shopKey(session.shop), session.id);
    } else {
      memoryStore[session.id] = data;
      shopIndex[session.shop] = [
        ...new Set([...(shopIndex[session.shop] || []), session.id]),
      ];
    }
    return true;
  },

  async loadSession(id: string): Promise<Session | undefined> {
    const r = getRedis();
    if (r) {
      const raw = await r.get<string>(sessionKey(id));
      if (!raw) return undefined;
      const data =
        typeof raw === "string" ? (JSON.parse(raw) as object) : (raw as object);
      return sessionFromObject(data);
    }
    const data = memoryStore[id];
    return data ? sessionFromObject(data) : undefined;
  },

  async deleteSession(id: string): Promise<boolean> {
    const r = getRedis();
    if (r) {
      const raw = await r.get<string>(sessionKey(id));
      if (raw) {
        const data =
          typeof raw === "string"
            ? (JSON.parse(raw) as { shop?: string })
            : (raw as { shop?: string });
        if (data?.shop) await r.srem(shopKey(data.shop), id);
      }
      await r.del(sessionKey(id));
    } else {
      const data = memoryStore[id] as { shop?: string } | undefined;
      if (data?.shop) {
        shopIndex[data.shop] = (shopIndex[data.shop] || []).filter(
          (s) => s !== id
        );
      }
      delete memoryStore[id];
    }
    return true;
  },

  async deleteSessions(ids: string[]): Promise<boolean> {
    for (const id of ids) await this.deleteSession(id);
    return true;
  },

  async findSessionsByShop(shop: string): Promise<Session[]> {
    const r = getRedis();
    if (r) {
      const ids = (await r.smembers(shopKey(shop))) as string[];
      const sessions: Session[] = [];
      for (const id of ids) {
        const s = await this.loadSession(id);
        if (s) sessions.push(s);
      }
      return sessions;
    }
    const ids = shopIndex[shop] || [];
    const sessions: Session[] = [];
    for (const id of ids) {
      const s = await this.loadSession(id);
      if (s) sessions.push(s);
    }
    return sessions;
  },
};
