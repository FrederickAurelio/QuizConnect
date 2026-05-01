import type { GenerationItem } from "@/api/ai-quiz-generation";
import GenerationHistoryItem from "./GenerationHistoryItem";

type Props = {
  items: GenerationItem[];
  onOpenQuiz: (quizId: string) => void;
};

export default function GenerationHistoryList({ items, onOpenQuiz }: Props) {
  return (
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
          />
        ))
      )}
    </div>
  );
}
