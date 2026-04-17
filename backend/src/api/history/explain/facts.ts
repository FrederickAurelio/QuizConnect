import { Types } from "mongoose";
import {
  optionKeyFromIndex,
  toCorrectKeyByQuestion,
  type OptionKey,
} from "../shared.js";

type ExplainQuestionInput = {
  question: string;
  options: { key: string; text: string }[];
  correctKey: string;
};

export type ExplainQuestion = {
  question: string;
  options: { key: OptionKey; text: string }[];
  correctKey: OptionKey | null;
};

export function normalizeExplainQuestion(
  input: ExplainQuestionInput,
): ExplainQuestion {
  return {
    ...input,
    options: input.options.map((opt, index) => ({
      ...opt,
      key: (optionKeyFromIndex(index) ?? null) as OptionKey,
    })),
    correctKey: toCorrectKeyByQuestion(input),
  };
}

function displayNameForParticipantId(
  detailPlayers: {
    userId?: Types.ObjectId | null;
    guestId?: string | null;
    username?: string | null;
  }[],
  participantId: Types.ObjectId | string,
) {
  const id = String(participantId);
  const row = detailPlayers.find(
    (p) => String(p.userId ?? "") === id || String(p.guestId ?? "") === id,
  );
  return row?.username ?? "Player";
}

export function buildHostParticipantChoicesForQuestion(
  detailPlayers: {
    userId?: Types.ObjectId | null;
    guestId?: string | null;
    username?: string | null;
  }[],
  playerDocs: {
    player: {
      userId?: Types.ObjectId | null;
      guestId?: string | null;
      username?: string | null;
    };
    answers: {
      questionIndex: number;
      score?: number;
      optionIndex?: number | null;
    }[];
  }[],
  questionIndex: number,
) {
  return playerDocs.map((doc) => {
    const ans = doc.answers.find((a) => a.questionIndex === questionIndex);
    const pid = doc.player?.userId ?? doc.player?.guestId;
    const displayName =
      pid != null
        ? displayNameForParticipantId(detailPlayers, pid)
        : (doc.player?.username ?? "Player");
    return {
      displayName,
      didAnswer: !!ans,
      chosenKey: optionKeyFromIndex(ans?.optionIndex),
      score: ans?.score ?? null,
    };
  });
}

export function buildOptionsAsText(options: { text: string }[]) {
  return options
    .map((opt, idx) => `Option ${optionKeyFromIndex(idx) ?? "?"}: ${opt.text}`)
    .join("\n");
}
