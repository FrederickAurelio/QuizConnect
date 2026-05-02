import { Types } from "mongoose";
import {
  HistoryQuestion,
  optionKeyFromIndex,
  toCorrectKeyByQuestion,
  type OptionKey,
} from "../shared.js";

type HistoryDetailLite = {
  _id: Types.ObjectId;
  quiz?: {
    title?: string | null;
    questions?: HistoryQuestion[];
  };
  settings?: {
    questionCount?: number;
    timePerQuestion?: string;
    shuffleQuestions?: boolean;
    shuffleAnswers?: boolean;
  };
};

export type PlayerDocLite = {
  player: {
    userId?: Types.ObjectId | null;
    guestId?: string | null;
    username?: string | null;
  };
  totalScore?: number;
  rank?: number;
  answers: {
    questionIndex: number;
    optionIndex?: number | null;
    score?: number | null;
  }[];
};

type BaseSessionFacts = {
  schemaVersion: 1;
  scope: "session";
  mode: "host" | "player";
  gameId: string;
  quizTitle: string;
  questionCount: number;
  playerCount: number;
  settings: {
    timePerQuestion: string;
    shuffleQuestions: boolean;
    shuffleAnswers: boolean;
  };
  leaderboard: {
    scores: number[];
    medianScore: number;
    topScore: number;
    lowScore: number;
  };
  perQuestion: Array<{
    questionIndex: number;
    questionSnippet: string;
    correctKey: OptionKey | null;
    answeredCount: number;
    noAnswerCount: number;
    choiceHistogram: Record<OptionKey, number>;
    correctCount: number;
    accuracy: number;
    avgScore: number;
  }>;
};

export type HostSessionAnalyticsFacts = BaseSessionFacts & {
  mode: "host";
  perQuestion: Array<{
    questionIndex: number;
    questionSnippet: string;
    correctKey: OptionKey | null;
    answeredCount: number;
    noAnswerCount: number;
    choiceHistogram: Record<OptionKey, number>;
    correctCount: number;
    accuracy: number;
    avgScore: number;
  }>;
};

export type PlayerSessionAnalyticsFacts = Omit<
  BaseSessionFacts,
  "mode" | "playerCount" | "leaderboard" | "perQuestion"
> & {
  mode: "player";
  learner: {
    totalScore: number;
    rank: number | null;
    accuracy: number;
    correctCount: number;
    answeredCount: number;
    perQuestion: Array<{
      questionIndex: number;
      questionSnippet: string;
      correctKey: OptionKey | null;
      chosenKey: OptionKey | null;
      score: number;
      isCorrect: boolean | null;
    }>;
  };
};

