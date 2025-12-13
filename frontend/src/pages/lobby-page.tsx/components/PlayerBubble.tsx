import { CircleX, Info } from "lucide-react";

type Props = {
  isHost: boolean;
  isUser: boolean;
  name: string;
  avatarUrl: string;
};

function PlayerBubble({ isHost, isUser, name, avatarUrl }: Props) {
  const handleClickAction = () => {
    if (isHost) {
      console.log(`Host wants to remove ${name}`);
    } else if (isUser) {
      console.log(`User wants to see their info`);
    }
  };

  return (
    <div className="bg-secondary/30 hover:bg-secondary/50 flex h-fit max-w-[240px] items-center gap-2 rounded-xl p-2 pr-3 transition-colors duration-150 ease-in-out">
      <div className="bg-primary/15 shrink-0 rounded-full p-1.5">
        <img className="size-5" src={avatarUrl} alt="user-avatar" />
      </div>
      <p
        className={`truncate text-base font-medium ${isUser ? "text-primary" : "text-white"}`}
      >
        {name}
      </p>
      {(isUser || isHost) && (
        <button
          onClick={handleClickAction}
          className="ml-auto flex shrink-0 items-center"
        >
          {isUser && (
            <Info
              className="hover:text-primary text-white/60 transition-colors"
              size={16}
            />
          )}

          {/* Kick icon (for the host to kick others) */}
          {isHost && !isUser && (
            <CircleX
              className="text-white/60 transition-colors hover:text-red-400"
              size={16}
            />
          )}
        </button>
      )}
    </div>
  );
}

export default PlayerBubble;
