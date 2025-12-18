import { editProfile, type ProfileUserResponse } from "@/api/auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEditProfile } from "@/contexts/edit-profile-context";
import { useLogin } from "@/contexts/login-context";
import { handleGeneralError } from "@/lib/axios";
import { avatars } from "@/lib/constant";
import { socket } from "@/lib/socket";
import { useMutation } from "@tanstack/react-query";
import clsx from "clsx";
import { Pencil, SaveAll } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
};

function EditProfileDialog({ open, onOpenChange }: Props) {
  const { gameCode } = useParams();
  const { user, setUser } = useLogin();
  const { closeProfileEdit } = useEditProfile();

  const [data, setData] = useState({
    avatar: user?.avatar ?? "",
    username: user?.username ?? "",
  });
  const isInvalid =
    (data.username ?? "").length < 3 || (data.username ?? "").length > 50;

  const handleSuccess = (data: ProfileUserResponse) => {
    toast.success(data.message || "Profile updated successfully");
    closeProfileEdit();

    const user = data.data;
    if (!user) return;

    const typeUser = user?.userId.startsWith("guest_") ? "guest" : "auth";
    setUser({
      type: typeUser,
      userId: user.userId,
      username: user.username,
      avatar: user.avatar,
    });

    setTimeout(() => {
      setData({
        avatar: user?.avatar,
        username: user?.username,
      });
    }, 1000);

    if (gameCode) {
      socket.emit("update-profile", {
        username: user.username,
        avatar: user.avatar,
      });
    }
  };

  const editProfileMutation = useMutation({
    mutationFn: editProfile,
    onSuccess: handleSuccess,
    onError: handleGeneralError,
  });

  const handleSubmit = () => {
    editProfileMutation.mutate({
      username: data.username ?? "",
      avatar: data.avatar ?? "",
    });
  };

  return (
    <Dialog
      onOpenChange={(o) => {
        if (!o) {
          setTimeout(() => {
            setData({
              avatar: user?.avatar ?? "",
              username: user?.username ?? "",
            });
          }, 300);
        }
        onOpenChange(o);
      }}
      open={open}
    >
      <DialogContent className="flex max-w-[500px]! flex-col gap-6">
        <DialogTitle className="text-secondary-foreground flex items-center gap-2">
          <Pencil size={20} />
          Edit Profile
        </DialogTitle>

        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-white/60">Preview</h2>
          <div className="flex items-center gap-2">
            <img
              className="bg-secondary size-12 rounded-full p-2"
              src={data?.avatar}
              alt="avatar"
            />
            <Input
              min={3}
              max={50}
              onChange={(e) => {
                setData((prev) => ({ ...prev, username: e.target.value }));
              }}
              value={data.username}
              className="h-10 text-lg!"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-white/60">
            Select Avatars
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {avatars.map((avatar) => {
              const isSelected = data.avatar === avatar.src;

              return (
                <Tooltip delayDuration={300} key={avatar.src}>
                  <TooltipTrigger asChild>
                    <img
                      className={clsx(
                        "bg-secondary size-12 cursor-pointer rounded-full p-2 transition-all",
                        isSelected
                          ? "border-primary scale-[120%] border-[3px] hover:border-[3px]"
                          : "hover:border-primary/50 hover:border",
                      )}
                      src={avatar.src}
                      alt={avatar.label}
                      onClick={() =>
                        setData((prev) => ({ ...prev, avatar: avatar.src }))
                      }
                    />
                  </TooltipTrigger>
                  <TooltipContent className="text-primary-foreground font-semibold">
                    {avatar.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button
            disabled={editProfileMutation.isPending}
            onClick={() => {
              if (isInvalid) {
                return toast.error(
                  "Username must be at least 3 characters and below 50 characters",
                );
              }
              handleSubmit();
            }}
            className={clsx(
              "flex w-32 items-center font-semibold transition-all",
              isInvalid
                ? "cursor-not-allowed opacity-50 grayscale-50"
                : "cursor-pointer opacity-100",
            )}
          >
            <SaveAll className="mr-2 size-5" />
            <span>Save</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EditProfileDialog;
