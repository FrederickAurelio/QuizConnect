import type {
  GameSettings as GameSettingsType,
  LobbyState,
} from "@/api/sessions";
import { useLogin } from "@/contexts/login-context";
import { socket } from "@/lib/socket";
import { useRef, useState } from "react";
import GameSettings from "./components/GameSettings";
import JoinedCard from "./components/JoinedCard";
import LobbyPageHeader from "./components/LobbyPageHeader";

function LobbyPage({ lobby }: { lobby: LobbyState }) {
  const { user } = useLogin();
  const emitTimeout = useRef<any>(null);

  const {
    gameCode,
    host,
    quiz: quizMetadata,
    settings: serverSettings,
    players,
  } = lobby;
  const isHost = host._id === user?.userId;
  const totalAvailableQuestions = quizMetadata.questionCount;

  const [settingsDraft, setSettingsDraft] = useState(serverSettings);
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
      <div className="col-span-2 flex h-full flex-col gap-3 overflow-hidden p-6">
        <LobbyPageHeader gameCode={gameCode} quizMetadata={quizMetadata} />
        <JoinedCard host={host} players={players} />
      </div>

      {/* RIGHT */}
      <GameSettings
        playerCount={lobby.players.length}
        isHost={isHost}
        totalAvailableQuestions={totalAvailableQuestions}
        settings={isHost ? settingsDraft : serverSettings}
        updateSetting={updateSetting}
      />
    </div>
  );
}

export default LobbyPage;
