import { postHistoryQuestionExplain } from "@/api/history";
import type { AnswerLog, LobbyState } from "@/api/sessions";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLogin } from "@/contexts/login-context";
import { handleGeneralError } from "@/lib/axios";
import { socket } from "@/lib/socket";
import { useGameCountdown } from "@/pages/game-page/useGameCountdown";
import { useMutation } from "@tanstack/react-query";
import { AvatarFallback } from "@radix-ui/react-avatar";
import clsx from "clsx";
import {
  AlarmClock,
  Check,
  CheckCircle2,
  Loader2,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";

const MAX_EXPLAIN_POLL_ATTEMPTS = 3;
const DEFAULT_EXPLAIN_RETRY_MS = 1000;

async function fetchExplainWithRetry(
  gameId: string,
  questionIndex: number,
  viewAs?: "host" | "player",
) {
  for (let attempt = 0; attempt < MAX_EXPLAIN_POLL_ATTEMPTS; attempt += 1) {
    const response = await postHistoryQuestionExplain(gameId, {
      questionIndex,
      viewAs,
    });
    if (response.data?.status !== "processing") {
      return response;
    }

    const retryAfterMs = response.data.retryAfterMs ?? DEFAULT_EXPLAIN_RETRY_MS;
    await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
  }

  throw new Error(
    "Explanation is still generating. Please try again in a moment.",
  );
}

function TimeHeader({
  startTime,
  lobbyDuration,
}: {
  startTime: string;
  lobbyDuration: number;
}) {
  const duration = useGameCountdown(startTime, lobbyDuration, 40);

  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between text-sm font-bold tracking-widest uppercase opacity-60">
        <span>Time Remaining</span>
        <span
          className={clsx(
            Math.ceil(duration / 25) <= 5 && "text-destructive animate-pulse",
          )}
        >
          {Math.ceil(duration / 25)}s
        </span>
      </div>
      <Progress
        className="h-3"
        value={(duration / (lobbyDuration / 40)) * 100}
      />
    </div>
  );
}

