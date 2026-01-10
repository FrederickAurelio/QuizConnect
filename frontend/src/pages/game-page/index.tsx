import type { AnswerLog, LobbyState } from "@/api/sessions";
import CooldownPage from "@/pages/game-page/components/CooldownPage";
import QuestionPage from "@/pages/game-page/components/QuestionPage";
import { useEffect, useState } from "react";

type GamePageProps = {
  lobby: LobbyState;
  playersAnswer: AnswerLog[] | [];
  myAnswer: AnswerLog[] | null | undefined;
};

function GamePage({ lobby, playersAnswer, myAnswer }: GamePageProps) {
  const [localMyAnswer, setLocalMyAnswer] = useState(myAnswer);

  useEffect(() => {
    setLocalMyAnswer(myAnswer);
  }, [myAnswer]);

  const status = lobby.gameState.status;

  const questionPage = (
    <QuestionPage
      gameState={lobby?.gameState}
      host={lobby.host}
      curQuestion={lobby.quiz.curQuestion}
      players={lobby.players}
      myAnswer={localMyAnswer}
      setMyAnswer={setLocalMyAnswer}
      playersAnswer={playersAnswer}
    />
  );

  const PageMap = {
    cooldown: <CooldownPage lobby={lobby} />,
    question: questionPage,
    result: questionPage,
  };

  return PageMap[status as keyof typeof PageMap] || <div />;
}

export default GamePage;