function truncateText(input: string | null | undefined, max = 140) {
  const text = (input ?? "").trim().replace(/\s+/g, " ");
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function roundTo(n: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
}

function buildScoreSummary(scores: number[]) {
  const sorted = [...scores].sort((a, b) => a - b);
  if (!sorted.length) {
    return { medianScore: 0, topScore: 0, lowScore: 0 };
  }
  const mid = Math.floor(sorted.length / 2);
  const medianScore =
    sorted.length % 2 === 0
      ? (sorted[mid - 1]! + sorted[mid]!) / 2
      : sorted[mid]!;
  return {
    medianScore,
    topScore: sorted[sorted.length - 1]!,
    lowScore: sorted[0]!,
  };
}

export function buildHostSessionFacts(params: {
  detail: HistoryDetailLite;
  playerDocs: PlayerDocLite[];
}): HostSessionAnalyticsFacts {
  const { detail, playerDocs } = params;
  const questions = detail.quiz?.questions ?? [];
  const playerCount = playerDocs.length;

  const perQuestion = questions.map((question, questionIndex) => {
    const correctKey = toCorrectKeyByQuestion(question);
    const choiceHistogram: Record<OptionKey, number> = {
      A: 0,
      B: 0,
      C: 0,
      D: 0,
    };
    let answeredCount = 0;
    let correctCount = 0;
    let scoreTotal = 0;

    for (const doc of playerDocs) {
      const ans = doc.answers.find((a) => a.questionIndex === questionIndex);
      const chosenKey = optionKeyFromIndex(ans?.optionIndex);
      if (chosenKey) {
        answeredCount += 1;
        choiceHistogram[chosenKey] += 1;
        if (correctKey && chosenKey === correctKey) correctCount += 1;
      }
      scoreTotal += ans?.score ?? 0;
    }

    const noAnswerCount = Math.max(playerCount - answeredCount, 0);
    const accuracy = answeredCount > 0 ? correctCount / answeredCount : 0;
    const avgScore = playerCount > 0 ? scoreTotal / playerCount : 0;

    return {
      questionIndex,
      questionSnippet: truncateText(question.question),
      correctKey,
      answeredCount,
      noAnswerCount,
      choiceHistogram,
      correctCount,
      accuracy: roundTo(accuracy),
      avgScore: roundTo(avgScore),
    };
  });

  const scores = playerDocs.map((doc) => doc.totalScore ?? 0);
  const scoreSummary = buildScoreSummary(scores);

  const facts: HostSessionAnalyticsFacts = {
    schemaVersion: 1,
    scope: "session",
    mode: "host",
    gameId: String(detail._id),
    quizTitle: detail.quiz?.title?.trim() || "Untitled quiz",
    questionCount: detail.settings?.questionCount ?? questions.length,
    playerCount,
    settings: {
      timePerQuestion: detail.settings?.timePerQuestion ?? "",
      shuffleQuestions: !!detail.settings?.shuffleQuestions,
      shuffleAnswers: !!detail.settings?.shuffleAnswers,
    },
    leaderboard: {
      scores,
      medianScore: roundTo(scoreSummary.medianScore),
      topScore: scoreSummary.topScore,
      lowScore: scoreSummary.lowScore,
    },
    perQuestion,
  };

  return facts;
}

export function buildPlayerSessionFacts(params: {
  detail: HistoryDetailLite;
  playerDoc: PlayerDocLite;
  userId: string;
}): PlayerSessionAnalyticsFacts {
  const { detail, playerDoc, userId } = params;
  const questions = detail.quiz?.questions ?? [];
  const playerMatches =
    String(playerDoc.player.userId ?? "") === userId ||
    String(playerDoc.player.guestId ?? "") === userId;

  // Safety guard: if mismatch, still build from provided doc but mark with empty learner stats.
  const effectivePlayerDoc = playerDoc;

  let learnerAnswered = 0;
  let learnerCorrect = 0;
  const learnerPerQuestion = questions.map((question, questionIndex) => {
    const ans = effectivePlayerDoc.answers.find(
      (a) => a.questionIndex === questionIndex,
    );
    const chosenKey = optionKeyFromIndex(ans?.optionIndex);
    const correctKey = toCorrectKeyByQuestion(question);
    const isCorrect = chosenKey && correctKey ? chosenKey === correctKey : null;
    if (chosenKey) learnerAnswered += 1;
    if (isCorrect) learnerCorrect += 1;
    return {
      questionIndex,
      questionSnippet: truncateText(question.question),
      correctKey,
      chosenKey,
      score: ans?.score ?? 0,
      isCorrect,
    };
  });

  return {
    schemaVersion: 1,
    scope: "session",
    mode: "player",
    gameId: String(detail._id),
    quizTitle: detail.quiz?.title?.trim() || "Untitled quiz",
    questionCount: detail.settings?.questionCount ?? questions.length,
    settings: {
      timePerQuestion: detail.settings?.timePerQuestion ?? "",
      shuffleQuestions: !!detail.settings?.shuffleQuestions,
      shuffleAnswers: !!detail.settings?.shuffleAnswers,
    },
    learner: {
      totalScore: playerMatches ? (effectivePlayerDoc.totalScore ?? 0) : 0,
      rank: playerMatches ? (effectivePlayerDoc.rank ?? null) : null,
      // Accuracy should reflect whole-session completion, not only attempted items.
      accuracy:
        questions.length > 0 ? roundTo(learnerCorrect / questions.length) : 0,
      correctCount: learnerCorrect,
      answeredCount: learnerAnswered,
      perQuestion: learnerPerQuestion,
    },
  };
}
