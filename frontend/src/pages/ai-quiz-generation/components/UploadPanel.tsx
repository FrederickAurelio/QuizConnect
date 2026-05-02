import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  MAX_PREPARED_FILE_LABEL,
  MAX_PREPARED_MATERIALS,
} from "@/pages/ai-quiz-generation/constants";
import { cn } from "@/lib/utils";
import { FileUp, Loader2 } from "lucide-react";
import { useId, useRef } from "react";

type Props = {
  disabled?: boolean;
  isPreparing: boolean;
  currentFileCount: number;
  onPickFile: (file: File) => void;
};

export default function UploadPanel({
  disabled,
  isPreparing,
  currentFileCount,
  onPickFile,
}: Props) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const atLimit = currentFileCount >= MAX_PREPARED_MATERIALS;
  const addDisabled = disabled || isPreparing || atLimit;
  const remaining = Math.max(0, MAX_PREPARED_MATERIALS - currentFileCount);

  return (
    <div className="bg-card border-border rounded-xl border p-4">
      <div className="mb-3">
        <h2 className="text-lg font-bold">1. Upload material</h2>
        <p className="text-xs text-white/50">
          PDF/TXT, max {MAX_PREPARED_FILE_LABEL} each. Up to {MAX_PREPARED_MATERIALS}{" "}
          files per session.
        </p>
      </div>
      <Label className="mb-2 block">Material files</Label>

      <input
        id={inputId}
        ref={fileInputRef}
        type="file"
        className="sr-only"
        tabIndex={-1}
        disabled={addDisabled}
        accept=".pdf,.txt,application/pdf,text/plain"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          onPickFile(file);
          e.currentTarget.value = "";
        }}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <Button
          type="button"
          disabled={addDisabled}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "h-10 w-full min-w-0 justify-center gap-2 sm:w-auto sm:min-w-[10rem]",
            isPreparing && "pointer-events-none opacity-90",
          )}
        >
          {isPreparing ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 shrink-0 animate-spin" />
              <span>Preparing file…</span>
            </span>
          ) : atLimit ? (
            <span className="flex items-center gap-2">
              <FileUp className="size-4 shrink-0 opacity-60" />
              <span>Max {MAX_PREPARED_MATERIALS} files</span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <FileUp className="size-4 shrink-0" />
              <span>
                {currentFileCount === 0 ? "Upload file" : "Upload another file"}
              </span>
            </span>
          )}
        </Button>
        <p className="text-xs text-white/45">
          {atLimit
            ? "Remove a file below to add a different one."
            : isPreparing
              ? "Extracting and cleaning text…"
              : `${currentFileCount}/${MAX_PREPARED_MATERIALS} file${currentFileCount === 1 ? "" : "s"} — ${remaining} slot${remaining === 1 ? "" : "s"} left.`}
        </p>
      </div>
    </div>
  );
}
