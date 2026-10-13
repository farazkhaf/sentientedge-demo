import { IntelligenceWorkspace } from "@/components/intelligence/intelligence-workspace";
import { DatasetProvider } from "@/components/intelligence/dataset-provider";

export default function Page() {
  return <DatasetProvider><IntelligenceWorkspace /></DatasetProvider>;
}
