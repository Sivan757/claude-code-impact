import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Cross2Icon, ChevronDownIcon, DownloadIcon } from "@radix-ui/react-icons";
import { domToCanvas } from "modern-screenshot";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import type { AnnualReport2025 as AnnualReportData } from "../../types";
import { useInvokeQuery } from "../../hooks";

interface AnnualReport2025Props {
  onClose: () => void;
}


function getHourLabel(hour: number, t: (key: string) => string): string {
  if (hour >= 0 && hour < 6) return t('report.hour_labels.late_night');
  if (hour >= 6 && hour < 12) return t('report.hour_labels.morning');
  if (hour >= 12 && hour < 18) return t('report.hour_labels.afternoon');
  if (hour >= 18 && hour < 21) return t('report.hour_labels.evening');
  return t('report.hour_labels.night');
}

// Screen Components
function TitleScreen() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="text-8xl font-serif font-bold bg-gradient-to-r from-primary via-amber-500 to-primary bg-clip-text text-transparent mb-4">
          2025
        </div>
      </motion.div>
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <h1 className="font-serif text-3xl font-semibold text-foreground mb-2">
          {t('report.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('report.description')}
        </p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-12 flex items-center gap-2 text-muted-foreground text-sm"
      >
        <span>{t('report.scroll_continue')}</span>
        <ChevronDownIcon className="w-4 h-4 animate-bounce" />
      </motion.div>
    </div>
  );
}

function OverviewScreen({ report }: { report: AnnualReportData }) {
  const { t } = useTranslation();
  const stats = [
    { label: t('report.conversations'), value: report.total_sessions, suffix: "" },
    { label: t('report.messages'), value: report.total_messages, suffix: "" },
    { label: t('report.active_days'), value: report.active_days, suffix: t('report.days_suffix') },
    { label: t('report.projects'), value: report.total_projects, suffix: "" },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-8">
      <motion.h2
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-serif text-2xl font-semibold text-foreground mb-8"
      >
        {t('report.overview_title')}
      </motion.h2>

      <div className="grid grid-cols-2 gap-6 max-w-md">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="bg-card/80 rounded-2xl p-6 text-center border border-border/40"
          >
            <div className="text-4xl font-bold text-primary font-serif mb-1">
              {stat.value.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {report.first_chat_date && report.last_chat_date && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 text-center text-muted-foreground text-sm"
        >
          <p>
            {t('report.from_to', { start: report.first_chat_date, end: report.last_chat_date })}
          </p>
        </motion.div>
      )}
    </div>
  );
}

