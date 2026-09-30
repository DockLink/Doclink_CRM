export const OTHER_LOST_REASON = "Other";

// Activity outcome recorded when a lead moves to Closed Lost; not a call.
export const CLOSED_LOST_OUTCOME = "closed_lost";

export const LOST_REASON_OPTIONS = [
  "Price / budget constraints",
  "Chose a competitor",
  "No decision / stalled",
  "Wrong contact / wrong fit",
  "Timing not right",
  "Unresponsive / went dark",
  OTHER_LOST_REASON,
] as const;

export type LostReasonOption = (typeof LOST_REASON_OPTIONS)[number];

// Stored value: a preset option, or "Other: <custom detail>".
export type LostReason = string;

const OTHER_PREFIX = `${OTHER_LOST_REASON}: `;

export function formatLostReason(option: LostReasonOption, detail?: string): LostReason {
  const trimmed = detail?.trim();
  return option === OTHER_LOST_REASON && trimmed ? `${OTHER_PREFIX}${trimmed}` : option;
}

export function lostReasonCategory(reason: string): LostReasonOption | string {
  return reason === OTHER_LOST_REASON || reason.startsWith(OTHER_PREFIX) ? OTHER_LOST_REASON : reason;
}
