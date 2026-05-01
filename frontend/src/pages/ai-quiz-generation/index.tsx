import {
  createGeneration,
  getGenerationDetail,
  listGenerations,
} from "@/api/ai-quiz-generation.mock";
import {
  deletePreparedMaterial,
  prepareMaterial,
  type GenerationItem,
  type PreparedMaterial,
} from "@/api/ai-quiz-generation";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_AI_SETTINGS,
  loadAiGenerationDraft,
  saveAiGenerationDraft,
} from "@/pages/ai-quiz-generation/storage";
import { MAX_PREPARED_MATERIALS } from "@/pages/ai-quiz-generation/constants";
import GenerationForm from "@/pages/ai-quiz-generation/components/GenerationForm";
import GenerationHistoryList from "@/pages/ai-quiz-generation/components/GenerationHistoryList";
import PreparedMaterialsList from "@/pages/ai-quiz-generation/components/PreparedMaterialsList";
import UploadPanel from "@/pages/ai-quiz-generation/components/UploadPanel";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "text/plain"]);

function initialMaterials(
  saved: ReturnType<typeof loadAiGenerationDraft>,
): PreparedMaterial[] {
  return (
    saved?.preparedMaterials
      ?.filter((m) => m.status === "READY")
      .slice(0, MAX_PREPARED_MATERIALS) ?? []
  );
}

