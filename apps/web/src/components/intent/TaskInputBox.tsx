"use client";

type TaskInputBoxProps = {
  task: string;
  tokenAddress: string;
  onTaskChange: (task: string) => void;
  onTokenAddressChange: (tokenAddress: string) => void;
};

export function TaskInputBox({
  task,
  tokenAddress,
  onTaskChange,
  onTokenAddressChange,
}: TaskInputBoxProps) {
  return (
    <div className="intent-input-grid">
      <label>
        <span>Task</span>
        <textarea
          aria-label="Task"
          onChange={(event) => onTaskChange(event.target.value)}
          rows={3}
          value={task}
        />
      </label>
      <label>
        <span>Token Address</span>
        <input
          aria-label="Token Address"
          onChange={(event) => onTokenAddressChange(event.target.value)}
          type="text"
          value={tokenAddress}
        />
      </label>
    </div>
  );
}
