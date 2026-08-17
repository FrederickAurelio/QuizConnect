export const SITE_URL = (
  import.meta.env.VITE_SITE_URL || "https://quizconnect.online"
).replace(/\/$/, "");

export const SITE_NAME = "QuizConnect";

export const SITE_DESCRIPTION =
  "Host live multiplayer quizzes, join with a 6-digit code, and compete on a real-time leaderboard. Create your own quiz or generate one with AI.";

export const DEFAULT_TITLE = `${SITE_NAME} | Live Multiplayer Quizzes`;

type PageMeta = { title: string; description: string };

export function metaForPath(pathname: string): PageMeta {
  if (pathname === "/") {
    return { title: DEFAULT_TITLE, description: SITE_DESCRIPTION };
  }
  if (pathname.startsWith("/game/")) {
    return {
      title: `Join Game | ${SITE_NAME}`,
      description:
        "Someone invited you to a live QuizConnect game. Open the link to join the lobby and play in real time.",
    };
  }
  if (pathname.startsWith("/quiz-set")) {
    return {
      title: `My Library | ${SITE_NAME}`,
      description:
        "Manage your quiz sets and start a live game on QuizConnect.",
    };
  }
  if (pathname.startsWith("/create")) {
    return {
      title: `Create Quiz | ${SITE_NAME}`,
      description: "Create a new quiz and host a live game on QuizConnect.",
    };
  }
  if (pathname.startsWith("/ai-generate")) {
    return {
      title: `AI Quiz Generator | ${SITE_NAME}`,
      description: "Generate a quiz with AI and host it live on QuizConnect.",
    };
  }
  if (pathname.startsWith("/edit/")) {
    return {
      title: `Edit Quiz | ${SITE_NAME}`,
      description: "Edit your quiz on QuizConnect.",
    };
  }
  if (pathname.startsWith("/history")) {
    return {
      title: `History | ${SITE_NAME}`,
      description:
        "View past QuizConnect games, scores, and answer breakdowns.",
    };
  }
  return { title: SITE_NAME, description: SITE_DESCRIPTION };
}
