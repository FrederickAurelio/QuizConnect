import { Gamepad } from "lucide-react";

function LoadingPage() {
  return (
    <div className="flex h-[90vh] w-full items-center justify-center">
      <div className="flex flex-col items-center">
        <div className="animate-wiggle animate-infinite animation-duration-[1500ms]">
          <Gamepad className="text-primary block" size={120} />
        </div>
        <h1 className="text-secondary-foreground -translate-y-2 text-3xl font-semibold">
          <span className="text-primary">Quiz</span>Connect
        </h1>
      </div>
    </div>
  );
}

export default LoadingPage;
