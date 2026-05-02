import type { QuizListItem } from "@/api/quiz";
import { hostQuiz } from "@/api/sessions";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { handleGeneralError, handleGeneralSuccess } from "@/lib/axios";
import { useMutation } from "@tanstack/react-query";
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
  onRequestCopy: (quiz: QuizListItem) => void;
  onRequestDelete: (quiz: QuizListItem) => void;
  /** True while a library copy or delete is in flight (disables menu actions). */
  libraryBusy: boolean;
};

function QuizCard({ quiz, onRequestCopy, onRequestDelete, libraryBusy }: Props) {
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState(false);

  const hostMutation = useMutation({
    mutationFn: hostQuiz,
    onSuccess: (resData) => {
      handleGeneralSuccess(resData);
      navigate(`/game/${resData.data?.gameCode}`);
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

  const handleDeleteClick = () => {
    setOpenMenu(false);
    onRequestDelete(quiz);
  };

  const handleCopyClick = () => {
    setOpenMenu(false);
    onRequestCopy(quiz);
  };

  const busy = libraryBusy || hostMutation.isPending;

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
              disabled={busy}
              onClick={handleEdit}
            >
              <Edit2 size={12} />
              Edit
            </Button>
            <Button
              variant="ghost"
              className="hover:text-chart-4 flex cursor-default items-center justify-start gap-2 p-1 px-2 text-sm"
              disabled={busy}
              onClick={handleCopyClick}
            >
              <Copy size={12} />
              Copy
            </Button>
            <Button
              variant="ghost"
              className="hover:text-destructive flex cursor-default items-center justify-start gap-2 p-1 px-2 text-sm"
              disabled={busy}
              onClick={handleDeleteClick}
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
          <div className="flex flex-col items-start gap-0.5 text-white/50 sm:flex-row sm:items-center sm:gap-2">
            <div className="flex items-center gap-1">
              <Text className="-translate-y-px" size={16} strokeWidth={3} />
              <p className="text-sm leading-none font-bold">Draft</p>
              <p className="translate-y-px text-xs font-normal">
                {quiz.questionCount} Qs
              </p>
            </div>
            {quiz.hasQuizDraft && (
              <p className="translate-y-0.5 text-xs font-semibold text-amber-400/90">
                Modified
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-start gap-0.5 text-white/50 sm:flex-row sm:items-center sm:gap-2">
            <div className="flex items-center gap-1">
              <CircleQuestionMark size={16} strokeWidth={3} />
              <p className="text-sm leading-none font-bold">
                {quiz.questionCount} Qs
              </p>
            </div>
            {quiz.hasQuizDraft && (
              <p className="translate-y-0.5 text-xs font-semibold text-amber-400/90">
                Modified
              </p>
            )}
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
