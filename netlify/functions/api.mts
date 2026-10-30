import type { Config } from "@netlify/functions";
import { registerApiRoutes, type ApiHandler } from "../../server/api";

type Route = { method: string; pattern: RegExp; keys: string[]; handler: ApiHandler };

const buildRoutes = () => {
  const routes: Route[] = [];
  const add = (method: string) => (path: string, handler: ApiHandler) => {
    const keys: string[] = [];
    const pattern = new RegExp(
      "^" + path.replace(/:([^/]+)/g, (_, key) => { keys.push(key); return "([^/]+)"; }) + "/?$"
    );
    routes.push({ method, pattern, keys, handler });
  };
  registerApiRoutes({ get: add("GET"), post: add("POST") });
  return routes;
};

let routes: Route[] | null = null;

export default async (req: Request) => {
  routes ??= buildRoutes();
  const url = new URL(req.url);

  for (const route of routes) {
    if (route.method !== req.method) continue;
    const match = url.pathname.match(route.pattern);
    if (!match) continue;

    const params: Record<string, string> = {};
    route.keys.forEach((key, i) => { params[key] = decodeURIComponent(match[i + 1]); });

    let body: any = undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      try { body = await req.json(); } catch { body = {}; }
    }

    let statusCode = 200;
    let payload: any = null;
    const res = {
      status(code: number) { statusCode = code; return res; },
      json(data: any) { payload = data; return res; },
    };

    try {
      await route.handler(
        {
          params,
          query: Object.fromEntries(url.searchParams),
          headers: Object.fromEntries([...req.headers].map(([k, v]) => [k.toLowerCase(), v])),
          body,
        },
        res
      );
    } catch (err: any) {
      console.error("Uncaught error:", err);
      return Response.json({ error: "Internal Server Error", message: err.message }, { status: 500 });
    }

    return Response.json(payload, { status: statusCode });
  }

  return Response.json({ error: "Not found" }, { status: 404 });
};

export const config: Config = {
  path: "/api/*",
};
