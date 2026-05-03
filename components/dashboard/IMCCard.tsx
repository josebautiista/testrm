import { BMIIndicator } from "@/components/ui/BMIIndicator";
import { HealthClassification } from "@/helpers/calculations";

type IMCCardProps = {
  imc: number;
  classification: HealthClassification;
};

export function IMCCard({ imc, classification }: IMCCardProps) {
  void classification;
  return <BMIIndicator bmi={imc} />;
}
