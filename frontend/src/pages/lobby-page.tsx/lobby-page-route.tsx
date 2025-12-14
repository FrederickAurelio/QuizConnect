import { getLobby } from "@/api/sessions";
import { handleGeneralError } from "@/lib/axios";
import LoadingPage from "@/pages/loading-page";
import LobbyPage from "@/pages/lobby-page.tsx";
import { useQuery } from "@tanstack/react-query";
import { Navigate, useParams } from "react-router";

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

  return <LobbyPage lobby={lobby} />;
}

export default LobbyPageRoute;
