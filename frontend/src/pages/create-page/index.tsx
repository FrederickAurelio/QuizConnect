import type { QuizBackend } from "@/api/quiz";
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
import { ArrowLeft } from "lucide-react";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
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
  const form = useForm({
    resolver: zodResolver(quizSchema),
    defaultValues: editData ?? {
      title: "Untitled Quiz",
      description: "",
      questions: [createNewQuestion()],
    },
  });

  const scrollBoxRef = useRef<HTMLDivElement | null>(null);
  const questions = form.watch("questions");

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
    <div className="w-full h-full pt-2 px-4 flex flex-col gap-2">
      <div className="bg-card border-border border rounded-full w-fit px-4 py-1 font-semibold flex items-center gap-2 mb-3 text-lg">
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
      <Form {...form}>
        {/* TITLE */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  className="border-0 rounded-none border-b-2 border-transparent text-3xl! font-semibold focus:border-primary focus:outline-none transition-all duration-200"
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
                  className="bg-transparent! text-lg! resize-none border-0 rounded-none border-b-2 border-transparent focus:border-primary focus:outline-none transition-all duration-200 focus-visible:ring-0"
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
          className="flex flex-col gap-3 overflow-y-auto scroll-primary"
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
            )
          )}
          {/* Add New Question */}
          <AddNewQuestionBtn onClick={() => append(createNewQuestion())} />
        </div>

        {/* FOOTER */}
        <CreatePageFooter
          editMode={editMode}
          quizId={editData?._id}
          form={form}
        />
      </Form>
    </div>
  );
}

export default CreatePage;