function ActivityScreen({ report }: { report: AnnualReportData }) {
  const { t } = useTranslation();
  const peakHourLabel = getHourLabel(report.peak_hour, t);

  return (
    <div className="flex flex-col items-center justify-center h-full px-8">
      <motion.h2
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-serif text-2xl font-semibold text-foreground mb-8"
      >
        {t('report.peak_time_title')}
      </motion.h2>

      <div className="flex flex-col gap-6 max-w-md w-full">
        {/* Peak Hour */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-r from-primary/10 to-amber-500/10 rounded-2xl p-6 border border-primary/20"
        >
          <div className="text-sm text-muted-foreground mb-2">{t('report.peak_hour')}</div>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold text-primary font-serif">
              {report.peak_hour}:00
            </span>
            <span className="text-lg text-foreground">{peakHourLabel}</span>
          </div>
          <div className="text-sm text-muted-foreground mt-2">
            {t('report.sessions_count', { count: report.peak_hour_count })}
          </div>
        </motion.div>

        {/* Peak Weekday */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card/80 rounded-2xl p-6 border border-border/40"
        >
          <div className="text-sm text-muted-foreground mb-2">{t('report.most_active_day')}</div>
          <div className="text-3xl font-bold text-foreground font-serif">
            {t(`common.weekdays_short.${report.peak_weekday}`)}
          </div>
        </motion.div>

        {/* Longest Streak */}
        {report.longest_streak > 1 && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card/80 rounded-2xl p-6 border border-border/40"
          >
            <div className="text-sm text-muted-foreground mb-2">{t('report.longest_streak')}</div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-primary font-serif">
                {report.longest_streak}
              </span>
              <span className="text-lg text-foreground">{t('report.consecutive_days')}</span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function ProjectsScreen({ report }: { report: AnnualReportData }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center h-full px-8">
      <motion.h2
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-serif text-2xl font-semibold text-foreground mb-8"
      >
        {t('report.favorite_project_title')}
      </motion.h2>

      {report.favorite_project ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-primary/10 via-card to-amber-500/10 rounded-2xl p-8 border border-primary/20 max-w-md w-full"
        >
          <div className="text-sm text-muted-foreground mb-2">{t('report.most_used')}</div>
          <div className="font-serif text-xl font-semibold text-foreground mb-4">
            {getProjectName(report.favorite_project.path)}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-3xl font-bold text-primary font-serif">
                {report.favorite_project.session_count}
              </div>
              <div className="text-sm text-muted-foreground">{t('chat.session_count', { count: report.favorite_project.session_count })}</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary font-serif">
                {report.favorite_project.message_count.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">{t('chat.message_count', { count: report.favorite_project.message_count })}</div>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-muted-foreground text-center"
        >
          <p>{t('report.not_available')}</p>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-6 text-center"
      >
        <p className="text-muted-foreground text-sm">
          {t('report.projects_worked_on', { count: report.total_projects })}
        </p>
      </motion.div>
    </div>
  );
}

function CommandsScreen({ report }: { report: AnnualReportData }) {
  const { t } = useTranslation();
  const maxCount = report.top_commands[0]?.count || 1;

  return (
    <div className="flex flex-col items-center justify-center h-full px-8">
      <motion.h2
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-serif text-2xl font-semibold text-foreground mb-8"
      >
        {t('report.top_commands')}
      </motion.h2>

      {report.top_commands.length > 0 ? (
        <div className="max-w-md w-full space-y-3">
          {report.top_commands.map((cmd, i) => (
            <motion.div
              key={cmd.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="relative"
            >
              <div
                className="absolute inset-0 bg-primary/10 rounded-xl"
                style={{ width: `${(cmd.count / maxCount) * 100}%` }}
              />
              <div className="relative flex items-center justify-between p-4">
                <span className="font-mono text-sm text-foreground">{cmd.name}</span>
                <span className="text-sm text-muted-foreground">{cmd.count}x</span>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-muted-foreground text-center"
        >
          <p>{t('report.no_commands')}</p>
        </motion.div>
      )}
    </div>
  );
}

function SummaryScreen({
  report,
  onShare,
  sharing,
}: {
  report: AnnualReportData;
  onShare: () => void;
  sharing: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center h-full px-8">
      <motion.h2
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-serif text-2xl font-semibold text-foreground mb-8"
      >
        {t('report.summary_title')}
      </motion.h2>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-card/80 rounded-2xl p-8 border border-border/40 max-w-md w-full text-center"
      >
        <p className="text-lg text-foreground mb-6">
          {t('report.summary_text', {
            sessions: report.total_sessions,
            messages: report.total_messages.toLocaleString(),
            projects: report.total_projects
          })}
        </p>

        {report.longest_streak > 1 && (
          <p className="text-muted-foreground mb-6">
            {t('report.streak_summary', { count: report.longest_streak })}
          </p>
        )}

        <button
          onClick={onShare}
          disabled={sharing}
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <DownloadIcon className="w-4 h-4" />
          {sharing ? t('report.generating') : t('report.save_image')}
        </button>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 text-muted-foreground text-sm"
      >
        {t('report.cheers_2026')}
      </motion.p>
    </div>
  );
}

// Helper to convert string to Title Case
function toTitleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Helper to get short project name from path
// Handles: "/Users/mark/projects/claudecodeimpact" or "-Users-mark-projects-claudecodeimpact"
function getProjectName(path: string): string {
  let name: string;
  // Handle dash-separated format (like "-Users-mark-projects-claudecodeimpact")
  if (path.startsWith("-") || !path.includes("/")) {
    const parts = path.split("-").filter(Boolean);
    name = parts[parts.length - 1] || path;
  } else {
    // Handle normal path format
    const parts = path.split(/[/\\]/).filter(Boolean);
    name = parts[parts.length - 1] || path;
  }
  return toTitleCase(name);
}

// Helper to extract username from path
function getUserName(path: string, t: (key: string) => string): string {
  // Handle dash-separated format
  if (path.startsWith("-") || !path.includes("/")) {
    const parts = path.split("-").filter(Boolean);
    // Format: Users-mark-projects-xxx -> mark is at index 1
    if (parts[0]?.toLowerCase() === "users" && parts[1]) {
      return parts[1];
    }
  }
  // Handle normal path format: /Users/mark/... -> mark
  const parts = path.split(/[/\\]/).filter(Boolean);
  if (parts[0]?.toLowerCase() === "users" && parts[1]) {
    return parts[1];
  }
  return t('report.share.coder');
}

// Shareable Card Component (hidden, used for screenshot)
// Uses inline styles because Tailwind classes won't be captured by screenshot
// Design inspired by NetEase Cloud Music annual report - premium festival style
function ShareableCard({ report }: { report: AnnualReportData }) {
  const { t } = useTranslation();
  const peakHourLabel = getHourLabel(report.peak_hour, t);
  const projectName = report.favorite_project ? getProjectName(report.favorite_project.path) : "";
  const userName = report.favorite_project ? getUserName(report.favorite_project.path, t) : t('report.share.coder');

  return (
    <div
      style={{
        width: 420,
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        position: "relative",
        overflow: "hidden",
        background: "#C54B24",
      }}
    >
      {/* Phoenix Hero Background with title overlay */}
      <div
        style={{
          width: "100%",
          height: 300,
          backgroundImage: "url(/annual-report-phoenix.png)",
          backgroundSize: "cover",
          backgroundPosition: "center top",
          position: "relative",
        }}
      >
        {/* Gradient overlay at bottom for text readability */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 120,
            background: "linear-gradient(to top, rgba(197,75,36,0.95) 0%, rgba(197,75,36,0.7) 50%, transparent 100%)",
          }}
        />
        {/* Title at bottom of hero - above the content card */}
        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: 0,
            right: 0,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#FFFFFF",
              textShadow: "0 2px 8px rgba(0,0,0,0.4)",
              letterSpacing: "0.5px",
              marginBottom: 6,
            }}
          >
            {t('report.share.title')}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.85)",
              fontWeight: 500,
            }}
          >
            @{userName}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        style={{
          background: "linear-gradient(180deg, #C54B24 0%, #B8421F 100%)",
          padding: "20px 20px 24px",
          position: "relative",
        }}
      >
        {/* Main Stats Card - Warm pink/cream gradient */}
        <div
          style={{
            background: "linear-gradient(160deg, #FFF8F5 0%, #FFE8DC 40%, #FFD4C4 100%)",
            borderRadius: 20,
            padding: 20,
            marginBottom: 20,
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          }}
        >
          {/* Stats Period Badge */}
          <div
            style={{
              textAlign: "center",
              marginBottom: 12,
              paddingBottom: 12,
              borderBottom: "1px solid rgba(216,90,42,0.1)",
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: "#AA7A6A",
                background: "rgba(216,90,42,0.08)",
                padding: "4px 12px",
                borderRadius: 10,
                fontWeight: 500,
              }}
            >
              {t('report.share.stat_period')}：{report.first_chat_date || "2025.01"} - {report.last_chat_date || "2025.12"}
            </span>
          </div>

          {/* 3-column Core Stats Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
            }}
          >
            {/* Conversations */}
            <div style={{ textAlign: "center", padding: 10 }}>
              <div style={{ fontSize: 10, color: "#996B5B", marginBottom: 4, fontWeight: 600 }}>{t('report.share.conversations')}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#D85A2A", lineHeight: 1 }}>
                {report.total_sessions.toLocaleString()}
              </div>
              <div style={{ fontSize: 10, color: "#AA7A6A", marginTop: 2 }}>{t('report.share.unit_times')}</div>
            </div>

            {/* Messages */}
            <div style={{ textAlign: "center", padding: 10 }}>
              <div style={{ fontSize: 10, color: "#996B5B", marginBottom: 4, fontWeight: 600 }}>{t('report.share.messages')}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#E8734A", lineHeight: 1 }}>
                {report.total_messages.toLocaleString()}
              </div>
              <div style={{ fontSize: 10, color: "#AA7A6A", marginTop: 2 }}>{t('report.share.unit_items')}</div>
            </div>

            {/* Commands */}
            <div style={{ textAlign: "center", padding: 10 }}>
              <div style={{ fontSize: 10, color: "#996B5B", marginBottom: 4, fontWeight: 600 }}>{t('report.share.commands')}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#D85A2A", lineHeight: 1 }}>
                {report.total_commands.toLocaleString()}
              </div>
              <div style={{ fontSize: 10, color: "#AA7A6A", marginTop: 2 }}>{t('report.share.unit_count')}</div>
            </div>

            {/* Active Days */}
            <div style={{ textAlign: "center", padding: 10 }}>
              <div style={{ fontSize: 10, color: "#996B5B", marginBottom: 4, fontWeight: 600 }}>{t('report.share.active')}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#E8734A", lineHeight: 1 }}>
                {report.active_days}
              </div>
              <div style={{ fontSize: 10, color: "#AA7A6A", marginTop: 2 }}>{t('report.share.unit_days')}</div>
            </div>

            {/* Projects */}
            <div style={{ textAlign: "center", padding: 10 }}>
              <div style={{ fontSize: 10, color: "#996B5B", marginBottom: 4, fontWeight: 600 }}>{t('report.share.projects')}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#D85A2A", lineHeight: 1 }}>
                {report.total_projects}
              </div>
              <div style={{ fontSize: 10, color: "#AA7A6A", marginTop: 2 }}>{t('report.share.unit_count')}</div>
            </div>

            {/* Longest Streak */}
            <div style={{ textAlign: "center", padding: 10 }}>
              <div style={{ fontSize: 10, color: "#996B5B", marginBottom: 4, fontWeight: 600 }}>{t('report.share.streak')}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#E8734A", lineHeight: 1 }}>
                {report.longest_streak}
              </div>
              <div style={{ fontSize: 10, color: "#AA7A6A", marginTop: 2 }}>{t('report.share.unit_days')}</div>
            </div>
          </div>

          {/* Favorite Project */}
          {report.favorite_project && (
            <div
              style={{
                marginTop: 16,
                padding: 14,
                background: "rgba(216,90,42,0.08)",
                borderRadius: 14,
                borderLeft: "4px solid #D85A2A",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    background: "linear-gradient(135deg, #D85A2A 0%, #E8734A 100%)",
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    flexShrink: 0,
                  }}
                >
                  🏆
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: "#996B5B", marginBottom: 2, fontWeight: 600 }}>{t('report.share.favorite_project')}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#4A3530" }}>
                    {projectName}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Section - Unified card with stats + commands */}
        <div
          style={{
            background: "rgba(0,0,0,0.15)",
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
          }}
        >
          {/* Secondary Stats Row - Peak Time Info */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              paddingBottom: 14,
              borderBottom: "1px solid rgba(255,255,255,0.1)",
              marginBottom: 14,
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 2 }}>{t('report.share.peak_period')}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#FFFFFF", lineHeight: 1 }}>{report.peak_hour}:00</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{peakHourLabel}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 2 }}>{t('report.share.peak_day')}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#FFFFFF", lineHeight: 1 }}>{t(`common.weekdays_short.${report.peak_weekday}`)}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{t('report.share.most_coded')}</div>
            </div>
          </div>

          {/* Top Commands */}
          {report.top_commands.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 8, fontWeight: 500 }}>
                🔥 {t('report.share.top_commands')}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {report.top_commands.slice(0, 4).map((cmd, i) => (
                  <div
                    key={cmd.name}
                    style={{
                      background: i === 0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)",
                      borderRadius: 6,
                      padding: "4px 10px",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#FFFFFF",
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
                      }}
                    >
                      {cmd.name}
                    </span>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>×{cmd.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer - with QR code */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <img
              src="/logo.png"
              alt="Claude Code Impact"
              style={{ width: 20, height: 20, borderRadius: 4 }}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF" }}>Claude Code Impact</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{t('report.share.tagline')}</div>
            </div>
          </div>
          <img
            src="/claudecodeimpact-qrcode.png"
            alt="QR Code"
            style={{ width: 48, height: 48, borderRadius: 4, background: "#FFFFFF", padding: 2 }}
          />
        </div>
      </div>
    </div>
  );
}

// Main Component
export function AnnualReport2025({ onClose }: AnnualReport2025Props) {
  const { t } = useTranslation();
  const [currentScreen, setCurrentScreen] = useState(0);
  const [sharing, setSharing] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);

  const { data: report, isLoading } = useInvokeQuery<AnnualReportData>(
    ["annualReport2025"],
    "get_annual_report_2025"
  );

  const screens = [
    { id: "title", component: TitleScreen },
    { id: "overview", component: OverviewScreen },
    { id: "activity", component: ActivityScreen },
    { id: "projects", component: ProjectsScreen },
    { id: "commands", component: CommandsScreen },
    { id: "summary", component: SummaryScreen },
  ];

  const goNext = useCallback(() => {
    setCurrentScreen((prev) => Math.min(prev + 1, screens.length - 1));
  }, [screens.length]);

  const goPrev = useCallback(() => {
    setCurrentScreen((prev) => Math.max(prev - 1, 0));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev, onClose]);

  // Wheel navigation (debounced)
  const lastWheelTime = useRef(0);
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      const now = Date.now();
      if (now - lastWheelTime.current < 500) return;
      lastWheelTime.current = now;

      if (e.deltaY > 0) {
        goNext();
      } else if (e.deltaY < 0) {
        goPrev();
      }
    },
    [goNext, goPrev]
  );

  // Share functionality - uses domToCanvas with Portal (no UI flicker)
  // Uses Tauri save dialog for proper file saving without Finder popup
  const handleShare = useCallback(async () => {
    const captureEl = shareCardRef.current;
    if (!captureEl || !report) return;
    setSharing(true);

    try {
      // Get original dimensions (unaffected by any transform)
      const originalWidth = captureEl.scrollWidth;
      const originalHeight = captureEl.scrollHeight;

      // domToCanvas clones DOM in memory - no UI impact
      const canvas = await domToCanvas(captureEl, {
        scale: 2,
        backgroundColor: "#C54B24",
        width: originalWidth,
        height: originalHeight,
        style: {
          // Remove any hiding transforms on the cloned element
          transform: "none",
          visibility: "visible",
          opacity: "1",
        },
      });

      // Convert canvas to blob
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/png");
      });

      if (!blob) {
        throw new Error("Failed to create blob");
      }

      // Use Tauri save dialog
      const path = await save({
        defaultPath: "claudecodeimpact-2025-report.png",
        filters: [{ name: t('report.share.png_image'), extensions: ["png"] }],
      });

      if (path) {
        // Convert blob to Uint8Array
        const arrayBuffer = await blob.arrayBuffer();
        const data = Array.from(new Uint8Array(arrayBuffer));

        // Write file using Tauri command
        await invoke("export_binary_file", { path, data });

        // Reveal in Finder
        await revealItemInDir(path);
      }
    } catch (err) {
      console.error("Failed to generate image:", err);
    } finally {
      setSharing(false);
    }
  }, [report]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="text-center">
          <div className="text-4xl font-serif font-bold text-primary mb-4">2025</div>
          <p className="text-muted-foreground">{t('common.loading')}...</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">{t('report.not_available')}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            {t('common.go_back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-gradient-to-br from-background via-background to-primary/5 z-50 overflow-hidden"
        onWheel={handleWheel}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-card/80 border border-border/40 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Cross2Icon className="w-5 h-5" />
        </button>

        {/* Screen content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentScreen}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            {currentScreen === 0 && <TitleScreen />}
            {currentScreen === 1 && <OverviewScreen report={report} />}
            {currentScreen === 2 && <ActivityScreen report={report} />}
            {currentScreen === 3 && <ProjectsScreen report={report} />}
            {currentScreen === 4 && <CommandsScreen report={report} />}
            {currentScreen === 5 && (
              <SummaryScreen report={report} onShare={handleShare} sharing={sharing} />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation dots */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {screens.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentScreen(i)}
              className={`w-2 h-2 rounded-full transition-all ${i === currentScreen
                ? "bg-primary w-6"
                : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
            />
          ))}
        </div>

      </div>

      {/* Portal: ShareableCard rendered to body, hidden with transform */}
      {createPortal(
        <div
          ref={shareCardRef}
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            transform: "scale(0)",
            transformOrigin: "top left",
            pointerEvents: "none",
            zIndex: -1,
          }}
        >
          <ShareableCard report={report} />
        </div>,
        document.body
      )}
    </>
  );
}
