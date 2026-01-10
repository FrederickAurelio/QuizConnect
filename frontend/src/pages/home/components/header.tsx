import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useLogin } from "@/contexts/login-context";
import AvatarMenu from "@/pages/home/components/avatar-menu";
import { ArrowLeft, Gamepad } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

function Header() {
  const location = useLocation();
  const [openConfirm, setOpenConfirm] = useState(false);
  const navigate = useNavigate();
  const { openLogin, isAuthenticated } = useLogin();

  const handleClickLogo = () => {
    if (location.pathname.startsWith("/game")) {
      toast.error("Please Exit first before going to other page!");
    } else {
      navigate("/");
    }
  };

  const onBack = () => {
    if (window.history.state?.idx && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate("/");
    }
    if (openConfirm) setOpenConfirm(false);
  };

  return (
    <div className="border-border relative mx-10 flex h-20 shrink-0 items-center justify-center gap-1 border-b">
      <div className="absolute left-14">
        <button
          className="hover:text-primary border-border text-secondary-foreground bg-card flex size-9 items-center justify-center gap-2 rounded-lg border-2 text-xl hover:scale-105 hover:shadow-2xl"
          onClick={() => {
            if (location.pathname.startsWith("/game")) {
              setOpenConfirm(true);
              return;
            }
            onBack();
          }}
        >
          <ArrowLeft size={20} />
        </button>
      </div>

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

      <Dialog open={openConfirm} onOpenChange={setOpenConfirm}>
        <DialogContent className="max-w-sm">
          <DialogTitle className="text-lg font-semibold">
            Are you sure you want leave?
          </DialogTitle>
          <div className="text-sm text-white/60">
            You are currently in the middle of the game/lobby. You can rejoin if
            you leave now.
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={onBack}>Confirm</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Header;
