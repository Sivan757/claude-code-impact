import { McpView } from "../../views/Mcp";
import { FeaturesLayout } from "../../views/Features";

export default function McpPage() {
  return (
    <FeaturesLayout feature="mcp">
      <McpView />
    </FeaturesLayout>
  );
}
