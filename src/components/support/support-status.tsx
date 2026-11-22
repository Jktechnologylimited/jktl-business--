import { supportState } from "./support-navigation";
import styles from "./support-workspace.module.css";

export function SupportStatus({ status }: { status: unknown }) {
  const state = supportState(status);
  return <span className={styles.badge} data-tone={state.tone}><span aria-hidden="true" />{state.label}</span>;
}
