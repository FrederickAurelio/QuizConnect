import type { QuizInfo } from "@/api/sessions";
import { ArrowLeft, CheckCircle, Copy } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

function LobbyPageHeader({
  quizMetadata,
  gameCode,
}: {
  quizMetadata: QuizInfo;
  gameCode: string;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    if (location.key === "default") {
      navigate("/");
    } else {
      navigate(-1);
    }
  };

  const [copied, setCopied] = useState(false);
  const handleCopyCode = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(gameCode);
      } else {
        // fallback for insecure context
        const el = document.createElement("textarea");
        el.value = gameCode;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }

      toast.success("Code copied to clipboard!");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy code");
      console.error("Copy failed:", err);
    }
  };

  return (
    <div className="bg-card border-border flex w-full shrink-0 items-center gap-4 rounded-xl border px-4 py-3 text-lg font-semibold">
      <button onClick={handleBack} className="hover:text-primary mx-2">
        <ArrowLeft size={20} />
      </button>
      <div className="flex h-16 flex-1 flex-col justify-center">
        <h1 className="line-clamp-1 text-xl text-white/80">
          {quizMetadata.title}
        </h1>
        <p className="line-clamp-2 text-xs text-white/40">
          {quizMetadata.description}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-end">
          <span className="text-primary text-xs leading-tight">CODE</span>
          <h2 className="text-secondary-foreground text-2xl leading-tight font-bold">
            {gameCode}
          </h2>
        </div>
        <button
          onClick={handleCopyCode}
          className="bg-secondary text-secondary-foreground hover:text-primary flex items-center justify-center rounded-lg p-1.5 transition-colors"
          title="Copy game code"
        >
          {copied ? (
            <CheckCircle size={14} className="text-green-400" />
          ) : (
            <Copy size={14} />
          )}
        </button>
      </div>
    </div>
  );
}

export default LobbyPageHeader;
