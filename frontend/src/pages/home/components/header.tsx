import { Button } from "@/components/ui/button";
import { useLogin } from "@/contexts/login-context";
import AvatarMenu from "@/pages/home/components/avatar-menu";
import { Gamepad } from "lucide-react";
import { useNavigate } from "react-router";

function Header() {
  const navigate = useNavigate();
  const { openLogin, isAuthenticated } = useLogin();

  const handleClickLogo = () => {
    navigate("/");
  };

  return (
    <div className="flex justify-center items-center gap-1 h-20 border-b border-border mx-10 relative shrink-0">
      <div className="flex items-center gap-1" onClick={handleClickLogo}>
        <Gamepad className="size-12 text-primary -translate-y-px" />
        <h1 className="text-3xl font-semibold text-secondary-foreground cursor-default">
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
              openLogin();
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
