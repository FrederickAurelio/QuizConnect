import { ArrowLeft, Copy } from "lucide-react";

function LobbyPageHeader() {
  return (
    <div className="bg-card border-border flex w-full shrink-0 items-center gap-4 rounded-xl border px-4 py-3 text-lg font-semibold">
      <button className="hover:text-primary mx-2">
        <ArrowLeft size={20} />
      </button>
      <div className="flex h-16 flex-1 flex-col justify-center">
        <h1 className="text-xl text-white/80">Quiz Mathematics For All</h1>
        <p className="line-clamp-2 text-xs text-white/40">
          Everyone will love this quiz, it's fun and quick.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-end">
          <span className="text-primary text-xs leading-tight">CODE</span>
          <h2 className="text-secondary-foreground text-2xl leading-tight font-bold">
            882912
          </h2>
        </div>
        <div className="bg-secondary text-secondary-foreground hover:text-primary flex items-center justify-center rounded-lg p-1.5">
          <Copy size={14} />
        </div>
      </div>
    </div>
  );
}

export default LobbyPageHeader;
