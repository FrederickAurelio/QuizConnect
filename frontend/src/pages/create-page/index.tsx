import {
  createQuiz,
  type QuizBackend,
  type QuizBackend as QuizPayload,
  updateQuiz,
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import AddNewQuestionBtn from "@/pages/create-page/components/add-new-question";
import CreatePageFooter from "@/pages/create-page/components/create-page-footer";
import DoneQuestionCard from "@/pages/create-page/components/done-question-card";
import QuestionForm from "@/pages/create-page/components/question-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useAutoSaveDraft,
  type AutoSaveStatus,
} from "@/hooks/use-auto-save-draft";
import { ArrowLeft } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useBlocker, useNavigate } from "react-router";
import { v4 as uuidv4 } from "uuid";
import z from "zod";

function createNewQuestion(): Question {
  return {
    id: uuidv4(),
    question: "Untitled Question",
    options: [
      { key: "A", text: "" },
      { key: "B", text: "" },
      { key: "C", text: "" },
      { key: "D", text: "" },
    ],
    correctKey: "" as any,
    done: false,
  };
}

const optionSchema = z.object({
  key: z.enum(["A", "B", "C", "D"]),
  text: z.string().min(1, "Please fill in this option"),
});

export const questionSchema = z.object({
  id: z.any(),
  question: z.string().min(1, "Question can't be empty!"),
  options: z
    .array(optionSchema)
    .length(4, "Each question needs exactly 4 options"),
  correctKey: z.enum(["A", "B", "C", "D"], "Pick the correct answer"),
  done: z.boolean().refine((val) => val === true, {
    message: "Click Done when you finish editing your question!",
  }),
});

export const quizSchema = z.object({
  title: z
    .string()
    .min(1, "Give your quiz a title")
    .max(100, "Title should not exceed 100chars"),
  description: z
    .string()
    .max(500, "Description should not exceed 500chars")
    .optional(),
  questions: z.array(questionSchema),
});

export type Option = z.infer<typeof optionSchema>;
export type Question = z.infer<typeof questionSchema>;
export type Quiz = z.infer<typeof quizSchema>;

type Props = {
  editMode?: boolean;
  editData?: QuizBackend;
};