function AiExplainControl({
  gameId,
  questionIndex,
  viewAs,
}: {
  gameId: string;
  questionIndex: number;
  viewAs?: "host" | "player";
}) {
  const [open, setOpen] = useState(false);
  const mutation = useMutation({
    mutationFn: () => fetchExplainWithRetry(gameId, questionIndex, viewAs),
    onError: handleGeneralError,
  });

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) return;
    if (mutation.isPending) return;
    if (mutation.data?.data) return;
    mutation.mutate();
  };

  const envelope = mutation.data?.data?.explanation;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-primary/30 gap-1.5 text-xs font-semibold"
        >
          <Sparkles className="size-3.5" />
          AI explain
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        className="border-border scroll-primary max-h-[min(70vh,32rem)] w-[min(100vw-2rem,28rem)] overflow-y-auto"
      >
        {mutation.isPending && (
          <div className="flex items-center gap-2 text-sm text-white/80">
            <Loader2 className="size-4 shrink-0 animate-spin" />
            Generating explanation…
          </div>
        )}
        {mutation.isError && (
          <div className="space-y-3 text-sm">
            <p className="text-white/70">Could not load the explanation.</p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              Try again
            </Button>
          </div>
        )}
        {envelope && !mutation.isPending && (
          <div className="space-y-4 text-left text-sm text-white/90">
            {mutation.data?.data?.cached && (
              <p className="text-xs text-white/40">Saved explanation</p>
            )}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-md bg-white/10 px-2 py-0.5">
                Verified answer: {envelope.payload.verifiedCorrectKey}
              </span>
              <span
                className={clsx(
                  "rounded-md px-2 py-0.5",
                  envelope.payload.agreesWithQuizKey
                    ? "bg-emerald-500/20 text-emerald-200"
                    : "bg-amber-500/20 text-amber-100",
                )}
              >
                {envelope.payload.agreesWithQuizKey
                  ? "Matches quiz key"
                  : "Quiz key may be wrong"}
              </span>
            </div>
            <div>
              <h3 className="mb-1 text-xs font-bold tracking-wide text-white/50 uppercase">
                Rationale
              </h3>
              <p className="wrap-break-word whitespace-pre-wrap text-white/85">
                {envelope.payload.rationale}
              </p>
            </div>
            <div>
              <h3 className="mb-1 text-xs font-bold tracking-wide text-white/50 uppercase">
                Feedback
              </h3>
              <p className="wrap-break-word whitespace-pre-wrap text-white/85">
                {envelope.payload.feedback}
              </p>
            </div>
            <div>
              <h3 className="mb-1 text-xs font-bold tracking-wide text-white/50 uppercase">
                Sources
              </h3>
              <ul className="list-inside list-disc space-y-1 text-white/75">
                {envelope.payload.sources.map((s, i) => (
                  <li key={i}>
                    <span className="font-medium wrap-break-word text-white/90">
                      {s.title}
                    </span>
                    <span className="wrap-break-word text-white/50">
                      {" "}
                      — {s.urlOrNote}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-[10px] text-white/35">Model: {envelope.model}</p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

type QuestionContentProp = {
  questionIndex: number;
  curQuestion: LobbyState["quiz"]["curQuestion"];
  isAnswered: "A" | "B" | "C" | "D" | null | undefined;
  isResult: boolean;
  isHost: boolean;
  groupedAnswers: GroupedAnswers;
  onAnswerSubmit?: (optionIndex: number, key: "A" | "B" | "C" | "D") => void;
  /** History review: signed-in users only; requires `historyGameId`. */
  aiExplainEnabled?: boolean;
  historyGameId?: string;
  viewAs?: "host" | "player";
};

export function QuestionContent({
  questionIndex,
  curQuestion,
  isAnswered,
  isResult,
  isHost,
  groupedAnswers,
  onAnswerSubmit,
  aiExplainEnabled = false,
  historyGameId,
  viewAs,
}: QuestionContentProp) {
  const resultAnswer = isResult ? curQuestion?.correctKey : null;
  const isCorrect = resultAnswer === isAnswered;

  return (
    <>
      <div className="flex w-full flex-col items-center gap-4 text-center">
        <div className="flex w-full flex-wrap items-center justify-center gap-3">
          <span className="bg-primary/10 text-primary rounded-full px-4 py-1 text-xs font-black uppercase">
            Question {questionIndex + 1}
          </span>
          {isResult && aiExplainEnabled && historyGameId && (
            <AiExplainControl
              key={viewAs}
              gameId={historyGameId}
              questionIndex={questionIndex}
              viewAs={viewAs}
            />
          )}
        </div>
        <h1 className="balance text-3xl font-extrabold md:text-4xl">
          {curQuestion?.question ?? ""}
        </h1>
      </div>
      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
        {curQuestion?.options.map((option, index) => {
          const selected = isAnswered === option.key;

          const buttonClass = clsx(
            "flex flex-col justify-center min-h-[100px] rounded-2xl border-2 p-6 transition-all active:scale-[0.98]",
            isAnswered || isResult
              ? selected && !isResult
                ? "border-primary bg-primary/10"
                : selected && !isCorrect
                  ? "border-destructive/50 bg-destructive/10"
                  : (selected && isCorrect) || option.key === resultAnswer
                    ? "border-emerald-500/50 bg-emerald-500/10"
                    : "border-border bg-card opacity-50 grayscale-[0.5]"
              : "bg-primary/10 hover:border-primary/50 hover:bg-secondary/50",
          );

          return (
            <button
              key={index}
              onClick={() => onAnswerSubmit?.(index, option.key)}
              disabled={!!isAnswered || !!isResult}
              className={buttonClass}
            >
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-secondary flex size-10 shrink-0 items-center justify-center rounded-lg font-black">
                    {String.fromCharCode(65 + index)}
                  </div>
                  <span className="text-left text-lg font-bold">
                    {option.text}
                  </span>
                </div>

                {selected && !isResult && (
                  <div className="bg-primary animate-in zoom-in flex size-6 shrink-0 items-center justify-center rounded-full">
                    <Check strokeWidth={3} className="size-4 text-black" />
                  </div>
                )}

                {isResult && selected && !isCorrect && (
                  <div className="bg-destructive/50 animate-in zoom-in flex size-6 shrink-0 items-center justify-center rounded-full">
                    <XCircle strokeWidth={3} className="size-4 text-black" />
                  </div>
                )}

                {isResult && selected && isCorrect && (
                  <div className="animate-in zoom-in flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/50">
                    <CheckCircle2
                      strokeWidth={3}
                      className="size-4 text-black"
                    />
                  </div>
                )}
              </div>
              {isHost && (
                <div className="flex-1">
                  <div className="bg-border my-3 h-px w-full"></div>
                  <div className="flex flex-wrap items-center gap-2">
                    {groupedAnswers[option.key].map((p) => (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Avatar className="size-10 cursor-pointer p-2">
                              <AvatarImage src={p?.avatar ?? ""} />
                              <AvatarFallback>
                                {(p?.username ?? "")
                                  .split(" ")
                                  .map((word) => word[0]?.toUpperCase())
                                  .slice(0, 2)
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                          </TooltipTrigger>

                          <TooltipContent
                            removeArrow
                            className="bg-secondary-foreground"
                            sideOffset={5}
                            side="top"
                          >
                            <p className="text-xs font-semibold">
                              {p?.username}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

type QuestionPageProps = {
  gameState: LobbyState["gameState"];
  host: LobbyState["host"];
  curQuestion: LobbyState["quiz"]["curQuestion"];
  players: LobbyState["players"];
  myAnswer: AnswerLog[] | null | undefined;
  setMyAnswer: Dispatch<SetStateAction<AnswerLog[] | null | undefined>>;
  playersAnswer: AnswerLog[];
  hostCanPlay?: boolean;
};

type AddonAnswerLog = AnswerLog & { username: string; avatar: string };
export type GroupedAnswers = {
  A: AddonAnswerLog[];
  B: AddonAnswerLog[];
  C: AddonAnswerLog[];
  D: AddonAnswerLog[];
};

function QuestionPage({
  gameState,
  host,
  curQuestion,
  players,
  myAnswer,
  setMyAnswer,
  playersAnswer,
  hostCanPlay,
}: QuestionPageProps) {
  const { user } = useLogin();
  const isHost = user?.userId === host._id;
  const canAnswer = !isHost || !!hostCanPlay;
  const canSeeDashboard = isHost && !hostCanPlay;

  const questionIndex = gameState.questionIndex;
  const answerForThisQuestion = (myAnswer ?? []).at(questionIndex);

  const isResult = gameState.status === "result";
  const resultAnswer = isResult ? curQuestion?.correctKey : null;

  const isAnswered = answerForThisQuestion?.key;
  const isCorrect = resultAnswer === isAnswered;

  const isAllPlayerAnswered = !playersAnswer.some((p) => p.key === null);

  const playerMap = useMemo(() => {
    return Object.fromEntries(players.map((p) => [p._id, p]));
  }, [players]);

  const groupedAnswers = useMemo<GroupedAnswers>(() => {
    const result: GroupedAnswers = { A: [], B: [], C: [], D: [] };

    const sorted = [...(playersAnswer ?? [])].sort((a, b) => {
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
  }, [playersAnswer, playerMap]);

  function onAnswerSubmit(optionIndex: number, key: "A" | "B" | "C" | "D") {
    if (!canAnswer) return;

    socket.emit(
      "submit-answer",
      { optionIndex, key },
      (res: { ok: boolean; nessage: string }) => {
        const { ok } = res;
        if (ok) {
          setMyAnswer((prev) =>
            prev?.map((answer, i) =>
              i === questionIndex ? { ...answer, key, optionIndex } : answer,
            ),
          );
        }
      },
    );
  }
  const resultTheme = !isAnswered
    ? {
        container:
          "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        iconBg: "bg-amber-500",
        icon: <AlarmClock className="size-6" />,
        title: canSeeDashboard
          ? isAllPlayerAnswered
            ? "All players answered!"
            : "Time's Up!"
          : "Time's Up!",
        desc: canSeeDashboard
          ? `${resultAnswer ? groupedAnswers[resultAnswer].length : 0} players answer correctly!`
          : "You didn't select an answer in time.",
      }
    : isCorrect
      ? {
          container:
            "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
          iconBg: "bg-emerald-500",
          icon: <CheckCircle2 className="size-6" />,
          title: "Correct Answer",
          desc: "Great job! Keep the momentum going.",
        }
      : {
          container: "border-destructive/50 bg-destructive/10 text-destructive",
          iconBg: "bg-destructive",
          icon: <XCircle className="size-6" />,
          title: "Incorrect",
          desc: "Don't worry, try the next one!",
        };

  /* ---------------- Render ---------------- */

  return (
    <div className="scroll-primary flex h-full w-full flex-col items-center gap-8 overflow-y-auto px-6 py-10">
      {isResult ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 sticky bottom-6 z-30 w-full px-6">
          <div
            className={clsx(
              "mx-auto flex max-w-2xl items-center gap-4 rounded-2xl border-2 p-4 shadow-xl backdrop-blur-md",
              resultTheme.container,
            )}
          >
            <div
              className={clsx(
                "flex size-12 shrink-0 items-center justify-center rounded-xl text-white",
                resultTheme.iconBg,
              )}
            >
              {resultTheme.icon}
            </div>

            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tight uppercase">
                {resultTheme.title}
              </span>
              <span className="text-sm font-medium opacity-80">
                {resultTheme.desc}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <TimeHeader
          startTime={gameState.startTime}
          lobbyDuration={gameState.duration}
        />
      )}

      <QuestionContent
        questionIndex={questionIndex}
        curQuestion={curQuestion}
        isAnswered={isAnswered}
        isResult={isResult}
        isHost={canSeeDashboard}
        groupedAnswers={groupedAnswers}
        onAnswerSubmit={onAnswerSubmit}
      />
    </div>
  );
}

export default QuestionPage;
