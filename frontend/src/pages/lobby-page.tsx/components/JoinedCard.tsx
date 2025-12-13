import PlayerBubble from "@/pages/lobby-page.tsx/components/PlayerBubble";
import { Users } from "lucide-react";

function JoinedCard() {
  return (
    <div className="bg-card border-border flex min-h-0 w-full flex-1 flex-col gap-4 rounded-xl border px-5 py-4 text-lg font-semibold">
      <div className="flex w-full items-center justify-between">
        <h1 className="flex gap-2 text-base text-white/60">
          <Users className="translate-y-px" size={20} />
          Players Joined
        </h1>
      </div>

      <div className="scroll-primary flex w-full flex-1 flex-wrap gap-2 overflow-y-auto">
        <PlayerBubble
          isUser
          avatarUrl="/apple.png"
          name="Alice"
          isHost={false}
        />
        <PlayerBubble
          isUser={false}
          avatarUrl="/cheese.png"
          name="Charlie"
          isHost={false}
        />
      </div>
    </div>
  );
}

export default JoinedCard;
