import { getLobby, type LobbyState } from "@/api/sessions";
import { handleGeneralError } from "@/lib/axios";
import { socket } from "@/lib/socket";
import LoadingPage from "@/pages/loading-page";
import LobbyPage from "@/pages/lobby-page.tsx";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

function LobbyPageRouting({ lobby }: { lobby: LobbyState }) {
  const navigate = useNavigate();
  const { gameCode } = lobby;

  const [lobbyState, setLobbyState] = useState<LobbyState>(lobby);

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
      navigate("/");
    };

    socket.on("connect", onConnect);
    socket.on("lobby-updated", handleLobbyUpdated);
    socket.on("kicked", handleKicked);

    // 3. Cleanup
    return () => {
      socket.emit("leave-game");
      socket.off("connect", onConnect);
      socket.off("lobby-updated", handleLobbyUpdated);
      socket.off("kicked", handleKicked);

      socket.disconnect();
    };
  }, []);

  // LATER HERE NEED TO CHECK THE STATUS FOR ROUTING.....

  return <LobbyPage lobby={lobbyState} />;
}

function LobbyPageRoute() {
  const { gameCode } = useParams();
  const { data, isPending, isLoading, isFetched, isFetching, isError, error } =
    useQuery({
      queryKey: ["LobbyState", gameCode],
      queryFn: () => getLobby(gameCode!),
      enabled: !!gameCode,
      staleTime: 0,
      gcTime: 0,
      refetchOnMount: "always",
      refetchOnWindowFocus: false,
    });

  if (!gameCode) return <Navigate to="/" replace />;
  if (isPending || isLoading || !isFetched || isFetching)
    return <LoadingPage />;

  const lobby = data?.data;

  if (!lobby || isError) {
    handleGeneralError(error as any);
    return <Navigate to="/" replace />;
  }

  return <LobbyPageRouting lobby={lobby} />;
}

export default LobbyPageRoute;
