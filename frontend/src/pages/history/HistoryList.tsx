import { getHistories } from "@/api/history";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLogin } from "@/contexts/login-context";
import { useInfiniteQuery } from "@tanstack/react-query";
import clsx from "clsx";
import dayjs from "dayjs";
import {
  Calendar,
  CircleQuestionMark,
  Dot,
  HistoryIcon,
  Loader2,
  Users2,
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useInView } from "react-intersection-observer";
import { useNavigate } from "react-router";

const TABS: { key: "play" | "host"; label: string }[] = [
  { key: "host", label: "Host" },
  { key: "play", label: "Game" },
];

const getInitials = (name?: string) =>
  name
    ?.split(" ")
    .map((word) => word[0]?.toUpperCase())
    .slice(0, 2)
    .join("") || "??";

const Badge = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={clsx(
      "bg-background border-border flex items-center gap-1 rounded-full border px-2 py-1 text-xs",
      className,
    )}
  >
    {children}
  </div>
);

const rankStyles = [
  {
    bg: "bg-yellow-500/100",
    border: "border-yellow-500/50",
    text: "text-yellow-600 dark:text-yellow-400",
  },
  {
    bg: "bg-slate-400/10",
    border: "border-slate-400/50",
    text: "text-slate-500 dark:text-slate-300",
  },
  {
    bg: "bg-amber-700/10",
    border: "border-amber-700/50",
    text: "text-amber-700 dark:text-amber-500",
  },
];

