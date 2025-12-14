import { copyQuiz, deleteQuiz, type QuizListItem } from "@/api/quiz";
import { hostQuiz } from "@/api/sessions";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { handleGeneralError, handleGeneralSuccess } from "@/lib/axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CircleQuestionMark,
  Copy,
  Edit2,
  EllipsisVertical,
  Pencil,
  Play,
  Text,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

type Props = {
  quiz: QuizListItem;
};

function QuizCard({ quiz }: Props) {
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState(false);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: deleteQuiz,
    onSuccess: (resData) => {
      handleGeneralSuccess(resData);
      setOpenMenu(false);
      queryClient.setQueriesData({ queryKey: ["quizzes"] }, (oldData: any) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            data: {
              ...page.data,
              data: page.data.data.filter((q: any) => q._id !== quiz._id),
            },
          })),
        };
      });
    },
    onError: handleGeneralError,
  });

  const copyMutation = useMutation({
    mutationFn: copyQuiz,
    onSuccess: (resData) => {
      setOpenMenu(false);
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

  const hostMutation = useMutation({
    mutationFn: hostQuiz,
    onSuccess: (resData) => {
      handleGeneralSuccess(resData);
      setOpenMenu(false);
      navigate(`/host/${resData.data?.gameCode}`);
    },
    onError: handleGeneralError,
  });

  const handleEdit = () => {
    setOpenMenu(false);
    navigate(`/edit/${quiz._id}`);
  };
  const handleHost = () => {
    setOpenMenu(false);
    hostMutation.mutate(quiz._id);
  };
  const handleDelete = async () => {
    deleteMutation.mutate(quiz._id);
  };
  const handleCopy = async () => {
    copyMutation.mutate(quiz._id);
  };

  return (
    <div
      className={`border-border hover:shadow-primary relative flex h-[242px] flex-col justify-between gap-4 rounded-xl border p-5 transition-all duration-200 hover:-translate-y-[2px] hover:shadow-2xl hover:drop-shadow-2xl ${
        quiz.draft ? "border-dashed" : "bg-card"
      }`}
    >
      <div className="absolute top-3 right-3">
        <Popover open={openMenu} onOpenChange={setOpenMenu}>
          <PopoverTrigger className="hover:text-white/60">
            <Button variant="ghost" size="icon-sm">
              <EllipsisVertical size={16} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="flex w-fit flex-col p-0" side="top">
            <Button
              variant="ghost"
              className="hover:text-primary flex cursor-default items-center justify-start gap-2 p-1 px-2 text-sm"
              disabled={
                deleteMutation.isPending ||
                copyMutation.isPending ||
                hostMutation.isPending
              }
              onClick={handleEdit}
            >
              <Edit2 size={12} />
              Edit
            </Button>
            <Button
              variant="ghost"
              className="hover:text-chart-4 flex cursor-default items-center justify-start gap-2 p-1 px-2 text-sm"
              disabled={
                deleteMutation.isPending ||
                copyMutation.isPending ||
                hostMutation.isPending
              }
              onClick={handleCopy}
            >
              <Copy size={12} />
              Copy
            </Button>
            <Button
              variant="ghost"
              className="hover:text-destructive flex cursor-default items-center justify-start gap-2 p-1 px-2 text-sm"
              disabled={
                deleteMutation.isPending ||
                copyMutation.isPending ||
                hostMutation.isPending
              }
              onClick={handleDelete}
            >
              <Trash2 size={12} />
              Delete
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="line-clamp-2 text-2xl font-semibold">{quiz.title}</h1>
        <p className="line-clamp-3 opacity-60">{quiz.description}</p>
      </div>

      <div className="border-border flex w-full items-center justify-between border-t px-3 pt-4">
        {quiz.draft ? (
          <div className="flex items-center gap-1 text-white/50">
            <Text className="-translate-y-px" size={16} strokeWidth={3} />
            <p className="text-sm leading-none font-bold">Draft</p>
            <p className="translate-y-px text-xs font-normal">
              {quiz.questionCount} Qs
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-white/50">
            <CircleQuestionMark size={16} strokeWidth={3} />
            <p className="text-sm leading-none font-bold">
              {quiz.questionCount} Qs
            </p>
          </div>
        )}

        {quiz.draft ? (
          <Button
            size="sm"
            variant="secondary"
            className="flex h-7 items-center font-semibold"
            onClick={handleEdit}
          >
            <Pencil strokeWidth={3} />
            <span>Continue</span>
          </Button>
        ) : (
          <Button
            size="sm"
            className="flex h-7 items-center font-semibold"
            onClick={handleHost}
          >
            <Play strokeWidth={3} />
            <span>Host</span>
          </Button>
        )}
      </div>
    </div>
  );
}

export default QuizCard;
