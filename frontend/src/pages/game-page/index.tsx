import type { AnswerLog, LobbyState } from "@/api/sessions";
import { useLogin } from "@/contexts/login-context";

function GamePage({
  lobby,
  playersAnswer,
  myAnswer,
}: {
  lobby: LobbyState;
  playersAnswer: AnswerLog[] | [];
  myAnswer: AnswerLog[] | null | undefined;
}) {
  const { user } = useLogin();
  const isHost = lobby.host._id === user?.userId;

  // TWO PAGE... 
  // - Leaderboards (cooldown)
  // - Question & Options (question, result)

  return <div></div>;
}

export default GamePage;
