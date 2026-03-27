import { useQuery, useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

/**
 * Hook for cached Tauri invoke calls using react-query
 * Data persists across tab switches, invalidated on app restart
 */
export function useInvokeQuery<
  TData,
  TArgs extends Record<string, unknown> = Record<string, unknown>,
>(
  queryKey: QueryKey,
  command: string,
  args?: TArgs,
) {
  return useQuery<TData>({
    queryKey,
    queryFn: () => invoke<TData>(command, args),
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook for Tauri invoke mutations with automatic cache invalidation
 */
export function useInvokeMutation<TData, TVariables = void>(
  command: string,
  invalidateKeys?: QueryKey[],
) {
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVariables>({
    mutationFn: (variables) => invoke<TData>(command, variables as Record<string, unknown>),
    onSuccess: () => {
      invalidateKeys?.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
  });
}

/**
 * Re-export useQueryClient for manual invalidation
 */
export { useQueryClient };
