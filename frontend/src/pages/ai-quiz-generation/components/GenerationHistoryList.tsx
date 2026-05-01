import type { GenerationItem } from "@/api/ai-quiz-generation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import GenerationHistoryItem from "./GenerationHistoryItem";

type Props = {
  items: GenerationItem[];
  onOpenQuiz: (quizId: string) => void;
  onDelete: (generationId: string) => Promise<void>;
  deletePending: boolean;
};

export default function GenerationHistoryList({
  items,
  onOpenQuiz,
  onDelete,
  deletePending,
}: Props) {
  const [deleteTarget, setDeleteTarget] = useState<GenerationItem | null>(null);

  const closeDeleteDialog = () => {
    if (deletePending) return;
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await onDelete(deleteTarget.generationId);
    setDeleteTarget(null);
  };

  return (
    <>
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="bg-card border-border rounded-xl border p-6 text-sm text-white/50">
            No generation record yet. Prepare a file and click Generate.
          </div>
        ) : (
          items.map((item) => (
            <GenerationHistoryItem
              key={item.generationId}
              item={item}
              onOpenQuiz={onOpenQuiz}
              onDelete={setDeleteTarget}
              deletePending={deletePending}
            />
          ))
        )}
      </div>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) closeDeleteDialog();
        }}
      >
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete generation history?</DialogTitle>
            <DialogDescription>
              {deleteTarget ? (
                <>
                  This will remove this generation record from your history.
                  {deleteTarget.status === "DONE" && deleteTarget.quizTitle ? (
                    <>
                      {" "}
                      Quiz{" "}
                      <span className="text-foreground font-medium">
                        &ldquo;{deleteTarget.quizTitle}&rdquo;
                      </span>{" "}
                      will not be deleted.
                    </>
                  ) : null}
                </>
              ) : (
                "This action cannot be undone."
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeDeleteDialog}
              disabled={deletePending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
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
