import { atomWithStorage } from "jotai/utils";

// Router test status
export const routerTestStatusAtom = atomWithStorage<Record<string, "idle" | "loading" | "success" | "error">>(
  "claudecodeimpact:settings:routerTestStatus",
  {}
);

export const routerTestMessageAtom = atomWithStorage<Record<string, string>>(
  "claudecodeimpact:settings:routerTestMessage",
  {}
);
