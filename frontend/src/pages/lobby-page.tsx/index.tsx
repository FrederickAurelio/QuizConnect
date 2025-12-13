import GameSettings from "@/pages/lobby-page.tsx/components/GameSettings";
import JoinedCard from "@/pages/lobby-page.tsx/components/JoinedCard";
import LobbyPageHeader from "@/pages/lobby-page.tsx/components/LobbyPageHeader";
import { useState } from "react";

function LobbyPage() {
  const totalAvailableQuestions = 12;
  const isHost = false;

  const [settings, setSettings] = useState({
    maxPlayers: 8,
    questionCount: totalAvailableQuestions,
    shuffleQuestions: true,
    shuffleAnswers: false,
    questionTime: "30",
    cooldownTime: "5",
  });
  const updateSetting = (key: keyof typeof settings, value: any) => {
    if (isHost) setSettings((prev) => ({ ...prev, [key]: value }));
  };
  return (
    <div className="grid h-full w-full grid-cols-3">
      {/* LEFT */}
      <div className="col-span-2 flex min-h-0 w-full flex-1 flex-col gap-3 p-6">
        <LobbyPageHeader />
        <JoinedCard />
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
