import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

const DEFAULT_REVEAL_LABEL = "Reveal in Finder";

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
