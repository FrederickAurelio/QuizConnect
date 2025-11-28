import { Plus } from "lucide-react";
import { useNavigate } from "react-router";

function QuizCardCreate() {
  const navigate = useNavigate();
  const handleClick = () => {
    navigate("/create");
  };
  return (
    <div
      className={`border-border hover:-translate-y-[2px] hover:shadow-2xl hover:shadow-primary hover:drop-shadow-2xl transition-all duration-200 border rounded-xl p-5 flex flex-col justify-center items-center gap-4 h-[242px] border-dashed shrink-0`}
      onClick={handleClick}
    >
      <div className="bg-secondary p-3 rounded-full">
        <Plus className="text-secondary-foreground" size={28} />
      </div>
      <div className="flex flex-col leading-none items-center">
        <h2 className="text-lg font-semibold">Create New Quiz</h2>
        <p className="text-white/60">Make a new quiz for your players</p>
      </div>
    </div>
  );
}

export default QuizCardCreate;
