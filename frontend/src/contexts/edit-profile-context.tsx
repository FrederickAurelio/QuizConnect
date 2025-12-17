import { createContext, useContext, useState, type ReactNode } from "react";

type EditProfileContextType = {
  isEditProfileDialogOpen: boolean;
  openProfileEdit: () => void;
  closeProfileEdit: () => void;
};

const EditProfileContext = createContext<EditProfileContextType | null>(null);

function EditProfileProvider({ children }: { children: ReactNode }) {
  const [isEditProfileDialogOpen, setIsEditProfileDialogOpen] = useState(false);
  const openProfileEdit = () => setIsEditProfileDialogOpen(true);
  const closeProfileEdit = () => setIsEditProfileDialogOpen(false);

  return (
    <EditProfileContext
      value={{
        isEditProfileDialogOpen,
        openProfileEdit,
        closeProfileEdit,
      }}
    >
      {children}
    </EditProfileContext>
  );
}

function useEditProfile() {
  const ctx = useContext(EditProfileContext);
  if (!ctx) {
    throw new Error("useEditProfile must be used within EditProfileProvider");
  }
  return ctx;
}
export default EditProfileProvider;
export { useEditProfile };
