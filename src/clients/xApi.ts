import { getXAuthHeaders, getValidXAccessToken } from "./xOAuthToken.js";

export type XApiRequestArgs = {
  method: string;
  uri: string;
  body?: unknown;
  contentType?: string;
  forceJson?: boolean;
};

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function invokeXApiRequest<T = unknown>(args: XApiRequestArgs): Promise<T> {
  const run = async (forceRefresh = false): Promise<Response> => {
    if (forceRefresh) {
      await getValidXAccessToken({ forceRefresh: true });
    }

    const authHeaders = await getXAuthHeaders();
    const contentType = args.contentType ?? "application/json";
    const isJson = args.forceJson ?? contentType.includes("application/json");

    return fetch(args.uri, {
      method: args.method,
      headers: {
        ...authHeaders,
        ...(args.body ? { "Content-Type": contentType } : {}),
      },
      body: args.body
        ? isJson
          ? JSON.stringify(args.body)
          : (args.body as BodyInit)
        : undefined,
    });
  };

  let response = await run(false);

  if (response.status === 401) {
    console.warn("[XApi] 401 erhalten, forced refresh + einmaliger Retry");
    response = await run(true);
  }

  const payload = await parseResponse(response);
  if (!response.ok) {
    const message = typeof payload === "string" ? payload : JSON.stringify(payload);
    throw new Error(`[XApi] ${args.method} ${args.uri} fehlgeschlagen (${response.status}): ${message}`);
  }

  return payload as T;
}
