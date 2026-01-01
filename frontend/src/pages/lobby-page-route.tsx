import {
  getLobby,
  getYourAnswer,
  type AnswerLog,
  type LobbyState,
} from "@/api/sessions";
import { useLogin } from "@/contexts/login-context";
import { handleGeneralError } from "@/lib/axios";
import { socket } from "@/lib/socket";
import GamePage from "@/pages/game-page";
import LoadingPage from "@/pages/loading-page";
import LobbyPage from "@/pages/lobby-page.tsx";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

function LobbyPageRouting({ lobby }: { lobby: LobbyState }) {
  const { user } = useLogin();
  const navigate = useNavigate();
  const { gameCode } = lobby;

  const [lobbyState, setLobbyState] = useState<LobbyState>(lobby);
  const [playersAnswer, setPlayerAnswer] = useState<AnswerLog[]>([]);

  const answerFetchenabled =
    !!gameCode &&
    !!lobbyState &&
    lobbyState?.status !== "lobby" &&
    lobbyState.host._id !== user?.userId;

  const { data: myAnswerRes } = useQuery({
    queryKey: ["YourAnswer", gameCode, user?.userId],
    queryFn: () => getYourAnswer(gameCode!),
    enabled: answerFetchenabled,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });
  // THIS LATER NEED TO GIVE FOR THE USER IN THEIR QUESTION JAWAB PAGE (PLAYER)
  const myAnswer = myAnswerRes?.data;

  // THIS LATER NEED TO GIVE TO THE HOST in THEIR DASHBOARD (HOST)
  // const [playersAnswer, setPlayerAnswer]

  useEffect(() => {
    socket.connect();

    const onConnect = () => {
      socket.emit("join-game", { gameCode });
    };

    const handleLobbyUpdated = (updatedLobby: LobbyState) => {
      setLobbyState(updatedLobby);
    };

    const handleKicked = (msg: string) => {
      toast.error(msg);
      navigate("/", { replace: true });
    };

    const handlePlayersAnswer = (playersAnswer: AnswerLog[]) => {
      setPlayerAnswer(playersAnswer);
    };

    const handleError = ({ message }: { message: string }) => {
      toast.error(message);
    };

    socket.on("connect", onConnect);
    socket.on("lobby-updated", handleLobbyUpdated);
    socket.on("kicked", handleKicked);
    socket.on("question-dashboard", handlePlayersAnswer); // host only
    socket.on("error", handleError);

    // 3. Cleanup
    return () => {
      socket.emit("leave-game");
      socket.off("connect", onConnect);
      socket.off("lobby-updated", handleLobbyUpdated);
      socket.off("kicked", handleKicked);
      socket.off("question-dashboard", handlePlayersAnswer);
      socket.off("error", handleError);

      socket.disconnect();
    };
  }, [gameCode, navigate]);

  // LATER HERE NEED TO CHECK THE STATUS FOR ROUTING.....

  console.log(lobbyState)
  if (lobbyState.status === "lobby") return <LobbyPage lobby={lobbyState} />;
  if (lobbyState.status === "started")
    return (
      <GamePage
        playersAnswer={playersAnswer}
        myAnswer={myAnswer}
        lobby={lobbyState}
      />
    );
}

function LobbyPageRoute() {
  const { gameCode } = useParams();

  const lobbyQuery = useQuery({
    queryKey: ["LobbyState", gameCode],
    queryFn: () => getLobby(gameCode!),
    enabled: !!gameCode,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

  const lobby = lobbyQuery.data?.data;

  if (!gameCode) return <Navigate to="/" replace />;

  if (
    lobbyQuery.isPending ||
    lobbyQuery.isLoading ||
    !lobbyQuery.isFetched ||
    lobbyQuery.isFetching
  ) {
    return <LoadingPage />;
  }

  if (!lobby || lobbyQuery.isError) {
    handleGeneralError(lobbyQuery.error as any);
    return <Navigate to="/" replace />;
  }

  return <LobbyPageRouting lobby={lobby} />;
}
export default LobbyPageRoute;
