import { logoutUser } from "@/api/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { useLogin } from "@/contexts/login-context";
import { handleGeneralError, handleGeneralSuccess } from "@/lib/axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, History, LogOut, Pen, ScrollText } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

function AvatarMenu() {
  const navigate = useNavigate();
  const { user, clearUser } = useLogin();
  const [openMenu, setOpenMenu] = useState(false);
  const queryClient = useQueryClient();

  const logoutMutation = useMutation({
    mutationFn: logoutUser,
    onSuccess: (data) => {
      navigate("/");
      setTimeout(() => {
        clearUser();
        queryClient.invalidateQueries({ queryKey: ["currentUser"] });
        handleGeneralSuccess(data);
      }, 100);
    },
    onError: handleGeneralError,
  });

  const handleMenuClick = (option: "edit" | "history" | "quiz" | "logout") => {
    setOpenMenu(false);

    switch (option) {
      case "edit":
        // open modal
        console.log("Edit Profile clicked");
        break;

      case "history":
        // Navigate to quiz history page
        console.log("History clicked");
        break;

      case "quiz":
        // Navigate to user's created quizzes page
        navigate("/quiz-set");
        break;

      case "logout":
        logoutMutation.mutate();
        break;

      default:
        break;
    }
  };

  return (
    <Popover open={openMenu}>
      <PopoverAnchor>
        <div
          className="bg-card p-1.5 rounded-xl px-2 flex items-center justify-between gap-2 w-60 border border-border"
          onClick={() => setOpenMenu((prev) => !prev)}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="size-10 p-2">
              <AvatarImage src={user?.avatar ?? ""} />
              <AvatarFallback>
                {user?.username
                  .split(" ")
                  .map((word) => word[0]?.toUpperCase())
                  .slice(0, 2)
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <p className="text-sm font-semibold truncate">{user?.username}</p>
          </div>
          <ChevronDown
            className={`${
              openMenu ? "rotate-180" : ""
            } transition-all duration-150`}
            strokeWidth={3}
          />
        </div>
      </PopoverAnchor>

      <PopoverContent className="w-(--radix-popover-trigger-width) p-2 flex flex-col">
        <div
          className="font-semibold flex items-center gap-2 p-2 rounded-md hover:bg-accent/40 text-sm cursor-default"
          onClick={() => handleMenuClick("edit")}
        >
          <Pen size={16} strokeWidth={2} />
          Edit Profile
        </div>
        <div
          className="font-semibold flex items-center gap-2 p-2 rounded-md hover:bg-accent/40 text-sm cursor-default"
          onClick={() => handleMenuClick("history")}
        >
          <History size={16} strokeWidth={2} />
          History
        </div>
        <div
          className="font-semibold flex items-center gap-2 p-2 rounded-md hover:bg-accent/40 text-sm cursor-default"
          onClick={() => handleMenuClick("quiz")}
        >
          <ScrollText size={16} strokeWidth={2} />
          My Quiz Sets
        </div>
        <div
          className="font-semibold flex items-center gap-2 p-2 rounded-md hover:bg-accent/40 text-sm text-destructive cursor-default"
          onClick={() => handleMenuClick("logout")}
        >
          <LogOut size={16} strokeWidth={2} />
          Logout
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default AvatarMenu;
