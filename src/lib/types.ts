export const ELECTION_STATUSES = ["DRAFT", "OPEN", "CLOSED"] as const;
export type ElectionStatus = (typeof ELECTION_STATUSES)[number];

export const ROLES = ["STUDENT", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const AUDIT_ACTIONS = [
  "ELECTION_CREATED",
  "CANDIDATE_ADDED",
  "ELECTION_OPENED",
  "VOTE_CAST",
  "ELECTION_CLOSED",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
