import { ProjectHubView } from "../../views/Projects/ProjectHubView";
import { FeaturesLayout } from "../../views/Features";

export default function ProjectsPage() {
  return (
    <FeaturesLayout feature="projects" showTopNavigation={false}>
      <ProjectHubView />
    </FeaturesLayout>
  );
}
