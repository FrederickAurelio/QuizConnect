import { useEffect, useState } from "react";

export function useGameCountdown(
  startTime: string,
  durationMs: number,
  perload: number = 1000,
) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const calculate = () => {
      const start = new Date(startTime).getTime();
      const now = Date.now();
      const passed = Math.floor((now - start) / perload);
      const total = Math.floor(durationMs / perload);
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
    }, perload);

    return () => clearInterval(timer);
  }, [startTime, durationMs]);

  return remaining;
}
