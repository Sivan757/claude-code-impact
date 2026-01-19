import { useTranslation } from "react-i18next";
import { FileIcon, ChatBubbleIcon } from "@radix-ui/react-icons";
import { Switch } from "../../components/ui/switch";
import { useAtom } from "jotai";
import { chatViewModeAtom, allProjectsSortByAtom, hideEmptySessionsAllAtom } from "../../store";
import { useAppConfig } from "../../context";
import { useInvokeQuery } from "../../hooks";
import { formatRelativeTime, useReadableText } from "./utils";
import type { Project, Session } from "../../types";

interface ProjectListProps {
  onSelectProject: (p: Project) => void;
  onSelectSession: (s: Session) => void;
}

export function ProjectList({ onSelectProject, onSelectSession }: ProjectListProps) {
  const { t } = useTranslation();
  const { formatPath } = useAppConfig();
  const [viewMode, setViewMode] = useAtom(chatViewModeAtom);
  const toReadable = useReadableText();

  // Use react-query for cached data fetching
  const { data: projects, isLoading: loadingProjects } = useInvokeQuery<Project[]>(["projects"], "list_projects");
  const { data: allSessions, isLoading: loadingSessions } = useInvokeQuery<Session[]>(["sessions"], "list_all_sessions");

  const [sortBy, setSortBy] = useAtom(allProjectsSortByAtom);
  const [hideEmptySessions, setHideEmptySessions] = useAtom(hideEmptySessionsAllAtom);

  const loading =
    viewMode === "projects" ? loadingProjects : loadingSessions;

  const sortedProjects = [...(projects || [])].sort((a, b) => {
    switch (sortBy) {
      case "recent":
        return b.last_active - a.last_active;
      case "sessions":
        return b.session_count - a.session_count;
      case "name":
        return a.path.localeCompare(b.path);
      default:
        return 0;
    }
  });

  const filteredSessions = hideEmptySessions
    ? (allSessions || []).filter((s) => s.message_count > 0)
    : allSessions || [];

  const sortedSessions = [...filteredSessions].sort((a, b) => {
    switch (sortBy) {
      case "recent":
        return b.last_modified - a.last_modified;
      case "sessions":
        return b.message_count - a.message_count;
      case "name":
        return (a.summary || "").localeCompare(b.summary || "");
      default:
        return 0;
    }
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">{t('chat.loading', { viewMode: t(`chat.${viewMode}`) })}</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <header className="mb-6">
        <h1 className="font-serif text-3xl font-semibold text-ink">{t('chat.title')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('chat.stats', {
            projects: (projects || []).length,
            sessions: (allSessions || []).length,
          })}
        </p>
      </header>

      <div className="flex border-b border-border mb-4">
        <button
          onClick={() => setViewMode("projects")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${viewMode === "projects"
            ? "text-primary border-b-2 border-primary -mb-px"
            : "text-muted-foreground hover:text-ink"
            }`}
        >
          <FileIcon className="w-4 h-4 inline mr-1.5" />
          {t('chat.projects')}
        </button>
        <button
          onClick={() => setViewMode("sessions")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${viewMode === "sessions"
            ? "text-primary border-b-2 border-primary -mb-px"
            : "text-muted-foreground hover:text-ink"
            }`}
        >
          <ChatBubbleIcon className="w-4 h-4 inline mr-1.5" />
          {t('chat.sessions')}
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 mb-6">
        <div className="flex gap-2">
          {(
            [
              ["recent", t('chat.recent')],
              ["sessions", viewMode === "projects" ? t('chat.sessions') : t('chat.messages')],
              ["name", t('chat.name')],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${sortBy === key
                ? "bg-primary text-primary-foreground"
                : "bg-card-alt text-muted-foreground hover:text-ink"
                }`}
            >
              {label}
            </button>
          ))}
        </div>
        {viewMode === "sessions" && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Switch checked={hideEmptySessions} onCheckedChange={setHideEmptySessions} />
            <span>{t('chat.hide_empty')}</span>
          </label>
        )}
      </div>

      {viewMode === "projects" ? (
        <div className="space-y-3">
          {sortedProjects.map((project) => (
            <button
              key={project.id}
              onClick={() => onSelectProject(project)}
              className="w-full text-left bg-card rounded-xl p-4 border border-border hover:border-primary transition-colors"
            >
              <p className="font-medium text-ink truncate">{formatPath(project.path)}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('chat.session_count', { count: project.session_count })} ·{" "}
                {formatRelativeTime(project.last_active)}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {sortedSessions.map((session) => (
            <button
              key={`${session.project_id}-${session.id}`}
              onClick={() => onSelectSession(session)}
              className="w-full text-left bg-card rounded-xl p-4 border border-border hover:border-primary transition-colors"
            >
              <p className="font-medium text-ink line-clamp-2">{toReadable(session.summary) || t('chat.untitled_session')}</p>
              <p className="text-sm text-muted-foreground mt-1 truncate">
                {session.project_path ? formatPath(session.project_path) : session.project_id}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('chat.message_count', { count: session.message_count })} · {formatRelativeTime(session.last_modified)}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
