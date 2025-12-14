import type { LobbyState } from "@/api/sessions";
import { useLogin } from "@/contexts/login-context";
import GameSettings from "@/pages/lobby-page.tsx/components/GameSettings";
import JoinedCard from "@/pages/lobby-page.tsx/components/JoinedCard";
import LobbyPageHeader from "@/pages/lobby-page.tsx/components/LobbyPageHeader";
import { useState } from "react";

function LobbyPage({ lobby }: { lobby: LobbyState }) {
  const { user } = useLogin();
  const {
    gameCode,
    host,
    quiz: quizMetadata,
    settings: settingsProps,
    players,
    status,
  } = lobby;

  const totalAvailableQuestions = quizMetadata.questionCount;
  const isHost = host._id === user?.userId;

  const [settings, setSettings] = useState(settingsProps);

  const updateSetting = (key: keyof typeof settings, value: any) => {
    if (isHost) setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="grid h-full w-full grid-cols-3">
      {/* LEFT */}
      <div className="col-span-2 flex min-h-0 w-full flex-1 flex-col gap-3 p-6">
        <LobbyPageHeader gameCode={gameCode} quizMetadata={quizMetadata} />
        <JoinedCard host={host} players={players} />
      </div>

      {/* RIGHT - Game Settings */}
      <GameSettings
        isHost={isHost}
        totalAvailableQuestions={totalAvailableQuestions}
        settings={settings}
        updateSetting={updateSetting}
      />
    </div>
  );
}

export default LobbyPage;
