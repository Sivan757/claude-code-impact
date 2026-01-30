import { Navigate } from "react-router-dom";
import { featureToPath } from "@/navigation/featureRoutes";

export default function ContextFilesPage() {
  return <Navigate to={featureToPath("context")} replace />;
}
