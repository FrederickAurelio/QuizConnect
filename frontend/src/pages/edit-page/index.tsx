import { getDetailQuiz } from "@/api/quiz";
import CreatePage from "@/pages/create-page";
import LoadingPage from "@/pages/loading-page";
import { useQuery } from "@tanstack/react-query";
import { Navigate, useParams } from "react-router";
import { toast } from "sonner";

function EditPage() {
  const { quizId } = useParams();
  const { data, isPending, isLoading, isFetched, isFetching } = useQuery({
    queryKey: ["quizDetail", quizId],
    queryFn: () => getDetailQuiz(quizId!),
    enabled: !!quizId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

  if (!quizId) return <Navigate to="/quiz-set" replace />;
  if (isPending || isLoading || !isFetched || isFetching)
    return <LoadingPage />;

  const quiz = data?.data;

  if (!quiz) {
    toast.error(data?.message);
    return <Navigate to="/quiz-set" replace />;
  }

  return (
    <CreatePage
      key={`${quiz._id}-${quiz.updatedAt}-edit`}
      editData={quiz}
      editMode={true}
    />
  );
}

export default EditPage;
