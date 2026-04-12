import {
  createQuiz,
  revertDraft,
  updateQuiz,
  type QuizBackend,
} from "@/api/quiz";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { handleGeneralError, handleGeneralSuccess } from "@/lib/axios";
import type { Quiz } from "@/pages/create-page";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Rocket, Undo2 } from "lucide-react";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useNavigate } from "react-router";
import { toast } from "sonner";

type Props = {
  form: UseFormReturn<Quiz>;
  editMode: boolean;
  quizId?: string;
  editData?: QuizBackend;
};

function CreatePageFooter({ form, editMode, quizId, editData }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const questions = form.watch("questions");
  const [revertOpen, setRevertOpen] = useState(false);

  const currentCount = questions.length;
  const minQuestions = 3;
  const isSatisfied = currentCount >= minQuestions;

  const updateMutation = useMutation({
    mutationFn: updateQuiz,
    onSuccess: (data) => {
      handleGeneralSuccess(data);
      navigate("/quiz-set");
    },
    onError: handleGeneralError,
  });

  const createMutation = useMutation({
    mutationFn: createQuiz,
    onSuccess: (data) => {
      handleGeneralSuccess(data);
      navigate("/quiz-set");
    },
    onError: handleGeneralError,
  });

  const revertMutation = useMutation({
    mutationFn: revertDraft,
    onSuccess: (res) => {
      const payload = res.data;
      if (payload) {
        form.reset({
          title: payload.title,
          description: payload.description ?? "",
          questions: payload.questions,
        });
      }
      if (quizId) {
        queryClient.invalidateQueries({ queryKey: ["quizDetail", quizId] });
        queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      }
      handleGeneralSuccess(res);
      setRevertOpen(false);
    },
    onError: handleGeneralError,
  });

  const saveAsDraft = () => {
    const data = { ...form.getValues(), draft: true };
    if (editMode && quizId) {
      updateMutation.mutate({
        data: data as QuizBackend,
        quizId: quizId,
      });
    } else {
      createMutation.mutate(data as QuizBackend);
    }
  };

  const submitQuiz = form.handleSubmit((data) => {
    if (!isSatisfied) {
      toast.info("You must add at least 3 questions to create a quiz.");
      return;
    }
    const finalData = { ...data, draft: false };
    if (editMode && quizId) {
      updateMutation.mutate({
        data: finalData as QuizBackend,
        quizId: quizId,
      });
    } else {
      createMutation.mutate(finalData as QuizBackend);
    }
  });

  const showRevert = editMode && quizId && editData?.revertable === true;
  const busy =
    createMutation.isPending ||
    updateMutation.isPending ||
    revertMutation.isPending;

  const confirmRevert = () => {
    if (!quizId) return;
    revertMutation.mutate(quizId);
  };

  return (
    <div className="flex min-h-fit flex-1 shrink-0 items-end">
      <Dialog open={revertOpen} onOpenChange={setRevertOpen}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Revert to published version?</DialogTitle>
            <DialogDescription>
              Your draft changes will be discarded. The quiz will go back to the
              last published version.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRevertOpen(false)}
              disabled={revertMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmRevert}
              disabled={revertMutation.isPending}
            >
              Revert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="border-border flex w-full items-center justify-between border-t px-2 py-3 pb-5 max-sm:flex-col max-sm:gap-1">
        <div className="flex flex-col">
          <p
            className={`font-semibold transition-colors ${
              isSatisfied ? "text-chart-4" : "text-destructive"
            }`}
          >
            {isSatisfied
              ? `${currentCount} Questions`
              : `${currentCount} / ${minQuestions} Questions`}
          </p>

          {!isSatisfied && (
            <span className="text-xs text-white/40 max-sm:text-[10px]">
              Add {minQuestions - currentCount} more to create the quiz.
            </span>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {showRevert && (
              <Button
                disabled={busy}
                type="button"
                size="lg"
                variant="outline"
                className="border-destructive/50 text-destructive hover:bg-destructive/10 font-semibold"
                onClick={() => setRevertOpen(true)}
              >
                <Undo2 strokeWidth={2} className="size-4" />
                Revert to Published
              </Button>
            )}
            <Button
              disabled={busy}
              type="button"
              size="lg"
              className="font-semibold"
              variant="outline"
              onClick={saveAsDraft}
            >
              Save as Draft
            </Button>
            <Button
              disabled={busy}
              type="button"
              size="lg"
              className={`flex items-center font-semibold transition-all`}
              onClick={submitQuiz}
            >
              <Rocket strokeWidth={2} />
              {editMode ? "Update" : "Create"} Quiz
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreatePageFooter;
