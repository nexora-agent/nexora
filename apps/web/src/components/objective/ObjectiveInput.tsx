"use client";

type ObjectiveInputProps = {
  objective: string;
  onObjectiveChange: (objective: string) => void;
};

export function ObjectiveInput({
  objective,
  onObjectiveChange,
}: ObjectiveInputProps) {
  return (
    <label className="objective-input">
      <span>Objective</span>
      <textarea
        aria-label="Objective"
        onChange={(event) => onObjectiveChange(event.target.value)}
        rows={4}
        value={objective}
      />
    </label>
  );
}
