"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLogin } from "@/contexts/login-context";
import { Gamepad, Globe, JoystickIcon, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

function BackgroundWrapper({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className="
        relative overflow-visible 
        before:absolute before:-inset-20 before:rounded-xl
        before:content-[''] before:pointer-events-none
        before:opacity-0 before:transition-opacity before:duration-500
        hover:before:opacity-100
        before:bg-[radial-gradient(circle_at_center,var(--card)_20%,transparent_60%)]
        before:-z-10
      "
    >
      {/* Ensure content sits on top of the expanded glow */}
      <div className={`relative z-10 ${className}`}>{children}</div>
    </div>
  );
}

function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, openLogin } = useLogin();
  const [codeInput, setCodeInput] = useState("");

  const handleClickJoin = () => {
    if (codeInput.length < 6) return;
  };
  const handleClickHost = () => {
    if (!isAuthenticated) {
      toast.info("You need to sign in to host a quiz.");
      openLogin();
    } else {
      navigate("/quiz-set");
    }
  };
  return (
    <div className="w-full h-[90%] grid grid-cols-2">
      {/* JOIN */}
      <BackgroundWrapper className="group flex flex-col h-full items-center justify-center gap-6">
        <div className="group-hover:p-[17px] transition-all duration-200 border-primary text-primary p-4 border rounded-3xl bg-secondary opacity-60 group-hover:opacity-100">
          <Gamepad className="size-13 group-hover:size-14 transition-all duration-200" />
        </div>
        <div className="flex flex-col items-center gap-0">
          <h1 className="text-4xl font-bold">Join Quiz</h1>
          <p className="text-lg text-white/60 font-normal">
            Enter the code to join the quiz.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 w-full max-w-[360px]">
          <Input
            type="text"
            onChange={(e) => {
              const trimmedValue = e.target.value.trim();
              setCodeInput(trimmedValue);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleClickJoin();
              }
            }}
            maxLength={6}
            className="text-center text-2xl! tracking-widest font-semibold 
               p-6 rounded-2xl"
            placeholder="••••••"
            value={codeInput}
          />
          <Button
            size="lg"
            className="text-lg w-full rounded-xl font-bold flex items-center gap-1"
            onClick={handleClickJoin}
          >
            <JoystickIcon strokeWidth={3} />
            <span>Join</span>
          </Button>
        </div>
      </BackgroundWrapper>

      {/* HOST */}
      <BackgroundWrapper className="group flex flex-col h-full items-center justify-center gap-6">
        <div className="border-primary text-primary p-5 group-hover:p-[22px] border rounded-3xl bg-secondary transition-all duration-200  opacity-60 group-hover:opacity-100">
          <Globe className="size-11 group-hover:size-12 transition-all duration-200" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-4xl font-bold">Hosting?</h1>
          <div className="flex flex-col items-center gap-0 text-lg text-white/60 font-normal leading-tight">
            <span>Be the game master!</span>
            <span>Start the quiz and watch the fun unfold.</span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-3 w-full max-w-[360px]">
          <Button
            size="lg"
            className="py-10 text-lg w-full rounded-xl font-bold flex items-center gap-1 justify-between px-5!"
            onClick={handleClickHost}
            variant="secondary"
          >
            <div className="flex flex-col items-start">
              <span className="text-xl text-primary">Create a Quiz</span>
              <span className="text-sm font-normal">
                Start a new session for player
              </span>
            </div>
            <Plus className="size-6" strokeWidth={3} />
          </Button>
        </div>
      </BackgroundWrapper>
    </div>
  );
}

export default LandingPage;
