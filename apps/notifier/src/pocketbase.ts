import type { NotifierConfig } from "./config.js";

interface ListResponse<T> {
  items: T[];
  totalItems: number;
  page: number;
  perPage: number;
}

export class PocketBaseClient {
  private token = "";

  constructor(private readonly config: NotifierConfig) {}

  async authenticate(): Promise<void> {
    const response = await fetch(
      `${this.config.pocketbaseUrl}/api/collections/_superusers/auth-with-password`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identity: this.config.adminEmail,
          password: this.config.adminPassword,
        }),
      },
    );
    if (!response.ok) {
      throw new Error(`PocketBase auth failed: ${response.status}`);
    }
    const data = (await response.json()) as { token: string };
    this.token = data.token;
  }

  private headers(): Record<string, string> {
    return { "Content-Type": "application/json", Authorization: `Bearer ${this.token}` };
  }

  async listAll<T>(collection: string, filter?: string): Promise<T[]> {
    const items: T[] = [];
    let page = 1;
    for (;;) {
      const params = new URLSearchParams({ page: String(page), perPage: "200" });
      if (filter) params.set("filter", filter);
      const response = await fetch(
        `${this.config.pocketbaseUrl}/api/collections/${collection}/records?${params.toString()}`,
        { headers: this.headers() },
      );
      if (!response.ok) {
        throw new Error(`list ${collection} failed: ${response.status}`);
      }
      const data = (await response.json()) as ListResponse<T>;
      items.push(...data.items);
      if (data.page * data.perPage >= data.totalItems) break;
      page += 1;
    }
    return items;
  }

  async create<T>(collection: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(
      `${this.config.pocketbaseUrl}/api/collections/${collection}/records`,
      { method: "POST", headers: this.headers(), body: JSON.stringify(body) },
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`create ${collection} failed: ${response.status} ${text}`);
    }
    return (await response.json()) as T;
  }

  async update<T>(collection: string, id: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(
      `${this.config.pocketbaseUrl}/api/collections/${collection}/records/${id}`,
      { method: "PATCH", headers: this.headers(), body: JSON.stringify(body) },
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`update ${collection}/${id} failed: ${response.status} ${text}`);
    }
    return (await response.json()) as T;
  }
}
