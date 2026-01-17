import { initialGetUser } from "@/api/auth";
import { useQuery } from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

type UserType = {
  type: "auth" | "guest";
  userId: string;
  username: string;
  avatar: string;
};

type LoginContextType = {
  isAuthenticated: boolean;
  isLoginDialogOpen: boolean;
  openLogin: () => void;
  closeLogin: () => void;
  // need to add
  user: UserType | null;
  setUser: Dispatch<SetStateAction<UserType | null>>;
  clearUser: () => void;
  isPending: boolean;
  offSet: number;
};

const LoginContext = createContext<LoginContextType | null>(null);

function LoginProvider({ children }: { children: ReactNode }) {
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const openLogin = () => setIsLoginDialogOpen(true);
  const closeLogin = () => setIsLoginDialogOpen(false);

  const [offSet, setOffset] = useState(0);
  const [user, setUser] = useState<UserType | null>(null);
  const isAuthenticated = user?.type === "auth";
  const clearUser = () => {
    setUser(null);
  };

  const {
    isPending: isPendings,
    isLoading,
    isFetched,
    isFetching,
  } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const t0 = Date.now();
      const { data } = await initialGetUser();
      const t1 = Date.now();

      if (!data) return null;
      const typeUser = data?.userId.startsWith("guest_") ? "guest" : "auth";
      setUser({
        type: typeUser,
        userId: data.userId,
        username: data.username,
        avatar: data.avatar,
      });
      const serverNowMs = new Date(data.serverNow).getTime();
      const offset = serverNowMs - (t0 + t1) / 2;
      setOffset(offset);

      return data;
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const isPending = isPendings || isLoading || !isFetched || isFetching;

  return (
    <LoginContext
      value={{
        isAuthenticated,
        isPending,
        user,
        setUser,
        clearUser,
        isLoginDialogOpen,
        openLogin,
        closeLogin,
        offSet,
      }}
    >
      {children}
    </LoginContext>
  );
}

function useLogin() {
  const ctx = useContext(LoginContext);
  if (!ctx) {
    throw new Error("useLogin must be used within LoginProvider");
  }
  return ctx;
}
export default LoginProvider;
export { useLogin };
