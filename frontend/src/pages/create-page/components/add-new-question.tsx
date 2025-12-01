import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

type Props = {
  onClick: () => void;
};

function AddNewQuestionBtn({ onClick }: Props) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="lg"
      className="mb-2 flex h-fit shrink-0 flex-col items-center justify-center gap-2 border border-dashed py-4! text-lg! font-semibold text-white/40 duration-150 hover:text-white/60"
      onClick={onClick}
    >
      <div className="bg-secondary rounded-full p-2">
        <Plus className="text-secondary-foreground" size={28} />
      </div>
      Add Question
    </Button>
  );
}

export default AddNewQuestionBtn;
