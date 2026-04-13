import type { QuizListItem } from "@/api/quiz";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type QuizSetDialogsProps = {
  copyTarget: QuizListItem | null;
  onCopyDismiss: () => void;
  onCopyPublished: () => void;
  onCopyDraft: () => void;
  copyPending: boolean;
  deleteTarget: QuizListItem | null;
  onDeleteDismiss: () => void;
  onConfirmDelete: () => void;
  deletePending: boolean;
};

/** Single pair of dialogs for the whole library (not per QuizCard in the grid). */
export function QuizSetDialogs({
  copyTarget,
  onCopyDismiss,
  onCopyPublished,
  onCopyDraft,
  copyPending,
  deleteTarget,
  onDeleteDismiss,
  onConfirmDelete,
  deletePending,
}: QuizSetDialogsProps) {
  return (
    <>
      <Dialog
        open={copyTarget !== null}
        onOpenChange={(open) => {
          if (!open) onCopyDismiss();
        }}
      >
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Copy quiz</DialogTitle>
            <DialogDescription>
              This quiz has unsaved edits. Choose whether to copy the published
              version (what you can host) or the draft with your latest changes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              type="button"
              className="w-full"
              disabled={copyPending}
              onClick={onCopyPublished}
            >
              Copy published version
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={copyPending}
              onClick={onCopyDraft}
            >
              Copy draft (unsaved edits)
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={copyPending}
              onClick={onCopyDismiss}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) onDeleteDismiss();
        }}
      >
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this quiz?</DialogTitle>
            <DialogDescription>
              {deleteTarget ? (
                <>
                  <span className="text-foreground font-medium">
                    &ldquo;{deleteTarget.title}&rdquo;
                  </span>{" "}
                  will be permanently removed. This cannot be undone, including
                  any unsaved draft.
                </>
              ) : (
                "This cannot be undone."
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onDeleteDismiss}
              disabled={deletePending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirmDelete}
              disabled={deletePending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
