import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PersonIcon } from "@radix-ui/react-icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEFAULT_TERMINAL_PREFERENCE, normalizeTerminalPreference } from "@/lib/terminalPreference";
import type { UserProfile } from "@/types";

interface ProfileDialogProps {
  open: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSave: (profile: UserProfile) => void;
}

export function ProfileDialog({ open, onClose, profile, onSave }: ProfileDialogProps) {
  const { t } = useTranslation();
  const [nickname, setNickname] = useState(profile.nickname);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl || "");
  const [terminalMode, setTerminalMode] = useState<"system" | "custom">(
    normalizeTerminalPreference(profile.terminalPreference).mode,
  );
  const [terminalCustomPath, setTerminalCustomPath] = useState(
    normalizeTerminalPreference(profile.terminalPreference).customPath,
  );

  useEffect(() => {
    const normalizedTerminalPreference = normalizeTerminalPreference(profile.terminalPreference);
    setNickname(profile.nickname);
    setAvatarUrl(profile.avatarUrl || "");
    setTerminalMode(normalizedTerminalPreference.mode);
    setTerminalCustomPath(normalizedTerminalPreference.customPath);
  }, [profile]);

  const handleSave = () => {
    const trimmedPath = terminalCustomPath.trim();
    const terminalPreference = terminalMode === "custom"
      ? { mode: "custom" as const, customPath: trimmedPath }
      : DEFAULT_TERMINAL_PREFERENCE;

    onSave({
      nickname,
      avatarUrl: avatarUrl || "",
      terminalPreference,
    });
    onClose();
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("profile_dialog.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              {avatarUrl ? <AvatarImage src={avatarUrl} /> : null}
              <AvatarFallback className="bg-primary/10 text-primary text-xl">
                {nickname ? nickname[0].toUpperCase() : <PersonIcon className="w-8 h-8" />}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <Label htmlFor="nickname">{t("profile_dialog.name_label")}</Label>
              <Input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder={t("profile_dialog.name_placeholder")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="terminal-mode">{t("profile_dialog.terminal_mode_label")}</Label>
            <Select
              value={terminalMode}
              onValueChange={(value: "system" | "custom") => setTerminalMode(value)}
            >
              <SelectTrigger id="terminal-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">{t("profile_dialog.terminal_mode_system")}</SelectItem>
                <SelectItem value="custom">{t("profile_dialog.terminal_mode_custom")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("profile_dialog.terminal_mode_desc")}</p>
          </div>
          {terminalMode === "custom" && (
            <div className="space-y-2">
              <Label htmlFor="terminal-path">{t("profile_dialog.terminal_path_label")}</Label>
              <Input
                id="terminal-path"
                value={terminalCustomPath}
                onChange={(e) => setTerminalCustomPath(e.target.value)}
                placeholder={t("profile_dialog.terminal_path_placeholder")}
              />
              <p className="text-xs text-muted-foreground">{t("profile_dialog.terminal_path_desc")}</p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>{t("profile_dialog.cancel")}</Button>
          <Button onClick={handleSave} disabled={terminalMode === "custom" && terminalCustomPath.trim().length === 0}>
            {t("profile_dialog.save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
