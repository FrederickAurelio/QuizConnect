import type { GenerationItem } from "@/api/ai-quiz-generation";
import { Button } from "@/components/ui/button";
import { CircleAlert, CircleCheck, Loader2 } from "lucide-react";
import dayjs from "dayjs";

type Props = {
  item: GenerationItem;
  onOpenQuiz: (quizId: string) => void;
};

export default function GenerationHistoryItem({ item, onOpenQuiz }: Props) {
  return (
    <div className="bg-card border-border rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs">
          {item.status === "PROCESSING" && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-400/15 px-2 py-1 text-amber-200">
              <Loader2 className="size-3 animate-spin" />
              Processing
            </span>
          )}
          {item.status === "DONE" && (
            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-1 text-emerald-200">
              <CircleCheck className="size-3" />
              Done
            </span>
          )}
          {item.status === "FAILED" && (
            <span className="inline-flex items-center gap-1 rounded bg-destructive/20 px-2 py-1 text-red-200">
              <CircleAlert className="size-3" />
              Failed
            </span>
          )}
          <span className="rounded bg-white/8 px-2 py-1 text-white/70">
            {item.model}
          </span>
        </div>
        <p className="text-xs text-white/50">
          {dayjs(item.createdAt).format("MMM D, YYYY h:mm A")}
        </p>
      </div>

      <div className="mt-3 space-y-1 text-sm">
        <p className="line-clamp-2 text-white/80">{item.promptText}</p>
        <p className="text-xs text-white/45">
          {item.preparedFileIds.length} file{item.preparedFileIds.length === 1 ? "" : "s"}{" "}
          • {item.settings.questionCount} Qs • {item.settings.difficulty} •{" "}
          {item.settings.language}
        </p>
      </div>

      {item.status === "DONE" && item.quizId && (
        <div className="mt-3 border-t border-white/10 pt-3">
          <p className="font-semibold">{item.quizTitle}</p>
          <p className="text-sm text-white/60">{item.quizDescription}</p>
          <div className="mt-2">
            <Button
              type="button"
              size="sm"
              onClick={() => onOpenQuiz(item.quizId!)}
              className="h-8"
            >
              Open in Edit
            </Button>
          </div>
        </div>
      )}

      {item.status === "FAILED" && (
        <div className="mt-3 border-t border-white/10 pt-3">
          <p className="text-sm text-red-200/90">
            {item.errorMessage ?? "Generation failed unexpectedly."}
          </p>
          <p className="mt-2 text-xs text-white/50">
            Prepare a new file and start again if you want another attempt.
          </p>
        </div>
      )}
    </div>
  );
}
