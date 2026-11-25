import { createContext, useContext } from "react";
import type { Business } from "@/modules/businesses";

export interface WorkspaceDetailContextValue {
  inspectedBusiness: Business | null;
  openBusinessDetail: (business: Business) => void;
  closeBusinessDetail: () => void;
}

const WorkspaceDetailContext = createContext<WorkspaceDetailContextValue | null>(null);

export const WorkspaceDetailProvider = WorkspaceDetailContext.Provider;

/** Returns the workspace-scoped controller for the shared BusinessDetailDialog. */
export function useWorkspaceDetail(): WorkspaceDetailContextValue {
  const value = useContext(WorkspaceDetailContext);
  if (!value) {
    throw new Error("useWorkspaceDetail must be used within WorkspaceLayout");
  }
  return value;
}

/** Returns the workspace-scoped controller when inside WorkspaceLayout, or null in business/operator shells. */
export function useOptionalWorkspaceDetail(): WorkspaceDetailContextValue | null {
  return useContext(WorkspaceDetailContext);
}
