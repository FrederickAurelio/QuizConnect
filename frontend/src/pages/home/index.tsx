"use client";
import { checkLobbyStatus } from "@/api/sessions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLogin } from "@/contexts/login-context";
import { handleGeneralError } from "@/lib/axios";
import { useMutation } from "@tanstack/react-query";
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
    <div className="relative overflow-visible before:pointer-events-none before:absolute before:-inset-20 before:-z-10 before:rounded-xl before:bg-[radial-gradient(circle_at_center,var(--card)_20%,transparent_60%)] before:opacity-0 before:transition-opacity before:duration-500 before:content-[''] hover:before:opacity-100">
      {/* Ensure content sits on top of the expanded glow */}
      <div className={`relative z-10 ${className}`}>{children}</div>
    </div>
  );
}

function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, openLogin } = useLogin();
  const [codeInput, setCodeInput] = useState("");

  const joinMutation = useMutation({
    mutationFn: checkLobbyStatus,
    onSuccess: (data) => {
      navigate(`/game/${data.data?.gameCode}`);
    },
    onError: handleGeneralError,
  });

  const handleClickJoin = () => {
    if (codeInput.length < 6) return;
    joinMutation.mutate(codeInput);
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
    <div className="grid h-[90%] w-full grid-cols-2">
      {/* JOIN */}
      <BackgroundWrapper className="group flex h-full flex-col items-center justify-center gap-6">
        <div className="border-primary text-primary bg-secondary rounded-3xl border p-4 opacity-60 transition-all duration-200 group-hover:p-[17px] group-hover:opacity-100">
          <Gamepad className="size-13 transition-all duration-200 group-hover:size-14" />
        </div>
        <div className="flex flex-col items-center gap-0">
          <h1 className="text-4xl font-bold">Join Quiz</h1>
          <p className="text-lg font-normal text-white/60">
            Enter the code to join the quiz.
          </p>
        </div>
        <div className="flex w-full max-w-[360px] flex-col items-center gap-3">
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
            className="rounded-2xl p-6 text-center text-2xl! font-semibold tracking-widest"
            placeholder="••••••"
            value={codeInput}
          />
          <Button
            disabled={codeInput.length < 6 || joinMutation.isPending}
            size="lg"
            className="flex w-full items-center gap-1 rounded-xl text-lg font-bold"
            onClick={handleClickJoin}
          >
            <JoystickIcon strokeWidth={3} />
            <span>Join</span>
          </Button>
        </div>
      </BackgroundWrapper>

      {/* HOST */}
      <BackgroundWrapper className="group flex h-full flex-col items-center justify-center gap-6">
        <div className="border-primary text-primary bg-secondary rounded-3xl border p-5 opacity-60 transition-all duration-200 group-hover:p-[22px] group-hover:opacity-100">
          <Globe className="size-11 transition-all duration-200 group-hover:size-12" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-4xl font-bold">Hosting?</h1>
          <div className="flex flex-col items-center gap-0 text-lg leading-tight font-normal text-white/60">
            <span>Be the game master!</span>
            <span>Start the quiz and watch the fun unfold.</span>
          </div>
        </div>
        <div className="flex w-full max-w-[360px] flex-col items-center gap-3">
          <Button
            size="lg"
            className="flex w-full items-center justify-between gap-1 rounded-xl px-5! py-10 text-lg font-bold"
            onClick={handleClickHost}
            variant="secondary"
          >
            <div className="flex flex-col items-start">
              <span className="text-primary text-xl">Create a Quiz</span>
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
