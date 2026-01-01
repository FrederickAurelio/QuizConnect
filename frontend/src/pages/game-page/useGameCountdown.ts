import { useEffect, useState } from "react";

export function useGameCountdown(startTime: string, durationMs: number) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const calculate = () => {
      const start = new Date(startTime).getTime();
      const now = Date.now();
      const passed = Math.floor((now - start) / 1000);
      const total = Math.floor(durationMs / 1000);
      return Math.max(0, total - passed);
    };

    setRemaining(calculate());

    const timer = setInterval(() => {
      setRemaining(() => {
        const real = calculate();
        if (real <= 0) {
          clearInterval(timer);
          return 0;
        }
        return real;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime, durationMs]);

  return remaining;
}
