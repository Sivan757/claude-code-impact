import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type {
  ConfigTemplate,
  TemplateListEntry,
  MergeMode,
} from "./types";
import type { WriteResult } from "../types";

/** List all templates (built-in + custom) */
export function useTemplateList() {
  return useQuery<TemplateListEntry[], string>({
    queryKey: ["templates"],
    queryFn: () => invoke<TemplateListEntry[]>("template_list"),
  });
}

/** Get a full template by ID */
export function useTemplateGet(id: string | null) {
  return useQuery<ConfigTemplate, string>({
    queryKey: ["templates", id],
    queryFn: () => invoke<ConfigTemplate>("template_get", { id }),
    enabled: !!id,
  });
}

/** Save a template */
export function useTemplateSave() {
  const queryClient = useQueryClient();

  return useMutation<void, string, ConfigTemplate>({
    mutationFn: (template) =>
      invoke<void>("template_save", { template }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });
}

/** Delete a template */
export function useTemplateDelete() {
  const queryClient = useQueryClient();

  return useMutation<void, string, string>({
    mutationFn: (id) => invoke<void>("template_delete", { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });
}

/** Apply a template to a project */
export function useTemplateApply() {
  const queryClient = useQueryClient();

  return useMutation<
    WriteResult,
    string,
    { id: string; projectPath?: string; mergeMode: MergeMode }
  >({
    mutationFn: ({ id, projectPath, mergeMode }) =>
      invoke<WriteResult>("template_apply", {
        id,
        projectPath,
        mergeMode,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config"] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}

/** Save current project config as a template */
export function useTemplateSaveFromProject() {
  const queryClient = useQueryClient();

  return useMutation<
    ConfigTemplate,
    string,
    {
      name: string;
      description: string;
      tags: string[];
      projectPath?: string;
    }
  >({
    mutationFn: ({ name, description, tags, projectPath }) =>
      invoke<ConfigTemplate>("template_save_from_project", {
        name,
        description,
        tags,
        projectPath,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });
}
