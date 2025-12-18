import type {
  GameSettings as GameSettingsType,
  LobbyState,
} from "@/api/sessions";
import { useLogin } from "@/contexts/login-context";
import { socket } from "@/lib/socket";
import GameSettings from "./components/GameSettings";
import JoinedCard from "./components/JoinedCard";
import LobbyPageHeader from "./components/LobbyPageHeader";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router";

function LobbyPage({ lobby }: { lobby: LobbyState }) {
  const { user } = useLogin();
  const navigate = useNavigate();
  const emitTimeout = useRef<any>(null);

  const [lobbyState, setLobbyState] = useState<LobbyState>(lobby);

  const {
    gameCode,
    host,
    quiz: quizMetadata,
    settings: serverSettings,
    players,
  } = lobbyState;

  const isHost = host._id === user?.userId;
  const totalAvailableQuestions = quizMetadata.questionCount;

  const [settingsDraft, setSettingsDraft] = useState(serverSettings);

  useEffect(() => {
    socket.emit("join-game", { gameCode });

    const handleLobbyUpdated = (updatedLobby: LobbyState) => {
      setLobbyState(updatedLobby);

      if (isHost) {
        setSettingsDraft(updatedLobby.settings);
      }
    };

    const handleKicked = (msg: string) => {
      toast.error(msg);
      navigate("/");
    };

    socket.on("lobby-updated", handleLobbyUpdated);
    socket.on("kicked", handleKicked);

    return () => {
      socket.emit("leave-game");
      socket.off("lobby-updated", handleLobbyUpdated);
    };
  }, []);

  const updateSetting = (key: keyof typeof settingsDraft, value: any) => {
    if (!isHost) return;

    let newSettings: GameSettingsType;

    setSettingsDraft((prev) => {
      newSettings = { ...prev, [key]: value };
      return newSettings;
    });

    if (emitTimeout.current) {
      clearTimeout(emitTimeout.current);
    }

    emitTimeout.current = setTimeout(() => {
      socket.emit("update-settings", {
        gameCode,
        settings: newSettings,
      });
    }, 300); // 300ms debounce
  };

  return (
    <div className="grid h-full w-full grid-cols-3">
      {/* LEFT */}
      <div className="col-span-2 flex flex-col gap-3 p-6">
        <LobbyPageHeader gameCode={gameCode} quizMetadata={quizMetadata} />
        <JoinedCard host={host} players={players} />
      </div>

      {/* RIGHT */}
      <GameSettings
        isHost={isHost}
        totalAvailableQuestions={totalAvailableQuestions}
        settings={isHost ? settingsDraft : serverSettings}
        updateSetting={updateSetting}
      />
    </div>
  );
}

export default LobbyPage;
