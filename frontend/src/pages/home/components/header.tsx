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
