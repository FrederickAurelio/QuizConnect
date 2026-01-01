import type { LobbyState } from "@/api/sessions";
import { Leaderboard } from "@/pages/game-page/components/Leaderboard";
import { useGameCountdown } from "@/pages/game-page/useGameCountdown";

function CooldownPage({ lobby }: { lobby: LobbyState }) {
  const duration = useGameCountdown(
    lobby.gameState.startTime,
    lobby.gameState.duration,
  );

  return (
    <div className="flex h-full flex-col items-center gap-2 py-6">
      <div className="bg-secondary text-secondary-foreground/50 flex items-baseline gap-0.5 rounded-full px-4 text-xs font-semibold">
        <span>ROUND</span>
        <span className="text-primary pl-0.5 text-lg">
          {lobby.gameState.questionIndex + 2}
        </span>
        <span>/</span>
        <span>{lobby.settings.questionCount}</span>
      </div>

      <div className="flex flex-col items-center gap-1">
        <h1 className="text-3xl font-bold">Leaderboard</h1>
        <h2 className="text-sm font-semibold text-white/30">
          Top players this game
        </h2>
      </div>

      <div className="mt-6 flex min-h-0 w-full flex-1 justify-center">
        <Leaderboard
          lobby={lobby}
        />
      </div>

      <div className="my-5 flex flex-col items-center gap-1">
        <span className="text-secondary-foreground/50 text-sm font-semibold">
          NEXT QUESTION IN
        </span>
        <span className="text-5xl font-bold">{duration}</span>
      </div>
    </div>
  );
}

export default CooldownPage;
