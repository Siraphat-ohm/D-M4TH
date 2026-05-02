import type { NoticeState } from "../store/app-store";

export function NoticeToast(props: { notice: NoticeState; onDismiss?: () => void }) {
  const ariaLive = props.notice.tone === "danger" ? "assertive" : "polite";
  const className = `notice-toast notice-toast--${props.notice.tone}${props.onDismiss ? " notice-toast--interactive" : ""}`;

  return (
    <div className={className} role="status" aria-live={ariaLive}>
      <span>{props.notice.text}</span>
      {props.onDismiss && (
        <button type="button" aria-label="Dismiss notice" onClick={props.onDismiss}>
          Close
        </button>
      )}
    </div>
  );
}

export function NoticeToastStack(props: { notices: Array<{ id: string; notice: NoticeState; onDismiss?: () => void }> }) {
  if (props.notices.length === 0) {
    return null;
  }

  return (
    <div className="notice-toast-stack">
      {props.notices.map((item) => (
        <NoticeToast key={item.id} notice={item.notice} onDismiss={item.onDismiss} />
      ))}
    </div>
  );
}
