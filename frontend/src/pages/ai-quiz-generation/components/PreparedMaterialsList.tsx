import type { PreparedMaterial } from "@/api/ai-quiz-generation";
import { Button } from "@/components/ui/button";
import { MAX_PREPARED_MATERIALS } from "@/pages/ai-quiz-generation/constants";
import { CheckCircle2, Trash2 } from "lucide-react";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function PreparedMaterialRow({
  material,
  index,
  onDelete,
}: {
  material: PreparedMaterial;
  index: number;
  onDelete: () => void;
}) {
  return (
    <div className="border-border bg-background/40 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground mb-0.5 text-[10px] font-medium tracking-wide uppercase">
            File {index + 1}
          </p>
          <h3 className="line-clamp-1 text-sm font-semibold">{material.fileName}</h3>
          <p className="text-xs text-white/50">
            {formatBytes(material.fileSizeBytes)} • {material.mimeType}
          </p>
        </div>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          onClick={onDelete}
          className="shrink-0"
          aria-label="Remove file"
        >
          <Trash2 className="size-4 text-white/70" />
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-200">
          <CheckCircle2 className="size-3" />
          <span className="translate-y-px">Ready</span>
        </span>
        <span className="rounded bg-white/8 px-2 py-0.5 text-white/60">
          {material.cleanCharCount} chars
        </span>
      </div>
    </div>
  );
}

type Props = {
  materials: PreparedMaterial[];
  onDelete: (preparedFileId: string) => void;
};

export default function PreparedMaterialsList({ materials, onDelete }: Props) {
  if (materials.length === 0) {
    return (
      <div className="bg-card border-border rounded-xl border p-4 text-sm text-white/50">
        No files yet. Add up to {MAX_PREPARED_MATERIALS} materials above.
      </div>
    );
  }

  return (
    <div className="bg-card border-border space-y-3 rounded-xl border p-4">
      <h3 className="text-sm font-semibold text-white/80">Prepared materials</h3>
      {materials.map((m, i) => (
        <PreparedMaterialRow
          key={m.preparedFileId}
          material={m}
          index={i}
          onDelete={() => onDelete(m.preparedFileId)}
        />
      ))}
    </div>
  );
}
