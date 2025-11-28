import { useLogin } from "@/contexts/login-context";
import Header from "@/pages/home/components/header";
import LoginDialog from "@/pages/home/components/login-dialog";
import { Outlet } from "react-router";

function Layout() {
  const { isLoginDialogOpen, closeLogin } = useLogin();
  return (
    <div className="flex flex-col h-dvh overflow-hidden">
      <Header />
      <div className="w-full flex-1 min-h-0 flex flex-col items-center ">
        <div className="w-full flex-1 min-h-0 max-w-[1200px]">
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
