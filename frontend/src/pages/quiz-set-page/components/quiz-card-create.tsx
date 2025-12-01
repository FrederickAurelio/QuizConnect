import { Plus } from "lucide-react";
import { useNavigate } from "react-router";

function QuizCardCreate() {
  const navigate = useNavigate();
  const handleClick = () => {
    navigate("/create");
  };
  return (
    <div
      className={`border-border hover:shadow-primary flex h-[242px] shrink-0 flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-5 transition-all duration-200 hover:-translate-y-[2px] hover:shadow-2xl hover:drop-shadow-2xl`}
      onClick={handleClick}
    >
      <div className="bg-secondary rounded-full p-3">
        <Plus className="text-secondary-foreground" size={28} />
      </div>
      <div className="flex flex-col items-center leading-none">
        <h2 className="text-lg font-semibold">Create New Quiz</h2>
        <p className="text-white/60">Make a new quiz for your players</p>
      </div>
    </div>
  );
}

export default QuizCardCreate;
