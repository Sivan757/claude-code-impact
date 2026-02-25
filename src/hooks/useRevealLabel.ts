import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import i18n from "@/i18n";

const DEFAULT_REVEAL_LABEL = i18n.t("template_detail.reveal_finder");

export function useRevealLabel() {
  const [label, setLabel] = useState(DEFAULT_REVEAL_LABEL);

  useEffect(() => {
    let mounted = true;
    invoke<string>("get_reveal_label")
      .then((value) => {
        if (!mounted || !value) return;
        setLabel(value);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  return label;
}
