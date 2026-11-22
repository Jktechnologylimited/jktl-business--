"use client";
import { WorkspaceUnavailable } from "@/components/admin/workspace-unavailable";

export default function WorkspaceError({ retry }: { error: unknown; retry: () => void }) {
  return <WorkspaceUnavailable title="This workspace could not be loaded"
    detail="Try loading it again, or use the navigation to open another workspace. If the problem continues, ask the Owner to check the service configuration."
    retry={retry} />;
}