export default function AiQuizGenerationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [initialDraft] = useState(() => loadAiGenerationDraft());

  const [promptText, setPromptText] = useState(() => initialDraft?.promptText ?? "");
  const [settings, setSettings] = useState(
    () => initialDraft?.settings ?? DEFAULT_AI_SETTINGS,
  );
  const [preparedMaterials, setPreparedMaterials] = useState<PreparedMaterial[]>(() =>
    initialMaterials(initialDraft),
  );

  const generationsQuery = useQuery({
    queryKey: ["ai-quiz-generations"],
    queryFn: listGenerations,
    refetchOnWindowFocus: false,
  });

  const generations = generationsQuery.data ?? [];
  const activeGeneration = useMemo(
    () => generations.find((g) => g.status === "PROCESSING"),
    [generations],
  );

  const generationDetailQuery = useQuery({
    queryKey: ["ai-quiz-generation-detail", activeGeneration?.generationId],
    queryFn: async () => getGenerationDetail(activeGeneration!.generationId),
    enabled: !!activeGeneration?.generationId,
    refetchInterval: (query) => {
      const value = query.state.data;
      if (!value || value.status === "PROCESSING") return 5000;
      return false;
    },
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const detail = generationDetailQuery.data;
    if (!detail) return;
    queryClient.setQueryData(["ai-quiz-generations"], (old: GenerationItem[]) => {
      if (!old) return old;
      return old.map((item) =>
        item.generationId === detail.generationId ? detail : item,
      );
    });
    if (detail.status === "DONE") {
      toast.success("Quiz generation completed.");
    }
    if (detail.status === "FAILED") {
      toast.error(detail.errorMessage ?? "Generation failed.");
    }
  }, [generationDetailQuery.data, queryClient]);

  useEffect(() => {
    saveAiGenerationDraft({ promptText, settings, preparedMaterials });
  }, [promptText, settings, preparedMaterials]);

  const prepareMutation = useMutation({
    mutationFn: (file: File) => prepareMaterial(file),
    onSuccess: (material) => {
      if (material.status === "FAILED") {
        toast.error(
          material.errorMessage ?? "Could not read this file. Try another PDF or TXT.",
        );
        return;
      }
      setPreparedMaterials((prev) => {
        if (prev.length >= MAX_PREPARED_MATERIALS) return prev;
        return [...prev, material];
      });
      toast.success(`Prepared: ${material.fileName}`);
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Could not prepare file. Please try again.",
      );
    },
  });

  const removePreparedMaterial = (preparedFileId: string) => {
    setPreparedMaterials((prev) => prev.filter((p) => p.preparedFileId !== preparedFileId));
    void deletePreparedMaterial(preparedFileId).catch(() => {
      /* UX: optimistic remove; TTL cleans up server-side */
    });
  };

  const createGenerationMutation = useMutation({
    mutationFn: createGeneration,
    onSuccess: (created, variables) => {
      queryClient.setQueryData(["ai-quiz-generations"], (old: GenerationItem[]) => {
        return [created, ...(old ?? [])];
      });
      for (const id of variables.preparedFileIds) {
        void deletePreparedMaterial(id).catch(() => {
          /* Best-effort cleanup */
        });
      }
      setPromptText("");
      setSettings({ ...DEFAULT_AI_SETTINGS });
      setPreparedMaterials([]);
      saveAiGenerationDraft({
        promptText: "",
        settings: { ...DEFAULT_AI_SETTINGS },
        preparedMaterials: [],
      });
      toast.success("Generation started.");
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : "Could not start generation.",
      ),
  });

  const hasPreparedFiles = preparedMaterials.length > 0;

  const uploadSectionDisabled = !!activeGeneration;
  const isPreparingFile = prepareMutation.isPending;

  const generationDisabledReason = !hasPreparedFiles
    ? "Add and prepare at least one file (up to 3)."
    : activeGeneration
      ? "You already have one generation running."
      : "";

  const generationDisabled =
    !hasPreparedFiles || !!activeGeneration || createGenerationMutation.isPending;

  const onPickFile = (file: File) => {
    if (preparedMaterials.length >= MAX_PREPARED_MATERIALS) {
      toast.error(`You can add at most ${MAX_PREPARED_MATERIALS} files.`);
      return;
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      toast.error("Only PDF and TXT files are allowed.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error("File too large. Maximum is 10MB per file.");
      return;
    }
    prepareMutation.mutate(file);
  };

  const onGenerate = () => {
    if (generationDisabled || !hasPreparedFiles) return;
    const ids = preparedMaterials.map((m) => m.preparedFileId);
    const trimmedPrompt = promptText.trim();
    createGenerationMutation.mutate({
      preparedFileIds: ids,
      promptText: trimmedPrompt || "Generate a balanced quiz from the material.",
      settings,
    });
  };

  const isAnyPending =
    generationsQuery.isPending || generationsQuery.isFetching || isPreparingFile;

  return (
    <div className="scroll-primary flex h-full w-full flex-col gap-5 overflow-y-auto px-4 py-4">
      <div className="bg-card border-border rounded-xl border px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-primary/15 text-primary rounded-lg p-1.5">
              <Bot className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">AI Quiz Generation</h1>
              <p className="text-sm text-white/55">
                Upload up to 3 materials, set rules, then generate quiz drafts. Material
                upload uses the server; generation is still mocked.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeGeneration ? (
              <span className="inline-flex items-center gap-1 rounded bg-amber-400/15 px-2 py-1 text-xs text-amber-200">
                <Loader2 className="size-3 animate-spin" />
                One generation in progress
              </span>
            ) : (
              <span className="rounded bg-emerald-500/15 px-2 py-1 text-xs text-emerald-200">
                Ready
              </span>
            )}
            <Button size="sm" variant="outline" onClick={() => navigate("/quiz-set")}>
              Back to Library
            </Button>
          </div>
        </div>
      </div>

      {/* Step 1 + 2: two columns on large screens */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6 lg:items-start">
        <div className="min-w-0 space-y-4">
          <UploadPanel
            disabled={uploadSectionDisabled}
            isPreparing={isPreparingFile}
            currentFileCount={preparedMaterials.length}
            onPickFile={onPickFile}
          />
          <PreparedMaterialsList
            materials={preparedMaterials}
            onDelete={removePreparedMaterial}
          />
        </div>

        <div className="min-w-0">
          <GenerationForm
            promptText={promptText}
            settings={settings}
            isGenerating={createGenerationMutation.isPending}
            disabled={generationDisabled}
            disableReason={generationDisabledReason}
            onPromptChange={setPromptText}
            onSettingsChange={setSettings}
            onGenerate={onGenerate}
          />
        </div>
      </div>

      {/* Generation history: full width under the two steps */}
      <section className="border-border space-y-2 border-t pt-4 mt-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg pl-1 font-bold tracking-tight">Generation history</h2>
          {isAnyPending && (
            <span className="text-xs text-white/45">Refreshing…</span>
          )}
        </div>
        <GenerationHistoryList
          items={generations}
          onOpenQuiz={(quizId) => navigate(`/edit/${quizId}`)}
        />
      </section>
    </div>
  );
}
