import { Toaster } from "@/components/ui/sonner";
import LoginProvider, { useLogin } from "@/contexts/login-context";
import Layout from "@/layout";
import CreatePage from "@/pages/create-page";
import LandingPage from "@/pages/home/index.tsx";
import LoadingPage from "@/pages/loading-page";
import QuizSetPage from "@/pages/quiz-set-page";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, useRef } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Navigate } from "react-router";
import { RouterProvider } from "react-router/dom";
import { toast } from "sonner";
import "./index.css";
import EditPage from "@/pages/edit-page";
import LobbyPage from "@/pages/lobby-page.tsx";

// -------------------- Private Route --------------------
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, openLogin } = useLogin();
  const shownRef = useRef(false);

  if (!isAuthenticated) {
    if (!shownRef.current) {
      toast.info("Sign in to unlock this page 🔓");
      openLogin();
      shownRef.current = true;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// -------------------- App Component --------------------
function AppRouter() {
  const { isPending } = useLogin();
  if (isPending) {
    return <LoadingPage />;
  }

  const router = createBrowserRouter([
    {
      path: "/",
      element: <Layout />,
      children: [
        {
          index: true,
          element: <LandingPage />,
        },
        {
          path: "/quiz-set",
          element: (
            <PrivateRoute>
              <QuizSetPage />
            </PrivateRoute>
          ),
        },
        {
          path: "/create",
          element: (
            <PrivateRoute>
              <CreatePage />
            </PrivateRoute>
          ),
        },
        {
          path: "/edit/:quizId",
          element: (
            <PrivateRoute>
              <EditPage />
            </PrivateRoute>
          ),
        },
        {
          path: "/host/:quizId",
          element: (
            <PrivateRoute>
              <LobbyPage />
            </PrivateRoute>
          ),
        },
        {
          path: "*",
          element: <Navigate to="/" replace />,
        },
      ],
    },
  ]);

  return <RouterProvider router={router} />;
}
const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <LoginProvider>
        <AppRouter />
      </LoginProvider>
    </QueryClientProvider>
    <Toaster position="top-center" />
  </StrictMode>
);
