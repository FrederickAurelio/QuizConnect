import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import clsx from "clsx";
import { Minus, Plus, SlidersHorizontal } from "lucide-react";

type GameSettingsProps = {
  isHost: boolean;
  totalAvailableQuestions: number;
  settings: {
    maxPlayers: number;
    questionCount: number;
    shuffleQuestions: boolean;
    shuffleAnswers: boolean;
    timePerQuestion: string;
    cooldown: string;
  };
  updateSetting: (
    key:
      | "maxPlayers"
      | "questionCount"
      | "shuffleQuestions"
      | "shuffleAnswers"
      | "timePerQuestion"
      | "cooldown",
    value: any,
  ) => void;
};

function GameSettings({
  isHost,
  totalAvailableQuestions,
  settings,
  updateSetting,
}: GameSettingsProps) {
  return (
    <div
      className={clsx(
        "bg-sidebar border-border col-span-1 m-10 ml-0 flex min-h-0 w-full flex-1 flex-col gap-6 rounded-2xl border px-5 py-5",
        !isHost && "pointer-events-none opacity-75",
      )}
    >
      <div className="text-secondary-foreground/50 flex items-center gap-2">
        <SlidersHorizontal size={20} />
        <h1 className="text-lg font-medium">Game Settings</h1>
      </div>

      <div className="scroll-primary flex flex-col gap-6 overflow-y-auto px-2">
        {/* GROUP 1: Capacity & Content */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <p className="shrink-0 text-white/60">Max Players</p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="size-8"
                onClick={() =>
                  updateSetting(
                    "maxPlayers",
                    Math.max(1, settings.maxPlayers - 1),
                  )
                }
              >
                <Minus size={14} />
              </Button>
              <Input
                value={settings.maxPlayers}
                onChange={(e) =>
                  updateSetting("maxPlayers", parseInt(e.target.value) || 1)
                }
                className="text-secondary-foreground w-16 text-center font-semibold"
              />
              <Button
                variant="outline"
                className="size-8"
                onClick={() =>
                  updateSetting(
                    "maxPlayers",
                    Math.min(50, settings.maxPlayers + 1),
                  )
                }
              >
                <Plus size={14} />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="shrink-0 text-white/60">Questions</p>
            <Select
              value={String(settings.questionCount)}
              onValueChange={(val) =>
                updateSetting("questionCount", parseInt(val))
              }
            >
              <SelectTrigger className="text-secondary-foreground w-[120px] font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value={String(totalAvailableQuestions)}>
                  All ({totalAvailableQuestions})
                </SelectItem>
                {Array.from(
                  { length: Math.floor(totalAvailableQuestions / 5) },
                  (_, i) =>
                    totalAvailableQuestions -
                    (totalAvailableQuestions % 5) -
                    i * 5,
                )
                  .filter((n) => n > 0)
                  .map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        <hr className="border-white/10" />

        {/* GROUP 2: Game Logic */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col leading-tight">
              <p className="text-white/60">Shuffle Questions</p>
              <p className="text-xs text-white/30">Randomize order</p>
            </div>
            <Switch
              size="xl"
              checked={settings.shuffleQuestions}
              onCheckedChange={(val) => updateSetting("shuffleQuestions", val)}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col leading-tight">
              <p className="text-white/60">Shuffle Answers</p>
              <p className="text-xs text-white/30">Mix options A-D</p>
            </div>
            <Switch
              size="xl"
              checked={settings.shuffleAnswers}
              onCheckedChange={(val) => updateSetting("shuffleAnswers", val)}
            />
          </div>
        </section>

        <hr className="border-white/10" />

        {/* GROUP 3: Timing */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col leading-tight">
              <p className="text-white/60">Question Time</p>
              <p className="text-xs text-white/30">Limit per question</p>
            </div>
            <Select
              value={settings.timePerQuestion}
              onValueChange={(val) => updateSetting("timePerQuestion", val)}
            >
              <SelectTrigger className="text-secondary-foreground w-[130px] font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="10">10 seconds</SelectItem>
                <SelectItem value="20">20 seconds</SelectItem>
                <SelectItem value="30">30 seconds</SelectItem>
                <SelectItem value="60">60 seconds</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col leading-tight">
              <p className="text-white/60">Cooldown Time</p>
              <p className="text-xs text-white/30">Pause between rounds</p>
            </div>
            <Select
              value={settings.cooldown}
              onValueChange={(val) => updateSetting("cooldown", val)}
            >
              <SelectTrigger className="text-secondary-foreground w-[130px] font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="5">5 seconds</SelectItem>
                <SelectItem value="10">10 seconds</SelectItem>
                <SelectItem value="15">15 seconds</SelectItem>
                <SelectItem value="20">20 seconds</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>
      </div>

      <div className="mt-auto pt-4">
        <Button disabled={!isHost} className="w-full font-bold" size="lg">
          START GAME
        </Button>
      </div>
    </div>
  );
}

export default GameSettings;
