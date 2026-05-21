"use client";

type AgentProfileStepProps = {
  description: string;
  name: string;
  onDescriptionChange: (description: string) => void;
  onNameChange: (name: string) => void;
};

export function AgentProfileStep({
  description,
  name,
  onDescriptionChange,
  onNameChange,
}: AgentProfileStepProps) {
  return (
    <div className="form-grid">
      <label>
        <span>Smart Wallet Name</span>
        <input
          aria-label="Smart Wallet Name"
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="YieldGuard-01"
          type="text"
          value={name}
        />
      </label>

      <label>
        <span>Description</span>
        <textarea
          aria-label="Description"
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="Treasury risk monitor"
          rows={4}
          value={description}
        />
      </label>
    </div>
  );
}
