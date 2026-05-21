import type { HarnessId, HarnessTemplate } from "@nexora/shared";

type HarnessTemplateCardProps = {
  harness: HarnessTemplate;
  isSelected: boolean;
  onSelect: (harnessId: HarnessId) => void;
};

export function HarnessTemplateCard({
  harness,
  isSelected,
  onSelect,
}: HarnessTemplateCardProps) {
  return (
    <button
      aria-pressed={isSelected}
      className={isSelected ? "harness-card harness-card-selected" : "harness-card"}
      onClick={() => onSelect(harness.id)}
      type="button"
    >
      <span>{harness.name}</span>
    </button>
  );
}
