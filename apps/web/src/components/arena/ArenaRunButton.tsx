"use client";

type ArenaRunButtonProps = {
  disabled: boolean;
  onRun: () => void;
};

export function ArenaRunButton({ disabled, onRun }: ArenaRunButtonProps) {
  return (
    <button
      className="primary-action arena-run-button"
      disabled={disabled}
      onClick={onRun}
      type="button"
    >
      Run Arena
    </button>
  );
}
