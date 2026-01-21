import { getHistoryDetail, type PlayerSnapshot } from "@/api/history";
import type { AnswerLog } from "@/api/sessions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLogin } from "@/contexts/login-context";
import { handleGeneralError } from "@/lib/axios";
import type { Question } from "@/pages/create-page";
import { Leaderboard } from "@/pages/game-page/components/Leaderboard";
import {
  QuestionContent,
  type GroupedAnswers,
} from "@/pages/game-page/components/QuestionPage";
import LoadingPage from "@/pages/loading-page";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useMemo } from "react";
import { Navigate, useParams } from "react-router";

function QuestionWrapper({
  quesionIndex,
  curQuestion,
  myAnswer,
  playerAnswer,
  playerMap,
  isHost,
}: {
  quesionIndex: number;
  curQuestion: Question;
  myAnswer: AnswerLog;
  playerAnswer: AnswerLog[];
  playerMap: {
    [k: string]: PlayerSnapshot;
  };
  isHost: boolean;
}) {
  const isAnswered = myAnswer?.key;

  const groupedAnswers = useMemo<GroupedAnswers>(() => {
    const result: GroupedAnswers = { A: [], B: [], C: [], D: [] };

    const sorted = [...(playerAnswer ?? [])].sort((a, b) => {
      const tA = a.answeredAt ? new Date(a.answeredAt).getTime() : 0;
      const tB = b.answeredAt ? new Date(b.answeredAt).getTime() : 0;
      return tA - tB;
    });

    for (const answer of sorted) {
      if (!answer.key) continue;

      const player = playerMap[answer._id];
      if (!player) continue;

      result[answer.key].push({
        ...answer,
        avatar: player.avatar,
        username: player.username,
      });
    }

    return result;
  }, [playerAnswer, playerMap]);

  return (
    <>
      <div className="my-8 flex w-full flex-col gap-8">
        <QuestionContent
          isResult
          questionIndex={quesionIndex}
          curQuestion={curQuestion}
          isAnswered={isAnswered}
          isHost={isHost}
          groupedAnswers={groupedAnswers}
        />
      </div>
      <hr className="my-8 w-full border-white/10" />
    </>
  );
}

function HistoryDetail() {
  const { user } = useLogin();
  const { gameId } = useParams();

  const historyQuery = useQuery({
    queryKey: ["History", gameId],
    queryFn: () => getHistoryDetail(gameId!),
    enabled: !!gameId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

  const history = historyQuery.data?.data;

  if (!gameId) return <Navigate to="/" replace />;

  if (
    historyQuery.isPending ||
    historyQuery.isLoading ||
    !historyQuery.isFetched ||
    historyQuery.isFetching
  ) {
    return <LoadingPage />;
  }

  if (!history || historyQuery.isError) {
    handleGeneralError(historyQuery.error as any);
    return <Navigate to="/" replace />;
  }

  const isHost = history.host._id === user?.userId;
  const playerMap = Object.fromEntries(history.players.map((p) => [p._id, p]));

  return (
    <div className="scroll-primary flex h-full flex-col items-center gap-2 overflow-x-hidden overflow-y-auto py-10">
      <div className="bg-card border-border mb-10 flex w-full max-w-[850px] shrink-0 items-center gap-6 rounded-xl border px-8 py-3 text-lg font-semibold max-sm:flex-col max-sm:items-start max-sm:gap-2">
        <div className="flex flex-col">
          <h2 className="text-primary pl-1 text-xs leading-tight">HOST</h2>
          <div className="bg-secondary/30 flex max-w-[240px] items-center gap-1 rounded-xl p-1 pr-2 transition-colors duration-150 ease-in-out">
            <Avatar className="size-8 p-2">
              <AvatarImage src={history.host?.avatar ?? ""} />
              <AvatarFallback>
                {history.host?.username
                  .split(" ")
                  .map((word) => word[0]?.toUpperCase())
                  .slice(0, 2)
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div className="flex shrink-0 items-center">
              <p
                className={`flex items-center truncate text-base font-medium ${isHost ? "text-primary" : "text-white"}`}
              >
                {history.host.username}
              </p>
            </div>
          </div>
        </div>

        <hr className="bg-border h-4/5 w-px max-sm:hidden" />

        <div className="flex h-16 flex-1 flex-col justify-center">
          <h1 className="line-clamp-1 text-xl text-white/80">
            {history.quiz.title}
          </h1>
          <p className="line-clamp-2 text-xs text-white/40">
            {history.quiz.description}
          </p>
        </div>
        <div className="flex items-center gap-6 max-sm:w-full max-sm:justify-end max-sm:pt-1.5">
          {/* Added gap between Date and Code */}
          <div className="flex flex-col items-end">
            <span className="text-[10px] leading-tight text-white/40 uppercase">
              Finished
            </span>
            <h2 className="text-sm leading-tight font-medium text-white/80">
              {dayjs(history.createdAt).format("MMM DD, YYYY")}
            </h2>
            <span className="text-[10px] text-white/30">
              {dayjs(history.createdAt).format("h:mm A")}
            </span>
          </div>
          {/* CODE SECTION */}
          <div className="border-border flex flex-col items-end border-l pl-6">
            <span className="text-primary text-xs leading-tight">CODE</span>
            <h2 className="text-secondary-foreground text-2xl leading-tight font-bold">
              {history.gameCode}
            </h2>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-1">
        <h1 className="text-3xl font-bold">Leaderboard</h1>
        <h2 className="text-sm font-semibold text-white/30">
          Top players this game
        </h2>
      </div>

      {history.players && (
        <div className="z-20 mt-6 mb-8 flex h-96 w-full shrink-0 justify-center">
          <Leaderboard players={history.players} />
        </div>
      )}

      <hr className="my-8 w-full border-white/10" />

      <div className="flex flex-col items-center gap-1 py-5">
        <h1 className="text-3xl font-bold">Questions</h1>
        <h2 className="text-sm font-semibold text-white/30">
          Review each question and your answers
        </h2>
      </div>

      {history.quiz.questions.map((q, idx) => (
        <QuestionWrapper
          quesionIndex={idx}
          curQuestion={q}
          myAnswer={history?.myAnswer?.[idx] as AnswerLog}
          playerAnswer={history?.playersAnswer?.[idx] as AnswerLog[]}
          playerMap={playerMap}
          isHost={isHost}
        />
      ))}
    </div>
  );
}

export default HistoryDetail;
