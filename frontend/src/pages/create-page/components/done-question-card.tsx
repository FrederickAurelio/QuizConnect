import { Button } from "@/components/ui/button";
import type { Question, Quiz } from "@/pages/create-page";
import { CheckCircle, Edit3, Trash2 } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

const keyToIndex = { A: 0, B: 1, C: 2, D: 3 };

type Props = {
  q: Question;
  qIndex: number;
  remove: (id: any) => void;
  form: UseFormReturn<Quiz>;
};

function DoneQuestionCard({ q, qIndex, remove, form }: Props) {
  return (
    <div
      className={`flex flex-col gap-3 p-4 transition-all duration-150 border rounded-lg hover:border-primary border-border bg-secondary/80`}
    >
      <div className="flex items-center justify-between">
        <h2 className="flex items-center font-semibold text-white/60 gap-2">
          Question {qIndex + 1}
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-white/60 hover:text-primary/80 transition-colors duration-150 p-[6px] rounded-md"
            onClick={() => {
              form.setValue(`questions.${qIndex}.done`, false);
            }}
            type="button"
          >
            <Edit3 size={18} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-white/60 hover:text-destructive/80 transition-colors duration-150 p-[6px] rounded-md"
            onClick={() => {
              remove(q.id);
            }}
            type="button"
          >
            <Trash2 size={18} />
          </Button>
        </div>
      </div>
      <div className="text-lg line-clamp-4">{q.question}</div>
      <div className="text-chart-4 font-semibold flex items-center">
        <div className="flex items-center gap-1">
          <CheckCircle strokeWidth={3} className="size-4" />
          <p className="text-sm">Answer:</p>
        </div>

        <p className="text-white/80 pl-2">
          <span className="text-primary">{q.correctKey}. </span>
          {q.options[keyToIndex[q.correctKey]].text}
        </p>
      </div>
    </div>
  );
}

export default DoneQuestionCard;
