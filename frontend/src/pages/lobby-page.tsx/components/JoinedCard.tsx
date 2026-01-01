import type { UserInfo } from "@/api/sessions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useEditProfile } from "@/contexts/edit-profile-context";
import { useLogin } from "@/contexts/login-context";
import PlayerBubble from "@/pages/lobby-page.tsx/components/PlayerBubble";
import { AvatarImage } from "@radix-ui/react-avatar";
import clsx from "clsx";
import { Dot, Info, Users } from "lucide-react";

function JoinedCard({
  host,
  players,
}: {
  host: UserInfo & { online: boolean };
  players: UserInfo[];
}) {
  const { openProfileEdit } = useEditProfile();
  const { user } = useLogin();
  const isHost = host._id === user?.userId;

  return (
    <div className="bg-card border-border flex min-h-0 w-full flex-1 flex-col gap-4 rounded-xl border px-5 py-4 text-lg font-semibold">
      <div className="flex w-full items-center justify-between">
        <h1 className="flex gap-2 text-base text-white/60">
          <Users className="translate-y-px" size={20} />
          {players.length} Players Joined
        </h1>
        <div className="bg-secondary/30 hover:bg-secondary/50 flex h-fit max-w-[240px] items-center gap-1 rounded-xl p-2 pr-3 transition-colors duration-150 ease-in-out">
          <Avatar className="size-8 p-2">
            <AvatarImage src={host?.avatar ?? ""} />
            <AvatarFallback>
              {host?.username
                .split(" ")
                .map((word) => word[0]?.toUpperCase())
                .slice(0, 2)
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div className="flex shrink-0 items-center">
            <Dot
              className={clsx(
                host.online ? "text-green-400" : "text-red-600",
                "scale-200", // Back to a highly visible size
              )}
            />
            <p
              className={`flex items-center truncate text-base font-medium ${isHost ? "text-primary" : "text-white"}`}
            >
              {host.username}
            </p>
          </div>
          {isHost && (
            <button
              onClick={openProfileEdit}
              className="ml-1 flex shrink-0 items-center"
            >
              <Info
                className="hover:text-primary text-white/60 transition-colors"
                size={16}
              />
            </button>
          )}
        </div>
      </div>

      <div className="scroll-primary flex w-full flex-wrap gap-2 overflow-y-auto">
        {players.map((player) => (
          <PlayerBubble
            key={player._id}
            playerId={player._id}
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
