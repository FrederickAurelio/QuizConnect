import type { ApiResponse } from "@/api";
import {
  loginUser,
  registerUser,
  resetPasswordUser,
  sendCode,
  type ProfileUserResponse,
} from "@/api/auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useLogin } from "@/contexts/login-context";
import { handleGeneralError, handleGeneralSuccess } from "@/lib/axios";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { Binary, Loader2, Lock, LockKeyhole, Mail, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
};

const forgotTabs = [
  { label: "Register", value: "register" },
  { label: "Reset Password", value: "forgot" },
  { label: "Login", value: "login" },
] as const;

const tabs = [
  { label: "Register", value: "register" },
  { label: "Login", value: "login" },
] as const;

// ---- SCHEMAS ----
const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password required"),
});

const emailOnlySchema = loginSchema.pick({ email: true });

const registerSchema = z
  .object({
    email: z.email("Invalid email"),
    username: z
      .string()
      .min(3, "Username must be at least 3 chars")
      .max(50, "Username must be no longer than 50 chars"),
    password: z.string().min(6, "Password must be 6+ chars"),
    confirmPassword: z.string(),
    verificationCode: z
      .string()
      .min(6, "Verification code contains 6 characters")
      .max(6, "Verification code contains 6 characters"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const forgotSchema = z
  .object({
    email: z.string().email("Invalid email"),
    password: z.string().min(6, "Password must be 6+ chars"),
    confirmPassword: z.string(),
    verificationCode: z
      .string()
      .min(6, "Verification code contains 6 characters")
      .max(6, "Verification code contains 6 characters"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// ---- Data Types -----
type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;
type ForgotFormData = z.infer<typeof forgotSchema>;
type EmailFormData = { email: string };

type FormData = LoginFormData | RegisterFormData | ForgotFormData;

function LoginDialog({ open, onOpenChange }: Props) {
  const { setUser, closeLogin } = useLogin();
  const [option, setOption] = useState<"login" | "register" | "forgot">(
    "register",
  );
  const [timer, setTimer] = useState(0);

  const form = useForm<FormData>({
    resolver: zodResolver(
      option === "login"
        ? loginSchema
        : option === "register"
          ? registerSchema
          : forgotSchema,
    ),
    defaultValues: {
      email: "",
      username: "",
      password: "",
      confirmPassword: "",
      verificationCode: "",
    },
  });

  const handleSuccess = (data: ProfileUserResponse) => {
    toast.success(data.message ?? "Logged in successfully");
    closeLogin();

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
      form.reset();
    }, 1000);
  };

  const registerMutation = useMutation<
    ProfileUserResponse,
    AxiosError<ApiResponse<null>>,
    RegisterFormData
  >({
    mutationFn: registerUser,
    onSuccess: handleSuccess,
    onError: handleGeneralError,
  });

  const loginMutation = useMutation<
    ProfileUserResponse,
    AxiosError<ApiResponse<null>>,
    LoginFormData
  >({
    mutationFn: loginUser,
    onSuccess: handleSuccess,
    onError: handleGeneralError,
  });

  const resetPasswordMutation = useMutation<
    ProfileUserResponse,
    AxiosError<ApiResponse<null>>,
    ForgotFormData
  >({
    mutationFn: resetPasswordUser,
    onSuccess: handleSuccess,
    onError: handleGeneralError,
  });

  const sendCodeMutation = useMutation<
    ApiResponse<null>,
    AxiosError<ApiResponse<null>>,
    EmailFormData
  >({
    mutationFn: sendCode,
    onSuccess: (data) => {
      setTimer(120);
      handleGeneralSuccess(data);
    },
    onError: handleGeneralError,
  });

  const onSubmit = form.handleSubmit((data) => {
    if (option === "register") {
      registerMutation.mutate(data as RegisterFormData);
    } else if (option === "login") {
      loginMutation.mutate(data as LoginFormData);
    } else if (option === "forgot") {
      resetPasswordMutation.mutate(data as ForgotFormData);
    }
  });

  const handleSendCode = async () => {
    const email = form.getValues("email");
    const parsed = emailOnlySchema.safeParse({ email });

    if (!parsed.success) {
      const issue = parsed.error.issues?.[0];
      const msg = issue?.message ?? "Invalid email";
      toast.error(msg);
      return;
    }

    sendCodeMutation.mutate({ email });
  };

  useEffect(() => {
    if (timer <= 0) return;

    const timerIntrval = setInterval(() => {
      setTimer((prev) => Math.max(prev - 1, 0));
    }, 1000);

    return () => clearInterval(timerIntrval);
  }, [timer]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex max-w-[460px]! flex-col">
        <DialogTitle className="text-secondary-foreground text-center font-semibold">
          <span className="text-primary">Quiz</span>Connect
        </DialogTitle>
        {/* TABS */}
        <div className="bg-card flex h-fit items-center gap-1 rounded-xl p-1">
          {(option === "forgot" ? forgotTabs : tabs).map((tab) => (
            <div
              key={tab.value}
              className={`${
                tab.value === "forgot" ? "flex-[1.8]" : "flex-1"
              } flex cursor-pointer justify-center rounded-lg py-1.5 font-semibold transition-colors duration-200 ${
                option === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "text-white/60"
              }`}
              onClick={() => setOption(tab.value)}
            >
              {tab.label}
            </div>
          ))}
        </div>

        <Form {...form}>
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            {/* EMAIL */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-1">
                      <Input
                        Icon={Mail}
                        placeholder="Email address"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* USERNAME */}
            {option === "register" && (
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-1">
                        <Input
                          Icon={User}
                          placeholder="Enter username"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* PASSWORD for both */}
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      Icon={Lock}
                      type="password"
                      placeholder="Enter password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* CONFIRM PASSWORD (only for register) */}
            {(option === "register" || option === "forgot") && (
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input
                        Icon={LockKeyhole}
                        type="password"
                        placeholder="Re-enter your password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* VERIFICATION CODE */}
            {(option === "forgot" || option === "register") && (
              <FormField
                control={form.control}
                name="verificationCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verification Code</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <Input
                          Icon={Binary}
                          type="verificationCode"
                          placeholder="Check your email for the 6-digit code"
                          {...field}
                        />
                        <Button
                          className="font-semibold"
                          disabled={
                            registerMutation.isPending ||
                            loginMutation.isPending ||
                            sendCodeMutation.isPending ||
                            timer > 0
                          }
                          size="sm"
                          type="button"
                          onClick={handleSendCode}
                        >
                          {timer > 0 ? (
                            <div className="flex items-center gap-1">
                              <Loader2 className="animate-spin" size={12} />
                              {timer}s
                            </div>
                          ) : (
                            "Send Code"
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {/* BUTTON */}
            <div className="flex flex-col gap-1">
              {option === "login" && (
                <div className="flex w-full justify-end">
                  <Button
                    type="button"
                    className="cursor-pointer pr-2 text-sm transition-colors duration-75"
                    variant="link"
                    onClick={() => {
                      setOption("forgot");
                    }}
                  >
                    Forgot Password?
                  </Button>
                </div>
              )}
              <Button
                className="mt-1 w-full font-semibold"
                type="submit"
                disabled={
                  registerMutation.isPending ||
                  loginMutation.isPending ||
                  sendCodeMutation.isPending
                }
              >
                {option === "login"
                  ? "Login"
                  : option === "register"
                    ? "Register"
                    : "Reset Password"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default LoginDialog;
