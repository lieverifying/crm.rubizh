import { createContext, useContext } from "react";
import type { Staff } from "./api";
export const Workspace = createContext<{
  user: Staff;
  notify: (s: string) => void;
}>({ user: {} as Staff, notify: () => {} });
export const useWorkspace = () => useContext(Workspace);
export const useCan = (permission: string) => {
  const { user } = useWorkspace();
  return user.permissions.includes(permission);
};
