import { atomWithStorage as baseAtomWithStorage, createJSONStorage } from "jotai/utils";
import { getSerializedUiPreference, removeUiPreference, setSerializedUiPreference } from "@/lib/uiPreferences";

const uiPreferenceStorage = {
  getItem: (key: string) => getSerializedUiPreference(key),
  setItem: (key: string, value: string) => setSerializedUiPreference(key, value),
  removeItem: (key: string) => removeUiPreference(key),
};

export const atomWithStorage = <T>(key: string, initialValue: T) =>
  baseAtomWithStorage<T>(key, initialValue, createJSONStorage<T>(() => uiPreferenceStorage), { getOnInit: true });
