import { useNavigate } from "react-router-dom";
import { Home } from "../views/Home";
import { featureToPath } from "@/navigation/featureRoutes";

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <Home
      onFeatureClick={(feature) => {
        const path = featureToPath(feature);
        if (path) navigate(path);
      }}
      onProjectClick={(p) => navigate(`/chat/${encodeURIComponent(p.id)}`)}
      onSessionClick={(s) => navigate(`/chat/${encodeURIComponent(s.project_id)}/${encodeURIComponent(s.id)}`)}
      onSearch={() => navigate("/chat")}
    />
  );
}
