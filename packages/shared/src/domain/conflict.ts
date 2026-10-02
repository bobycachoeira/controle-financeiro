export interface ConflictInput {
  clientUpdatedAt: string;
  serverUpdatedAt: string;
  clientDeleted?: boolean;
  serverDeleted?: boolean;
}

export interface ConflictDecision {
  winner: "client" | "server";
  conflict: boolean;
  reason: "client_newer" | "server_newer_or_tie" | "tombstone_prevails";
}

export function resolveConflict(input: ConflictInput): ConflictDecision {
  if (input.serverDeleted && !input.clientDeleted) {
    return { winner: "server", conflict: true, reason: "tombstone_prevails" };
  }
  const client = Date.parse(input.clientUpdatedAt);
  const server = Date.parse(input.serverUpdatedAt);
  if (Number.isNaN(client) || Number.isNaN(server)) {
    return { winner: "server", conflict: false, reason: "server_newer_or_tie" };
  }
  if (client > server) {
    return { winner: "client", conflict: false, reason: "client_newer" };
  }
  return {
    winner: "server",
    conflict: client !== server,
    reason: "server_newer_or_tie",
  };
}
