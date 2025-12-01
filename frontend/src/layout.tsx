import { useLogin } from "@/contexts/login-context";
import Header from "@/pages/home/components/header";
import LoginDialog from "@/pages/home/components/login-dialog";
import { Outlet } from "react-router";

function Layout() {
  const { isLoginDialogOpen, closeLogin } = useLogin();
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Header />
      <div className="flex min-h-0 w-full flex-1 flex-col items-center">
        <div className="min-h-0 w-full max-w-[1200px] flex-1">
          <Outlet />
        </div>
      </div>
      <LoginDialog
        open={isLoginDialogOpen}
        onOpenChange={(o) => {
          if (!o) closeLogin();
        }}
      />
    </div>
  );
}

export default Layout;
