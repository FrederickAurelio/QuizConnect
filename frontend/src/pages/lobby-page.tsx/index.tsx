import GameSettings from "@/pages/lobby-page.tsx/components/GameSettings";
import JoinedCard from "@/pages/lobby-page.tsx/components/JoinedCard";
import LobbyPageHeader from "@/pages/lobby-page.tsx/components/LobbyPageHeader";

function LobbyPage() {
  return (
    <div className="grid h-full w-full grid-cols-3">
      {/* LEFT */}
      <div className="col-span-2 flex min-h-0 w-full flex-1 flex-col gap-3 p-6">
        <LobbyPageHeader />
        <JoinedCard />
      </div>

      {/* RIGHT - Game Settings */}
      <GameSettings />
    </div>
  );
}

export default LobbyPage;
