export const OPEN_SUPPORT_ASSISTANT = "jktl:open-support-assistant";

/** Open the existing lazily loaded assistant; this never creates a support case. */
export function openSupportAssistant(returnFocus?: HTMLElement | null) {
  window.dispatchEvent(new CustomEvent(OPEN_SUPPORT_ASSISTANT, { detail: { returnFocus } }));
}

export const SUPPORT_STATES = {
  AI: { label: "With AI", tone: "blue" },
  WAITING: { label: "Waiting", tone: "orange" },
  HUMAN: { label: "With support", tone: "blue" },
  ESCALATED: { label: "Escalated", tone: "orange" },
  RESOLVED: { label: "Resolved", tone: "green" },
} as const;

export function supportState(value: unknown) {
  return SUPPORT_STATES[String(value) as keyof typeof SUPPORT_STATES] || { label: "Needs review", tone: "orange" };
}
