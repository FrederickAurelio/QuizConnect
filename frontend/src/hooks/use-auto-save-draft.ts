import { createQuiz, type QuizBackend, updateQuiz } from "@/api/quiz";
import type { Quiz } from "@/pages/create-page";
import { useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

type UseAutoSaveDraftParams = {
  form: UseFormReturn<Quiz>;
  editMode: boolean;
  quizId?: string;
  onCreatedQuizId?: (quizId: string) => void;
  externalBusyRef?: React.RefObject<boolean>;
};

const AUTO_SAVE_DELAY_MS = 20_000;
const SAVED_BADGE_HIDE_DELAY_MS = 3_000;

export function useAutoSaveDraft({
  form,
  editMode,
  quizId,
  onCreatedQuizId,
  externalBusyRef,
}: UseAutoSaveDraftParams) {
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const savePendingRef = useRef(false);
  const draftCreateHandledRef = useRef(false);
  const debounceTimeoutRef = useRef<number | null>(null);
  const savedBadgeTimeoutRef = useRef<number | null>(null);
  const onCreatedQuizIdRef = useRef(onCreatedQuizId);

  onCreatedQuizIdRef.current = onCreatedQuizId;

  useEffect(() => {
    const clearTimers = () => {
      if (debounceTimeoutRef.current !== null) {
        window.clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
      if (savedBadgeTimeoutRef.current !== null) {
        window.clearTimeout(savedBadgeTimeoutRef.current);
        savedBadgeTimeoutRef.current = null;
      }
    };

    const runAutoSave = async () => {
      if (
        savePendingRef.current ||
        externalBusyRef?.current ||
        !form.formState.isDirty
      ) {
        return;
      }

      savePendingRef.current = true;
      setStatus("saving");

      try {
        const payload: QuizBackend = {
          ...form.getValues(),
          draft: true,
        };

        if (editMode && quizId) {
          await updateQuiz({ data: payload, quizId });
        } else {
          const created = await createQuiz(payload);
          const newQuizId = created?.data?._id;
          if (
            newQuizId &&
            !draftCreateHandledRef.current &&
            onCreatedQuizIdRef.current
          ) {
            draftCreateHandledRef.current = true;
            onCreatedQuizIdRef.current(newQuizId);
          }
        }

        form.reset(form.getValues(), { keepValues: true });
        setStatus("saved");
        if (savedBadgeTimeoutRef.current !== null) {
          window.clearTimeout(savedBadgeTimeoutRef.current);
        }
        savedBadgeTimeoutRef.current = window.setTimeout(() => {
          setStatus("idle");
        }, SAVED_BADGE_HIDE_DELAY_MS);
      } catch {
        setStatus("error");
      } finally {
        savePendingRef.current = false;
      }
    };

    const subscription = form.watch(() => {
      if (debounceTimeoutRef.current !== null) {
        window.clearTimeout(debounceTimeoutRef.current);
      }
      debounceTimeoutRef.current = window.setTimeout(
        runAutoSave,
        AUTO_SAVE_DELAY_MS,
      );
    });

    return () => {
      subscription.unsubscribe();
      clearTimers();
    };
  }, [editMode, form, quizId]);

  return {
    status,
    isSaving: savePendingRef.current,
  };
}
