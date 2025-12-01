import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type { Question, Quiz } from "@/pages/create-page";
import { Check, Edit3, Trash2 } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

type Props = {
  q: Question;
  qIndex: number;
  remove: (id: any) => void;
  form: UseFormReturn<Quiz>;
};

function QuestionForm({ q, qIndex, remove, form }: Props) {
  const notFilled =
    (q.question ?? "").trim() === "" ||
    !["A", "B", "C", "D"].includes(q.correctKey) ||
    q.options.length !== 4 ||
    q.options.some((opt) => (opt.text ?? "").trim() === "");

  return (
    <div
      key={q.id}
      className={`hover:border-primary border-border bg-card flex flex-col gap-3 rounded-lg border p-4 transition-colors duration-150`}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-primary flex items-center gap-2">
          <Edit3 size={16} />
          Editing Questions {qIndex + 1}
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          className="hover:text-destructive/80 rounded-md p-[6px] text-white/60 transition-colors duration-150"
          onClick={() => {
            remove(q.id);
          }}
          type="button"
        >
          <Trash2 size={18} />
        </Button>
      </div>
      {/* QUESTION {i} */}
      <FormField
        control={form.control}
        name={`questions.${qIndex}.question`}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs text-white/60">QUESTION</FormLabel>
            <FormControl>
              <div className="flex items-center gap-1">
                <Textarea
                  className="bg-background! resize-none text-lg!"
                  {...field}
                />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={`questions.${qIndex}.correctKey`}
        render={({ field: fieldCorrectKey }) => (
          <FormItem>
            <FormControl>
              <RadioGroup
                onValueChange={fieldCorrectKey.onChange}
                value={fieldCorrectKey.value ?? ""}
                className="grid grid-cols-2 gap-2"
              >
                {["A", "B", "C", "D"].map((key, oIndex) => (
                  <FormField
                    key={key}
                    control={form.control}
                    name={`questions.${qIndex}.options.${oIndex}.text`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div
                            className={`bg-background flex h-fit flex-row items-center space-y-0 space-x-3 rounded-md border px-3 ${
                              fieldCorrectKey.value === key
                                ? "border-primary/80"
                                : ""
                            }`}
                          >
                            <RadioGroupItem
                              value={key}
                              id={`${qIndex}-${key}`}
                            />
                            <Input
                              placeholder={`Option ${key}`}
                              className={`border-0 p-0 focus-visible:ring-0 ${
                                fieldCorrectKey.value === key
                                  ? "text-primary"
                                  : ""
                              }`}
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </RadioGroup>
            </FormControl>
            <FormMessage />
            {!notFilled &&
              form.formState.errors.questions &&
              form.formState.errors.questions[qIndex]?.done && (
                <p className="text-destructive text-sm">
                  {form.formState.errors.questions[qIndex].done?.message}
                </p>
              )}
          </FormItem>
        )}
      />
      <div className="flex items-center justify-end pr-px font-semibold">
        <Button
          type="button"
          disabled={notFilled}
          size="sm"
          onClick={() => {
            form.setValue(`questions.${qIndex}.done`, true);
          }}
        >
          <Check className="size-4" />
          Done
        </Button>
      </div>
    </div>
  );
}

export default QuestionForm;
