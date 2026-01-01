import type { AnswerLog, LobbyState } from "@/api/sessions";
import CooldownPage from "@/pages/game-page/components/CooldownPage";

type GamePageProps = {
  lobby: LobbyState;
  playersAnswer: AnswerLog[] | [];
  myAnswer: AnswerLog[] | null | undefined;
};

function GamePage({ lobby, playersAnswer, myAnswer }: GamePageProps) {
  const status = lobby.gameState.status;

  const PageMap = {
    cooldown: <CooldownPage lobby={lobby} />,
    // question: <QuestionPage lobby={lobby} myAnswer={myAnswer} />,
    // result: <ResultPage lobby={lobby} playersAnswer={playersAnswer} />,
    // ended: <FinalLeaderboardPage lobby={lobby} />,
  };

  // Fallback to a loader or empty div if the status doesn't match
  return PageMap[status as keyof typeof PageMap] || <div />;
}

export default GamePage;
