import { logoutUser } from "@/api/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { useEditProfile } from "@/contexts/edit-profile-context";
import { useLogin } from "@/contexts/login-context";
import { handleGeneralError, handleGeneralSuccess } from "@/lib/axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, History, LogOut, Pen, ScrollText } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

function AvatarMenu() {
  const navigate = useNavigate();
  const { user, clearUser } = useLogin();
  const { openProfileEdit } = useEditProfile();
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
        openProfileEdit();
        break;

      case "history":
        // Navigate to quiz history page
        if (location.pathname.startsWith("/game")) {
          toast.error("Please Exit first before going to other page!");
        } else {
          navigate("/history");
        }
        break;

      case "quiz":
        // Navigate to user's created quizzes page
        if (location.pathname.startsWith("/game")) {
          toast.error("Please Exit first before going to other page!");
        } else {
          navigate("/quiz-set");
        }
        break;

      case "logout":
        if (location.pathname.startsWith("/game")) {
          toast.error("You cannot logout when the game is running...");
        } else {
          logoutMutation.mutate();
        }

        break;

      default:
        break;
    }
  };

  return (
    <Popover open={openMenu}>
      <PopoverAnchor>
        <div
          className="bg-card border-border flex w-60 items-center justify-between gap-2 rounded-xl border p-1.5 px-2"
          onClick={() => setOpenMenu((prev) => !prev)}
        >
          <div className="flex min-w-0 items-center gap-2">
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
            <p className="truncate text-sm font-semibold">{user?.username}</p>
          </div>
          <ChevronDown
            className={`${
              openMenu ? "rotate-180" : ""
            } transition-all duration-150`}
            strokeWidth={3}
          />
        </div>
      </PopoverAnchor>

      <PopoverContent className="flex w-(--radix-popover-trigger-width) flex-col p-2">
        <div
          className="hover:bg-accent/40 flex cursor-default items-center gap-2 rounded-md p-2 text-sm font-semibold"
          onClick={() => handleMenuClick("edit")}
        >
          <Pen size={16} strokeWidth={2} />
          Edit Profile
        </div>
        <div
          className="hover:bg-accent/40 flex cursor-default items-center gap-2 rounded-md p-2 text-sm font-semibold"
          onClick={() => handleMenuClick("history")}
        >
          <History size={16} strokeWidth={2} />
          History
        </div>
        <div
          className="hover:bg-accent/40 flex cursor-default items-center gap-2 rounded-md p-2 text-sm font-semibold"
          onClick={() => handleMenuClick("quiz")}
        >
          <ScrollText size={16} strokeWidth={2} />
          My Quiz Sets
        </div>
        <div
          className="hover:bg-accent/40 text-destructive flex cursor-default items-center gap-2 rounded-md p-2 text-sm font-semibold"
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