function HistoryList() {
  const navigate = useNavigate();
  const { user } = useLogin();
  const [option, setOption] = useState<"play" | "host">("host");
  const { ref, inView } = useInView();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching } =
    useInfiniteQuery({
      queryKey: ["quizzes", option],
      queryFn: async ({ pageParam = 1 }) =>
        getHistories({ page: pageParam, pageSize: 10, type: option }),
      getNextPageParam: (lastPage) =>
        lastPage.data?.hasNext ? lastPage.data.page + 1 : undefined,
      initialPageParam: 1,
    });

  const histories = useMemo(
    () => data?.pages.flatMap((page) => page?.data?.data ?? []) ?? [],
    [data],
  );

  useEffect(() => {
    if (inView && !isFetchingNextPage && !isFetching && hasNextPage)
      fetchNextPage();
  }, [inView, isFetchingNextPage, hasNextPage, fetchNextPage]);

  return (
    <div className="flex h-full w-full flex-col gap-2 px-20 pt-4">
      {/* Header */}
      <div className="flex shrink-0 items-end justify-between">
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold">History</h1>
          <p className="text-white/60">Your past games and results.</p>
        </div>

        <div className="border-border bg-card flex items-center rounded-lg border p-1">
          {TABS.map((tab) => (
            <div
              key={tab.key}
              className={clsx(
                "w-16 cursor-default py-1 text-center text-sm font-semibold transition-colors duration-100",
                option === tab.key
                  ? "bg-border text-secondary-foreground rounded-md"
                  : "text-white/40",
              )}
              onClick={() => setOption(tab.key)}
            >
              {tab.label}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="scroll-primary flex w-full flex-col gap-3 overflow-y-auto p-3">
        {histories.length < 1 && !isFetchingNextPage && !isFetching && (
          <div className="flex flex-col items-center justify-center py-20 opacity-60">
            <div className="bg-secondary/20 mb-4 rounded-full p-6">
              <HistoryIcon size={48} className="text-secondary-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-white">No history yet</h3>
            <p className="mb-6 text-sm text-white/50">
              {option === "host"
                ? "You haven't hosted any games yet."
                : "You haven't played any games yet."}
            </p>
          </div>
        )}
        {histories.map((history) => {
          const isWinner =
            (history.winner?.userId || history.winner?.guestId) ===
            user?.userId;
          const isHost = history.host._id === user?.userId;
          const showVictoryState = isWinner || isHost;

          const rank = history?.myResult?.[0]?.rank;
          const rankIndex = Math.max((rank ?? 1) - 1, 0);
          const isTop3 = rankIndex < 3;

          const rankStyle = isTop3
            ? rankStyles[rankIndex]
            : {
                border: "border-border",
                bg: "bg-background",
                text: "text-white/50",
              };

          return (
            <div
              onClick={() => {
                navigate(`/history/${history._id}`);
              }}
              key={history._id}
              className={clsx(
                "bg-card flex w-full items-center gap-3 rounded-xl border p-3 px-4",
                isWinner ? "border-yellow-500/80" : "border-border",
                "transition-all duration-200 hover:scale-[101%]",
              )}
            >
              {/* Left Info Section */}
              <div className="flex h-full flex-1 flex-col gap-2.5">
                <div className="flex items-center gap-1">
                  <Badge className="text-white/50">
                    <Calendar size={12} />
                    <p className="leading-1">
                      {dayjs(history.sessionCreatedAt).format("MMM DD")}
                    </p>
                  </Badge>

                  <Badge className="px-3 text-white/30">
                    <p className="text-[10px] leading-0">Hosted by</p>
                    <Avatar className="size-5 p-1">
                      <AvatarImage src={history.host?.avatar ?? ""} />
                      <AvatarFallback className="text-[8px]">
                        {getInitials(history.host.username)}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-white/70">{history.host.username}</p>
                  </Badge>
                </div>

                <h2 className="px-1 text-xl font-semibold text-white/90">
                  {history.quiz.title}
                </h2>

                <div className="flex items-center gap-2 px-1 text-sm text-white/50">
                  <p>#{history.gameCode}</p>
                  <Dot className="scale-200" size={12} />
                  <div className="flex items-center gap-0.5">
                    <Users2 size={14} />
                    <p className="leading-0">{history.playerCount}</p>
                  </div>
                  <Dot className="scale-200" size={12} />
                  <div className="flex items-center gap-0.5">
                    <CircleQuestionMark size={14} />
                    <p className="leading-0">{history.quiz.questionCount} Qs</p>
                  </div>
                </div>
              </div>

              {/* Vertical Divider */}
              <div
                className={clsx(
                  "h-4/5 w-0.5",
                  isWinner ? "bg-yellow-500/30" : "bg-border",
                )}
              />

              {/* Right Results Section */}
              <div className="flex w-44 flex-col overflow-hidden py-2 pl-1">
                {showVictoryState ? (
                  <div className="flex flex-col items-center">
                    <Avatar className="size-12 border-2 border-yellow-500/80 p-2">
                      <AvatarImage src={history.winner?.avatar ?? ""} />
                      <AvatarFallback>
                        {getInitials(history.winner?.username)}
                      </AvatarFallback>
                    </Avatar>
                    <p className="pt-px text-center text-base font-semibold break-all text-yellow-500/80">
                      {isHost ? history.winner?.username : "VICTORY"}
                    </p>
                    <p className="text-sm font-semibold text-white/90">
                      {history.winner?.totalScore}pts
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {/* Compact Winner View */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 px-1">
                        <Avatar className="size-6 border border-yellow-500/80 p-1">
                          <AvatarImage src={history.winner?.avatar ?? ""} />
                          <AvatarFallback className="text-[8px]">
                            {getInitials(history.winner?.username)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col text-xs leading-none">
                          <p className="text-[10px] text-yellow-500/80">
                            WINNER
                          </p>
                          <p className="break-all text-white/70">
                            {history.winner?.username}
                          </p>
                        </div>
                      </div>
                      <p className="shrink-0 pr-1.5 text-xs text-white/50">
                        {history.winner?.totalScore}pts
                      </p>
                    </div>

                    {/* User's Specific Result */}
                    <div
                      className={clsx(
                        "shrink-0 rounded-xl border p-3",
                        rankStyle.border,
                        rankStyle.bg,
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <Avatar
                            className={clsx(
                              "size-8 p-1",
                              isTop3 && clsx(rankStyle.border, "border"),
                            )}
                          >
                            <AvatarImage src={user?.avatar ?? ""} />
                            <AvatarFallback>
                              {getInitials(user?.username)}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex flex-col text-sm leading-none">
                            <p className="text-white/70">You</p>
                            <p className={clsx("text-xs", rankStyle.text)}>
                              {rank ? `Rank #${rank}` : "N/A"}
                            </p>
                          </div>
                        </div>

                        <p className="text-sm text-white/50">
                          {history.myResult?.[0]?.totalScore ?? 0}pts
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {(hasNextPage || isFetchingNextPage || isFetching) && (
          <div
            className="text-primary flex h-12 shrink-0 items-center justify-center"
            ref={ref}
          >
            {(isFetchingNextPage || isFetching) && (
              <Loader2 className="animate-spin" size={26} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default HistoryList;
