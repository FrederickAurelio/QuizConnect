import {
  copyQuiz,
  deleteQuiz,
  getQuizzes,
  type QuizListItem,
} from "@/api/quiz";
import QuizCard from "@/pages/quiz-set-page/components/quiz-card";
import QuizCardCreate from "@/pages/quiz-set-page/components/quiz-card-create";
import { QuizSetDialogs } from "@/pages/quiz-set-page/components/quiz-set-dialogs";
import { handleGeneralError, handleGeneralSuccess } from "@/lib/axios";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { throttle } from "throttle-debounce";
import { useInView } from "react-intersection-observer";

const tabs: { key: "all" | "draft" | "ready"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ready", label: "Ready" },
  { key: "draft", label: "Draft" },
];

function QuizSetPage() {
  const [option, setOption] = useState<"all" | "draft" | "ready">("all");
  const draftOnly = option === "draft";
  const readyOnly = option === "ready";
  const containerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState<number>(0);

  const [copyTarget, setCopyTarget] = useState<QuizListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuizListItem | null>(null);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: deleteQuiz,
    onSuccess: (resData, deletedId) => {
      handleGeneralSuccess(resData);
      setDeleteTarget(null);
      queryClient.setQueriesData({ queryKey: ["quizzes"] }, (oldData: any) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            data: {
              ...page.data,
              data: page.data.data.filter((q: any) => q._id !== deletedId),
            },
          })),
        };
      });
    },
    onError: handleGeneralError,
  });

  const copyMutation = useMutation({
    mutationFn: (vars: { id: string; useDraft: boolean }) =>
      copyQuiz(vars.id, { useDraft: vars.useDraft }),
    onSuccess: (resData) => {
      setCopyTarget(null);
      setTimeout(() => {
        handleGeneralSuccess(resData);
        queryClient.setQueriesData(
          { queryKey: ["quizzes"] },
          (oldData: any) => {
            const newQuiz = resData.data;
            if (!oldData || !newQuiz) return oldData;

            return {
              ...oldData,
              pages: oldData.pages.map((page: any, i: number) => {
                return {
                  ...page,
                  data: {
                    ...page.data,
                    data:
                      i === 0 ? [newQuiz, ...page.data.data] : page.data.data,
                  },
                };
              }),
            };
          },
        );
        const el = document.getElementById("quiz-set-scroll");
        el?.scrollTo({ top: 0, behavior: "smooth" });
      }, 300);
    },
    onError: handleGeneralError,
  });

  const libraryBusy = copyMutation.isPending || deleteMutation.isPending;

  const handleRequestCopy = useCallback(
    (quiz: QuizListItem) => {
      if (quiz.hasQuizDraft) {
        setCopyTarget(quiz);
        return;
      }
      copyMutation.mutate({ id: quiz._id, useDraft: false });
    },
    [copyMutation],
  );

  const handleRequestDelete = useCallback((quiz: QuizListItem) => {
    setDeleteTarget(quiz);
  }, []);

  const handleCopyPublished = useCallback(() => {
    if (!copyTarget) return;
    copyMutation.mutate({ id: copyTarget._id, useDraft: false });
  }, [copyTarget, copyMutation]);

  const handleCopyDraft = useCallback(() => {
    if (!copyTarget) return;
    copyMutation.mutate({ id: copyTarget._id, useDraft: true });
  }, [copyTarget, copyMutation]);

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget._id);
  }, [deleteTarget, deleteMutation]);

  useEffect(() => {
    const updateColumns = () => {
      const width = containerRef.current?.clientWidth ?? 0;
      let count = 1;

      if (width >= 1200) count = 4;
      else if (width >= 900) count = 3;
      else if (width >= 650) count = 2;
      else count = 1;

      setColumns(count);
    };

    const throttled = throttle(200, updateColumns);
    throttled();

    const observer = new ResizeObserver(throttled);
    if (containerRef.current) observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching } =
    useInfiniteQuery({
      queryKey: ["quizzes", option],
      queryFn: async ({ pageParam = 1 }) =>
        getQuizzes({ page: pageParam, pageSize: 10, draftOnly, readyOnly }),
      getNextPageParam: (lastPage) => {
        if (lastPage.data?.hasNext) {
          return lastPage.data?.page + 1;
        }
        return undefined;
      },
      initialPageParam: 1,
    });

  const quizzes = data?.pages.flatMap((page) => page?.data?.data ?? []) ?? [];

  const { ref, inView } = useInView();

  useEffect(() => {
    if (inView && !isFetchingNextPage && !isFetching && hasNextPage)
      fetchNextPage();
  }, [inView, isFetchingNextPage, hasNextPage, fetchNextPage]);

  return (
    <div className="flex h-full w-full flex-col gap-2 px-4 pt-4">
      <QuizSetDialogs
        copyTarget={copyTarget}
        onCopyDismiss={() => setCopyTarget(null)}
        onCopyPublished={handleCopyPublished}
        onCopyDraft={handleCopyDraft}
        copyPending={copyMutation.isPending}
        deleteTarget={deleteTarget}
        onDeleteDismiss={() => setDeleteTarget(null)}
        onConfirmDelete={handleConfirmDelete}
        deletePending={deleteMutation.isPending}
      />

      {/* Header */}
      <div className="flex shrink-0 items-end justify-between">
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold max-sm:text-xl">My Library</h1>
          <p className="text-white/60 max-sm:text-xs">
            Manage your quizzes and host live.
          </p>
        </div>

        <div className="border-border bg-card flex items-center rounded-lg border p-1">
          {tabs.map((tab) => (
            <div
              key={tab.key}
              className={`w-16 cursor-default py-1 text-center text-sm font-semibold transition-colors duration-100 ${
                option === tab.key
                  ? "bg-border text-secondary-foreground rounded-md"
                  : "text-white/40"
              }`}
              onClick={() => setOption(tab.key)}
            >
              {tab.label}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div
        className="scroll-primary flex w-full flex-col overflow-y-auto py-2 pb-1"
        id="quiz-set-scroll"
      >
        <div
          className="grid gap-2"
          ref={containerRef}
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          <QuizCardCreate />
          {quizzes.map((quiz) => (
            <QuizCard
              key={quiz?._id}
              quiz={quiz}
              onRequestCopy={handleRequestCopy}
              onRequestDelete={handleRequestDelete}
              libraryBusy={libraryBusy}
            />
          ))}
        </div>
        {(hasNextPage || isFetchingNextPage || isFetching) && (
          <div
            className="text-primary flex h-12 shrink-0 items-center justify-center"
            ref={ref}
          >
            {(isFetchingNextPage || isFetching) && (
              <Loader2 className="animate-spin" size={26} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default QuizSetPage;