function CreatePage({ editMode = false, editData }: Props) {
  const navigate = useNavigate();
  const [pendingNextPath, setPendingNextPath] = useState<string | null>(null);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const form = useForm({
    resolver: zodResolver(quizSchema),
    defaultValues: editData ?? {
      title: "Untitled Quiz",
      description: "",
      questions: [createNewQuestion()],
    },
  });

  const scrollBoxRef = useRef<HTMLDivElement | null>(null);
  const skipBlockerRef = useRef(false);
  const manualSaveBusyRef = useRef(false);
  const questions = form.watch("questions");
  const currentQuizId = editData?._id;

  const blocker = useBlocker(
    () => !skipBlockerRef.current && form.formState.isDirty,
  );

  const navigateAfterSave = useCallback(
    (path: string, options?: { replace?: boolean }) => {
      skipBlockerRef.current = true;
      navigate(path, options);
    },
    [navigate],
  );

  const autoSave = useAutoSaveDraft({
    form,
    editMode,
    quizId: currentQuizId,
    onCreatedQuizId: (newQuizId) => {
      navigateAfterSave(`/edit/${newQuizId}`, { replace: true });
    },
    externalBusyRef: manualSaveBusyRef,
  });

  const leaveSaveMutation = useMutation({
    mutationFn: async () => {
      const data = {
        ...form.getValues(),
        draft: true,
      } as QuizPayload;
      if (editMode && currentQuizId) {
        return updateQuiz({ data, quizId: currentQuizId });
      }
      const created = await createQuiz(data);
      const newQuizId = created?.data?._id;
      if (newQuizId) {
        navigate(`/edit/${newQuizId}`, { replace: true });
      }
      return created;
    },
    onSuccess: () => {
      form.reset(form.getValues(), { keepValues: true });
      blocker.proceed?.();
    },
  });

  useEffect(() => {
    if (blocker.state === "blocked") {
      setPendingNextPath(blocker.location.pathname);
      setLeaveModalOpen(true);
    }
  }, [blocker]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!form.formState.isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [form.formState.isDirty]);

  const cancelLeave = () => {
    setLeaveModalOpen(false);
    setPendingNextPath(null);
    blocker.reset?.();
  };

  const discardLeave = () => {
    setLeaveModalOpen(false);
    setPendingNextPath(null);
    blocker.proceed?.();
  };

  const saveAndLeave = () => {
    leaveSaveMutation.mutate();
  };

  const append = (newData: Question) => {
    form.setValue("questions", [...questions, newData]);

    requestAnimationFrame(() => {
      scrollBoxRef.current?.scrollTo({
        top: scrollBoxRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  };
  const remove = (id: any) => {
    const afterRemove = questions.filter((q) => q.id !== id);
    if (afterRemove.length < 1) {
      form.setValue("questions", [createNewQuestion()]);
    } else {
      form.setValue("questions", afterRemove);
    }
  };

  return (
    <div className="flex h-full w-full flex-col gap-2 px-4 pt-2">
      <Dialog
        open={leaveModalOpen}
        onOpenChange={(open) => {
          setLeaveModalOpen(open);
          if (!open && blocker.state === "blocked") {
            cancelLeave();
          }
        }}
      >
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>You have unsaved changes</DialogTitle>
            <DialogDescription>
              Do you want to save to draft before leaving?
              {pendingNextPath ? ` Destination: ${pendingNextPath}` : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={cancelLeave}
              disabled={leaveSaveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={discardLeave}
              disabled={leaveSaveMutation.isPending}
            >
              Discard
            </Button>
            <Button
              type="button"
              onClick={saveAndLeave}
              disabled={leaveSaveMutation.isPending}
            >
              Save and Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="mb-3 flex items-center gap-3">
        <div className="bg-card border-border flex w-fit items-center gap-2 rounded-full border px-4 py-1 text-lg font-semibold">
          <button
            className="hover:text-primary"
            onClick={() => {
              navigate("/quiz-set");
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <p>{editMode ? `Edit ${editData?.title}` : "Create New Quiz"}</p>
        </div>
        <AutoSaveStatusBadge
          status={autoSave.status}
          isDirty={form.formState.isDirty}
        />
      </div>
      <Form {...form}>
        {/* TITLE */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  className="focus:border-primary rounded-none border-0 border-b-2 border-transparent text-3xl! font-semibold transition-all duration-200 focus:outline-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* DESCRIPTION */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea
                  className="focus:border-primary resize-none rounded-none border-0 border-b-2 border-transparent bg-transparent! text-lg! transition-all duration-200 focus:outline-none focus-visible:ring-0"
                  placeholder="Add a description for the quiz context"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* QUESTIONS */}
        <div
          className="scroll-primary flex flex-col gap-3 overflow-y-auto"
          ref={scrollBoxRef}
        >
          {questions.map((q, qIndex) =>
            q.done ? (
              <DoneQuestionCard
                form={form}
                key={q.id}
                q={q}
                qIndex={qIndex}
                remove={remove}
              />
            ) : (
              <QuestionForm
                form={form}
                key={q.id}
                q={q}
                qIndex={qIndex}
                remove={remove}
              />
            ),
          )}
          {/* Add New Question */}
          <AddNewQuestionBtn onClick={() => append(createNewQuestion())} />
        </div>

        {/* FOOTER */}
        <CreatePageFooter
          editMode={editMode}
          quizId={editData?._id}
          form={form}
          editData={editData}
          navigateAfterSave={navigateAfterSave}
          manualSaveBusyRef={manualSaveBusyRef}
          isAutoSaving={autoSave.status === "saving"}
        />
      </Form>
    </div>
  );
}

function AutoSaveStatusBadge({
  status,
  isDirty,
}: {
  status: AutoSaveStatus;
  isDirty: boolean;
}) {
  if (status === "saving") {
    return (
      <span className="text-muted-foreground animate-pulse text-xs">
        Saving draft...
      </span>
    );
  }
  if (status === "saved") {
    return <span className="text-chart-4 text-xs">Draft saved</span>;
  }
  if (status === "error") {
    return <span className="text-destructive text-xs">Save failed</span>;
  }
  if (isDirty) {
    return <span className="text-xs text-amber-300">Unsaved changes</span>;
  }
  return null;
}

export default CreatePage;
