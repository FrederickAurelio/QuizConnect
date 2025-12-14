import { getDetailQuiz } from "@/api/quiz";
import { handleGeneralError } from "@/lib/axios";
import CreatePage from "@/pages/create-page";
import LoadingPage from "@/pages/loading-page";
import { useQuery } from "@tanstack/react-query";
import { Navigate, useParams } from "react-router";

function EditPage() {
  const { quizId } = useParams();
  const { data, isPending, isLoading, isFetched, isFetching, isError, error } =
    useQuery({
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

  if (!quiz || isError) {
    handleGeneralError(error as any);
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
