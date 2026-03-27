import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
  useMarkClientComplete,
  getListClientsQueryKey,
  getGetStatsQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

function apiMessage(err: any, fallback: string): string {
  return (err?.data as any)?.error || err?.message || fallback;
}

export function useClientMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
  };

  const create = useCreateClient({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: "Success", description: "Client deadline added successfully." });
      },
      onError: (err: any) => {
        toast({ title: "Error", description: apiMessage(err, "Failed to create client."), variant: "destructive" });
      }
    },
  });

  const update = useUpdateClient({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: "Success", description: "Client updated successfully." });
      },
      onError: (err: any) => {
        toast({ title: "Error", description: apiMessage(err, "Failed to update client."), variant: "destructive" });
      }
    },
  });

  const remove = useDeleteClient({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: "Deleted", description: "Client deadline removed." });
      },
      onError: (err: any) => {
        toast({ title: "Error", description: apiMessage(err, "Failed to delete client."), variant: "destructive" });
      }
    },
  });

  const markComplete = useMarkClientComplete({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: "Completed", description: "Deadline marked as completed." });
      },
      onError: (err: any) => {
        toast({ title: "Error", description: apiMessage(err, "Failed to update status."), variant: "destructive" });
      }
    },
  });

  const revertPending = (id: string) => {
    update.mutate(
      { id, data: { status: "pending" } },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "Reverted", description: "Deadline moved back to pending." });
        },
        onError: (err: any) => {
          toast({ title: "Error", description: apiMessage(err, "Failed to revert."), variant: "destructive" });
        },
      }
    );
  };

  return { create, update, remove, markComplete, revertPending };
}
