import { createQuiz, updateQuiz } from "@/api/quiz";
import { Button } from "@/components/ui/button";
import { handleGeneralError, handleGeneralSuccess } from "@/lib/axios";
import type { Quiz } from "@/pages/create-page";
import { useMutation } from "@tanstack/react-query";
import { Rocket } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { useNavigate } from "react-router";
import { toast } from "sonner";

type Props = {
  form: UseFormReturn<Quiz>;
  editMode: boolean;
  quizId?: string;
};

function CreatePageFooter({ form, editMode, quizId }: Props) {
  const navigate = useNavigate();
  const questions = form.watch("questions");

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

  const saveAsDraft = () => {
    const data = { ...form.getValues(), draft: true };
    if (editMode && quizId) {
      updateMutation.mutate({
        data: data,
        quizId: quizId,
      });
    } else {
      createMutation.mutate(data);
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
        data: finalData,
        quizId: quizId,
      });
    } else {
      createMutation.mutate(finalData);
    }
  });

  return (
    <div className="flex min-h-fit flex-1 shrink-0 items-end">
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
          <div className="flex items-center gap-2">
            <Button
              disabled={createMutation.isPending || updateMutation.isPending}
              type="button"
              size="lg"
              className="font-semibold"
              variant="outline"
              onClick={saveAsDraft}
            >
              Save as Draft
            </Button>
            <Button
              disabled={createMutation.isPending || updateMutation.isPending}
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
