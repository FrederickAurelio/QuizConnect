import type { LobbyState } from "@/api/sessions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLogin } from "@/contexts/login-context";
import clsx from "clsx";
import { useEffect, useRef } from "react";

type LeaderboardProps = {
  players: LobbyState["players"];
};

const rankStyles = [
  {
    bg: "bg-yellow-500/10 hover:bg-yellow-500/20",
    border: "border-yellow-500/50",
    text: "text-yellow-600 dark:text-yellow-400",
  },
  {
    bg: "bg-slate-400/10 hover:bg-slate-500/20",
    border: "border-slate-400/50",
    text: "text-slate-500 dark:text-slate-300",
  },
  {
    bg: "bg-amber-700/10 hover:bg-amber-700/20",
    border: "border-amber-700/50",
    text: "text-amber-700 dark:text-amber-500",
  },
];

export const Leaderboard = ({ players }: LeaderboardProps) => {
  const { user } = useLogin();
  const currentUserId = user?.userId;

  const containerRef = useRef<HTMLDivElement>(null);
  const currentUserRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentUserRef.current) {
        currentUserRef.current.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      ref={containerRef}
      className="border-border bg-card/50 no-scrollbar flex w-full max-w-[750px] flex-col gap-2 overflow-y-auto rounded-3xl border p-4 shadow-xl backdrop-blur-md"
    >
      {players
        .slice()
        .sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0))
        .map((player, i) => {
          const isTop3 = i < 3;
          const styles = rankStyles[i];

          return (
            <div
              key={player._id}
              ref={player._id === currentUserId ? currentUserRef : null}
              className={clsx(
                "group flex w-full items-center gap-4 rounded-2xl border p-3 transition-all",
                isTop3 && styles.border,
                isTop3 && styles.bg,
                !isTop3 &&
                  "hover:bg-secondary/20 hover:border-border/50 border-transparent",
              )}
            >
              <div className="flex w-10 justify-center">
                <span
                  className={clsx(
                    "text-2xl font-black italic tabular-nums",
                    isTop3 ? styles.text : "opacity-20",
                  )}
                >
                  {i + 1}
                </span>
              </div>

              <Avatar
                className={clsx(
                  "size-12 border-2 p-2 transition-transform group-hover:scale-105",
                  isTop3 ? styles.border : "border-transparent",
                )}
              >
                <AvatarImage src={player.avatar ?? ""} />
                <AvatarFallback className="bg-muted font-bold">
                  {player.username?.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex flex-1 flex-col">
                <p
                  className={clsx(
                    "text-base font-bold tracking-tight",
                    player._id === currentUserId && "text-primary",
                  )}
                >
                  {player.username}
                  {player._id === currentUserId && (
                    <span className="text-primary/40 text-xs"> (You)</span>
                  )}
                </p>

                {i === 0 && (
                  <span className="text-[10px] font-black tracking-widest text-yellow-500 uppercase">
                    Current Leader
                  </span>
                )}
              </div>

              <div className="flex flex-col items-end">
                <span className="text-primary text-xl font-black tabular-nums">
                  {player.totalScore?.toLocaleString() ?? 0}
                </span>
                <span className="text-[10px] font-bold uppercase opacity-30">
                  Points
                </span>
              </div>
            </div>
          );
        })}
    </div>
  );
};
