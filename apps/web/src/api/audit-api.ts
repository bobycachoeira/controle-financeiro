import { apiClient } from "./client";

export interface AuditInput {
  household?: string;
  action: string;
  entity?: string;
  entity_id?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface AuditRecord {
  id: string;
  action: string;
  entity: string;
  entity_id: string;
  user: string;
  user_name: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  created: string;
}

export interface AuditListParams {
  household?: string;
  page?: number;
  perPage?: number;
  action?: string;
  entity?: string;
  user?: string;
  from?: string;
  to?: string;
}

export interface AuditListResponse {
  items: AuditRecord[];
  total: number;
  page: number;
  perPage: number;
}

export const auditApi = {
  record: (input: AuditInput) => apiClient.post<{ ok: true }>("/audit", input),
  list: (params: AuditListParams = {}) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        query.set(key, String(value));
      }
    }
    const suffix = query.toString();
    return apiClient.get<AuditListResponse>(`/audit${suffix ? `?${suffix}` : ""}`);
  },
};
