import type { AiGenerationSettings } from "@/api/ai-quiz-generation";
import {
  MAX_QUESTION_COUNT,
  QUESTION_COUNT_CHOICES,
  normalizeQuestionCount,
} from "@/pages/ai-quiz-generation/constants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles } from "lucide-react";

type Props = {
  promptText: string;
  settings: AiGenerationSettings;
  isGenerating: boolean;
  disabled: boolean;
  disableReason?: string;
  onPromptChange: (value: string) => void;
  onSettingsChange: (settings: AiGenerationSettings) => void;
  onGenerate: () => void;
};

export default function GenerationForm({
  promptText,
  settings,
  isGenerating,
  disabled,
  disableReason,
  onPromptChange,
  onSettingsChange,
  onGenerate,
}: Props) {
  return (
    <div className="bg-card border-border rounded-xl border p-4">
      <div className="mb-3">
        <h2 className="text-lg font-bold">2. Define prompt & rules</h2>
        <p className="text-xs text-white/50">
          Tell AI what to focus on, and set difficulty/amount. Question count in steps
          of 5, up to {MAX_QUESTION_COUNT}.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ai-prompt-text">Prompt / rules</Label>
        <Textarea
          id="ai-prompt-text"
          value={promptText}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="Example: focus on chapter 3, medium difficulty, include practical scenarios."
          className="min-h-32 resize-y bg-transparent"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Question count</Label>
          <Select
            value={String(normalizeQuestionCount(settings.questionCount))}
            onValueChange={(val) =>
              onSettingsChange({
                ...settings,
                questionCount: Number(val),
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {QUESTION_COUNT_CHOICES.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Difficulty</Label>
          <Select
            value={settings.difficulty}
            onValueChange={(val: "easy" | "medium" | "hard") =>
              onSettingsChange({ ...settings, difficulty: val })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Language</Label>
          <Select
            value={settings.language}
            onValueChange={(val: "English" | "Chinese") =>
              onSettingsChange({ ...settings, language: val })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="English">English</SelectItem>
              <SelectItem value="Chinese">Chinese</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 flex flex-col items-end gap-2">
        <Button
          type="button"
          onClick={onGenerate}
          disabled={disabled || isGenerating}
          className="min-w-44"
        >
          {isGenerating ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              Generate Quiz
            </>
          )}
        </Button>
        {disableReason && (
          <p className="text-xs text-white/50">{disableReason}</p>
        )}
      </div>
    </div>
  );
}
