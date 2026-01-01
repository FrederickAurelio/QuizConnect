import { Button } from "@/components/ui/button";
import { useLogin } from "@/contexts/login-context";
import AvatarMenu from "@/pages/home/components/avatar-menu";
import { Gamepad } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

function Header() {
  const location = useLocation();

  const navigate = useNavigate();
  const { openLogin, isAuthenticated } = useLogin();

  const handleClickLogo = () => {
    if (location.pathname.startsWith("/game")) {
      toast.error("Please Exit first before going to other page!");
    } else {
      navigate("/");
    }
  };

  return (
    <div className="border-border relative mx-10 flex h-20 shrink-0 items-center justify-center gap-1 border-b">
      <div className="flex items-center gap-1" onClick={handleClickLogo}>
        <Gamepad className="text-primary size-12 -translate-y-px" />
        <h1 className="text-secondary-foreground cursor-default text-3xl font-semibold">
          <span className="text-primary">Quiz</span>Connect
        </h1>
      </div>

      <div className="absolute right-10">
        {isAuthenticated ? (
          <AvatarMenu />
        ) : (
          <Button
            className="text-lg"
            onClick={() => {
              if (location.pathname.startsWith("/game")) {
                toast.error(
                  "You can only login again when you are not in the game, please leave the lobby/game first!",
                );
              } else {
                openLogin();
              }
            }}
            size="default"
          >
            Sign Up
          </Button>
        )}
      </div>
    </div>
  );
}

export default Header;
