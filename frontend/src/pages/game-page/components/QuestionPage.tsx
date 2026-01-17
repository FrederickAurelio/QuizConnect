import type { AnswerLog, LobbyState } from "@/api/sessions";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLogin } from "@/contexts/login-context";
import { socket } from "@/lib/socket";
import { useGameCountdown } from "@/pages/game-page/useGameCountdown";
import { AvatarFallback } from "@radix-ui/react-avatar";
import clsx from "clsx";
import { AlarmClock, Check, CheckCircle2, XCircle } from "lucide-react";
import { useMemo, type Dispatch, type SetStateAction } from "react";

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

type QuestionContentProp = {
  questionIndex: number;
  curQuestion: LobbyState["quiz"]["curQuestion"];
  isAnswered: "A" | "B" | "C" | "D" | null | undefined;
  isResult: boolean;
  isHost: boolean;
  groupedAnswers: GroupedAnswers;
  onAnswerSubmit?: (optionIndex: number, key: "A" | "B" | "C" | "D") => void;
};

export function QuestionContent({
  questionIndex,
  curQuestion,
  isAnswered,
  isResult,
  isHost,
  groupedAnswers,
  onAnswerSubmit,
}: QuestionContentProp) {
  const resultAnswer = isResult ? curQuestion?.correctKey : null;
  const isCorrect = resultAnswer === isAnswered;

  return (
    <>
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="bg-primary/10 text-primary rounded-full px-4 py-1 text-xs font-black uppercase">
          Question {questionIndex + 1}
        </span>
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
                  <div className="bg-secondary flex size-10 items-center justify-center rounded-lg font-black">
                    {String.fromCharCode(65 + index)}
                  </div>
                  <span className="text-lg font-bold">{option.text}</span>
                </div>

                {selected && !isResult && (
                  <div className="bg-primary animate-in zoom-in flex size-6 items-center justify-center rounded-full">
                    <Check strokeWidth={3} className="size-4 text-black" />
                  </div>
                )}

                {isResult && selected && !isCorrect && (
                  <div className="bg-destructive/50 animate-in zoom-in flex size-6 items-center justify-center rounded-full">
                    <XCircle strokeWidth={3} className="size-4 text-black" />
                  </div>
                )}

                {isResult && selected && isCorrect && (
                  <div className="animate-in zoom-in flex size-6 items-center justify-center rounded-full bg-emerald-500/50">
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
}: QuestionPageProps) {
  const { user } = useLogin();
  const isHost = user?.userId === host._id;

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
    if (isHost) return;

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
        title: isAllPlayerAnswered ? "All players answered!" : "Time's Up!",
        desc: isHost
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
        isHost={isHost}
        groupedAnswers={groupedAnswers}
        onAnswerSubmit={onAnswerSubmit}
      />
    </div>
  );
}

export default QuestionPage;
