export const WORKSPACE_ROLES = ["owner", "admin", "member", "viewer"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const ICP_STATUSES = ["draft", "pending_review", "approved", "archived"] as const;
export type IcpStatus = (typeof ICP_STATUSES)[number];

export const PROSPECT_STATUSES = [
  "NEW",
  "RESEARCHING",
  "QUALIFIED",
  "SAVED",
  "CONTACTED",
  "REPLIED",
  "INTERESTED",
  "MEETING",
  "CUSTOMER",
  "NOT_INTERESTED",
  "SUPPRESSED",
] as const;
export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

export const INBOX_PROSPECT_STATUSES = ["NEW", "RESEARCHING", "QUALIFIED"] as const satisfies readonly ProspectStatus[];

export const JOB_STATUSES = ["pending", "running", "completed", "failed", "cancelled"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];
