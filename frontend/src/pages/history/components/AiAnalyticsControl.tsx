import type { AiAnalyticsEnvelope } from "@/api/history";
import { postHistorySessionAnalytics } from "@/api/history";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { handleGeneralError } from "@/lib/axios";
import { useMutation } from "@tanstack/react-query";
import { BarChart3, Loader2 } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import AiAnalyticsPanel from "./AiAnalyticsPanel";

const MAX_ANALYTICS_POLL_ATTEMPTS = 3;
const DEFAULT_ANALYTICS_RETRY_MS = 1000;

async function fetchAnalyticsWithRetry(
  gameId: string,
  viewAs?: "host" | "player",
) {
  for (let attempt = 0; attempt < MAX_ANALYTICS_POLL_ATTEMPTS; attempt += 1) {
    const response = await postHistorySessionAnalytics(gameId, { viewAs });
    if (response.data?.status !== "processing") {
      return response;
    }

    const retryAfterMs =
      response.data.retryAfterMs ?? DEFAULT_ANALYTICS_RETRY_MS;
    await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
  }

  throw new Error(
    "Analytics is still generating. Please try again in a moment.",
  );
}

const disabledGenerateButtonClass =
  "border-primary/35 bg-primary/8 h-9 w-full gap-1.5 text-white/90 shadow-none sm:h-9 sm:w-auto sm:min-w-[10.5rem]";

export default function AiAnalyticsControl({
  gameId,
  viewAs,
  analyticsAllowed,
  analyticsDisabledReason,
  onEvidenceClick,
  children,
}: {
  gameId: string;
  viewAs?: "host" | "player";
  /** Host or signed-in player in this game — matches backend session auth. */
  analyticsAllowed: boolean;
  analyticsDisabledReason?: string;
  onEvidenceClick: (questionIndex: number) => void;
  /** Title + description block (left on md+, stacked on small screens) */
  children: ReactNode;
}) {
  const mutation = useMutation({
    mutationKey: ["history-analytics", gameId, viewAs],
    mutationFn: () => fetchAnalyticsWithRetry(gameId, viewAs),
    onError: handleGeneralError,
  });

  useEffect(() => {
    mutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset analytics when host/player tab changes
  }, [viewAs]);

  useEffect(() => {
    if (!analyticsAllowed) {
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset when access is revoked
  }, [analyticsAllowed]);

  const envelope: AiAnalyticsEnvelope | undefined =
    mutation.data?.data?.analytics;
  const cached = !!mutation.data?.data?.cached;
  const hasResult = !!envelope;
  const tooltipMessage =
    analyticsDisabledReason ??
    "Session analytics are only available to the host or a player in this game.";

  const generateButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={`${disabledGenerateButtonClass} hover:border-primary/50 hover:bg-primary/15 hover:text-white`}
      disabled={mutation.isPending || !analyticsAllowed}
      onClick={() => analyticsAllowed && mutation.mutate()}
    >
      {mutation.isPending ? (
        <>
          <Loader2 className="size-3.5 shrink-0 animate-spin" />
          Generating…
        </>
      ) : (
        <>
          <BarChart3 className="size-3.5 shrink-0" />
          AI analytics
        </>
      )}
    </Button>
  );

  const disabledGenerateButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled
      className={`${disabledGenerateButtonClass} pointer-events-none opacity-45`}
    >
      <BarChart3 className="size-3.5 shrink-0" />
      AI analytics
    </Button>
  );

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">{children}</div>

        <div
          className={`flex w-full shrink-0 flex-col items-stretch gap-2 sm:w-auto sm:max-w-full sm:flex-row sm:flex-wrap sm:items-center sm:justify-end ${!analyticsAllowed ? "opacity-80" : ""}`}
        >
          {!hasResult ? (
            analyticsAllowed ? (
              generateButton
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    tabIndex={0}
                    className="inline-flex w-full cursor-not-allowed justify-stretch rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-auto sm:justify-end"
                  >
                    {disabledGenerateButton}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-balance">
                  {tooltipMessage}
                </TooltipContent>
              </Tooltip>
            )
          ) : (
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              <span className="rounded-md bg-white/10 px-2 py-1 text-xs leading-tight">
                {viewAs === "player" ? "Player view" : "Host view"}
              </span>
              {cached && (
                <span className="rounded-md bg-emerald-500/20 px-2 py-1 text-xs leading-tight text-emerald-200">
                  Saved analytics
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4 border-t border-white/10 pt-4">
        {!hasResult && !mutation.isPending && !mutation.isError && (
          <p className="text-xs text-white/45">
            {analyticsAllowed
              ? "One generation per view. Evidence chips below link to questions."
              : tooltipMessage}
          </p>
        )}

        {mutation.isPending && !envelope && analyticsAllowed && (
          <div className="flex items-center gap-2 text-sm text-white/80">
            <Loader2 className="size-4 shrink-0 animate-spin" />
            Generating analytics…
          </div>
        )}

        {mutation.isError && analyticsAllowed && (
          <div className="space-y-3 text-sm">
            <p className="text-white/70">Could not load analytics.</p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-9"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              Try again
            </Button>
          </div>
        )}

        {envelope && analyticsAllowed && (
          <AiAnalyticsPanel
            payload={envelope.payload}
            onEvidenceClick={onEvidenceClick}
            model={envelope.model}
            createdAt={envelope.createdAt}
          />
        )}
      </div>
    </div>
  );
}
