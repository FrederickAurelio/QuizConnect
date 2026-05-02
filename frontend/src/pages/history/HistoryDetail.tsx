import { getHistoryDetail, type PlayerSnapshot } from "@/api/history";
import type { AnswerLog } from "@/api/sessions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLogin } from "@/contexts/login-context";
import { handleGeneralError } from "@/lib/axios";
import type { Question } from "@/pages/create-page";
import { Leaderboard } from "@/pages/game-page/components/Leaderboard";
import AiAnalyticsControl from "@/pages/history/components/AiAnalyticsControl";
import {
  QuestionContent,
  type GroupedAnswers,
} from "@/pages/game-page/components/QuestionPage";
import LoadingPage from "@/pages/loading-page";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useParams, useSearchParams } from "react-router";

function QuestionWrapper({
  quesionIndex,
  curQuestion,
  myAnswer,
  playerAnswer,
  playerMap,
  isHost,
  gameId,
  aiExplainEnabled,
  aiExplainDisabledReason,
  viewAs,
}: {
  quesionIndex: number;
  curQuestion: Question;
  myAnswer?: AnswerLog;
  playerAnswer?: AnswerLog[];
  playerMap: {
    [k: string]: PlayerSnapshot;
  };
  isHost: boolean;
  gameId: string;
  aiExplainEnabled: boolean;
  aiExplainDisabledReason?: string;
  viewAs?: "host" | "player";
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
          aiExplainEnabled={aiExplainEnabled}
          aiExplainDisabledReason={aiExplainDisabledReason}
          historyGameId={gameId}
          viewAs={viewAs}
        />
      </div>
      <hr className="my-8 w-full border-white/10" />
    </>
  );
}

function HistoryDetail() {
  const { user, isAuthenticated } = useLogin();
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

  const [searchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<"host" | "player">(
    (searchParams.get("viewAs") as "host" | "player" | undefined) ?? "host",
  );
  const [highlightedQuestionIndex, setHighlightedQuestionIndex] = useState<
    number | null
  >(null);
  const evidenceHighlightTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  useEffect(() => {
    return () => {
      if (evidenceHighlightTimerRef.current) {
        clearTimeout(evidenceHighlightTimerRef.current);
      }
    };
  }, []);

  const handleEvidenceClick = useCallback((questionIndex: number) => {
    const target = document.getElementById(`history-question-${questionIndex}`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    if (evidenceHighlightTimerRef.current) {
      clearTimeout(evidenceHighlightTimerRef.current);
    }
    setHighlightedQuestionIndex(questionIndex);
    evidenceHighlightTimerRef.current = setTimeout(() => {
      setHighlightedQuestionIndex(null);
      evidenceHighlightTimerRef.current = null;
    }, 1500);
  }, []);

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
  const partOfTheGame =
    isHost || history.players.some((p) => p.userId === user?.userId);

  const aiFeaturesEnabled = isAuthenticated && partOfTheGame;
  const aiFeatureDisabledReason =
    isAuthenticated && !partOfTheGame
      ? "Only the host and players can access AI features."
      : !isAuthenticated
        ? "Sign in to use AI explanations and analytics."
        : undefined;
  const showViewToggle = isHost && !!history.settings?.hostCanPlay;
  const analyticsView = showViewToggle ? viewMode : isHost ? "host" : "player";

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

      {showViewToggle ? (
        <div className="mx-auto mb-2 w-full max-w-[850px] px-2 py-5">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="flex w-full min-w-0 flex-col gap-1 text-center sm:w-auto sm:flex-1 sm:text-left">
              <h1 className="text-3xl font-bold">Questions</h1>
              <h2 className="text-sm font-semibold text-white/30">
                Review each question and your answers
              </h2>
            </div>
            <div className="border-border bg-card flex w-fit shrink-0 items-center justify-center rounded-lg border p-1">
              {(
                [
                  { key: "host", label: "Host" },
                  { key: "player", label: "Player" },
                ] as const
              ).map((tab) => (
                <div
                  key={tab.key}
                  className={`w-16 cursor-default py-1 text-center text-sm font-semibold transition-colors duration-100 ${
                    viewMode === tab.key
                      ? "bg-border text-secondary-foreground rounded-md"
                      : "text-white/40"
                  }`}
                  onClick={() => setViewMode(tab.key)}
                >
                  {tab.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1 py-5">
          <h1 className="text-3xl font-bold">Questions</h1>
          <h2 className="text-sm font-semibold text-white/30">
            Review each question and your answers
          </h2>
        </div>
      )}

      <div className="mx-auto w-full max-w-[850px] px-2 sm:px-3">
        <div className="bg-card border-border mb-8 rounded-xl border p-3 sm:p-4">
          <AiAnalyticsControl
            key={analyticsView}
            gameId={gameId}
            viewAs={analyticsView}
            analyticsAllowed={aiFeaturesEnabled}
            analyticsDisabledReason={aiFeatureDisabledReason}
            onEvidenceClick={handleEvidenceClick}
          >
            <div>
              <h2 className="text-lg font-bold text-white/90">
                AI session analytics
              </h2>
              <p className="mt-0.5 text-xs text-white/45 sm:max-w-md">
                Role-based session summary with evidence links to questions
                below.
              </p>
            </div>
          </AiAnalyticsControl>
        </div>
      </div>

      {history.quiz.questions.map((q, idx) => {
        const rowMyAnswer = history.myAnswer?.[idx];
        const rowPlayerAnswer = history.playersAnswer?.[idx];

        const useHostDashboard = showViewToggle ? viewMode === "host" : isHost;

        const myAnswer = useHostDashboard ? undefined : rowMyAnswer;
        const playerAnswer = useHostDashboard ? rowPlayerAnswer : undefined;

        return (
          <div
            key={idx}
            id={`history-question-${idx}`}
            className={`w-full max-w-[850px] rounded-xl transition-shadow duration-300 ${
              highlightedQuestionIndex === idx
                ? "ring-primary/45 ring-2 ring-offset-2 ring-offset-transparent"
                : ""
            }`}
          >
            <QuestionWrapper
              quesionIndex={idx}
              curQuestion={q}
              myAnswer={myAnswer}
              playerAnswer={playerAnswer}
              playerMap={playerMap}
              isHost={useHostDashboard}
              gameId={gameId}
              aiExplainEnabled={aiFeaturesEnabled}
              aiExplainDisabledReason={aiFeatureDisabledReason}
              viewAs={showViewToggle ? viewMode : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}

export default HistoryDetail;
