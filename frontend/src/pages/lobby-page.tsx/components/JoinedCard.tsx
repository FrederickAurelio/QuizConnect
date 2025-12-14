import type { UserInfo } from "@/api/sessions";
import { useLogin } from "@/contexts/login-context";
import PlayerBubble from "@/pages/lobby-page.tsx/components/PlayerBubble";
import { Users } from "lucide-react";

function JoinedCard({
  host,
  players,
}: {
  host: UserInfo;
  players: UserInfo[];
}) {
  const { user } = useLogin();
  const isHost = host._id === user?.userId;

  return (
    <div className="bg-card border-border flex min-h-0 w-full flex-1 flex-col gap-4 rounded-xl border px-5 py-4 text-lg font-semibold">
      <div className="flex w-full items-center justify-between">
        <h1 className="flex gap-2 text-base text-white/60">
          <Users className="translate-y-px" size={20} />
          {players.length} Players Joined
        </h1>
        <div className="bg-secondary/30 hover:bg-secondary/50 flex h-fit max-w-[240px] items-center gap-2 rounded-xl p-2 pr-3 transition-colors duration-150 ease-in-out">
          <div className="bg-primary/15 shrink-0 rounded-full p-1.5">
            <img className="size-5" src={host.avatar ?? ""} alt="host-avatar" />
          </div>
          <p
            className={`truncate text-base font-medium ${isHost ? "text-primary" : "text-white"}`}
          >
            {host.username}
          </p>
        </div>
      </div>

      <div className="scroll-primary flex w-full flex-1 flex-wrap gap-2 overflow-y-auto">
        {players.map((player) => (
          <PlayerBubble
            isUser={player._id === user?.userId}
            avatarUrl={player.avatar}
            name={player.username}
            isHost={isHost}
          />
        ))}
      </div>
    </div>
  );
}

export default JoinedCard;
