import { LspView } from "../../views/Lsp/LspView";
import { FeaturesLayout } from "../../views/Features";

export default function LspPage() {
  return (
    <FeaturesLayout feature="lsp">
      <LspView />
    </FeaturesLayout>
  );
}
