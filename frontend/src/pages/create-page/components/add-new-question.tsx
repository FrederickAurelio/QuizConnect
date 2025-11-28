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
      className="font-semibold text-lg! mb-2 border flex flex-col justify-center items-center gap-2 border-dashed shrink-0 text-white/40 py-4! h-fit hover:text-white/60 duration-150"
      onClick={onClick}
    >
      <div className="bg-secondary p-2 rounded-full">
        <Plus className="text-secondary-foreground" size={28} />
      </div>
      Add Question
    </Button>
  );
}

export default AddNewQuestionBtn;
