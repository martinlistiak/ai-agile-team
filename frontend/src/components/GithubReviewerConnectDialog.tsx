import { ConfirmDialog } from "@/components/ConfirmDialog";
import { openGithubReviewerOAuthPopup } from "@/lib/github-reviewer-oauth";

const DEFAULT_TITLE = "Connect GitHub reviewer app";
const DEFAULT_MESSAGE =
  "The code reviewer needs a separate GitHub identity to post APPROVE and REQUEST_CHANGES on pull requests. Connect the Runa Reviewer app now so reviews work when the pipeline reaches code review.";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after OAuth completes in the popup (user connected). */
  onConnected?: () => void;
  /** Called when the user skips (optional; e.g. continue without connecting). */
  onSkip?: () => void;
  title?: string;
  message?: string;
};

export function GithubReviewerConnectDialog({
  open,
  onOpenChange,
  onConnected,
  onSkip,
  title = DEFAULT_TITLE,
  message = DEFAULT_MESSAGE,
}: Props) {
  return (
    <ConfirmDialog
      open={open}
      title={title}
      message={message}
      confirmLabel="Connect now"
      cancelLabel="Skip for now"
      onConfirm={() => {
        onOpenChange(false);
        openGithubReviewerOAuthPopup(() => {
          onConnected?.();
        });
      }}
      onCancel={() => {
        onOpenChange(false);
        onSkip?.();
      }}
    />
  );
}
