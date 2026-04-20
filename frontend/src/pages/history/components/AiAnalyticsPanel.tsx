import type { AiAnalyticsPayload } from "@/api/history";
import { Button } from "@/components/ui/button";
import dayjs from "dayjs";

type InsightItem = AiAnalyticsPayload["strengths"][number];

function InsightSection({
  title,
  items,
  onEvidenceClick,
}: {
  title: string;
  items: InsightItem[];
  onEvidenceClick: (questionIndex: number) => void;
}) {
  return (
    <div className="space-y-2 border-t border-white/10 pt-4">
      <h3 className="text-xs font-bold tracking-wide text-white/50 uppercase">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-white/50">No insights available.</p>
      ) : (
        <div className="space-y-3">
          {items.slice(0, 4).map((item, idx) => {
            const evidence = item.evidence?.questionIndices ?? [];
            const related = item.relatedQuestionIndices ?? [];
            const questionIndices = Array.from(new Set([...evidence, ...related]));
            return (
              <div key={`${item.title}-${idx}`} className="space-y-2">
                <p className="text-sm font-semibold text-white/95">{item.title}</p>
                <p className="text-sm whitespace-pre-wrap text-white/80">{item.detail}</p>
                {questionIndices.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {questionIndices.map((questionIndex) => (
                      <Button
                        key={`${title}-${idx}-${questionIndex}`}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => onEvidenceClick(questionIndex)}
                      >
                        Q{questionIndex + 1}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-white/50">General pattern</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AiAnalyticsPanel({
  payload,
  onEvidenceClick,
  model,
  createdAt,
}: {
  payload: AiAnalyticsPayload;
  onEvidenceClick: (questionIndex: number) => void;
  model?: string;
  createdAt?: string;
}) {
  return (
    <div className="space-y-0 text-left text-sm text-white/90">
      {(model || createdAt) && (
        <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-white/10 pb-3 text-xs text-white/50">
          {model && (
            <span className="truncate">
              Model: <span className="text-white/70">{model}</span>
            </span>
          )}
          {createdAt && (
            <span className="text-white/40">
              {dayjs(createdAt).format("MMM D, YYYY h:mm A")}
            </span>
          )}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <h3 className="mb-1 text-xs font-bold tracking-wide text-white/50 uppercase">
            Summary
          </h3>
          <p className="whitespace-pre-wrap text-white/85">{payload.summary}</p>
        </div>
        <InsightSection
          title="Strengths"
          items={payload.strengths}
          onEvidenceClick={onEvidenceClick}
        />
        <InsightSection
          title="Weaknesses"
          items={payload.weaknesses}
          onEvidenceClick={onEvidenceClick}
        />
        <InsightSection
          title="Recommendations"
          items={payload.recommendations}
          onEvidenceClick={onEvidenceClick}
        />
      </div>
    </div>
  );
}
