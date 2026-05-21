type ObjectiveRunButtonProps = {
  disabled: boolean;
  isRunning: boolean;
  onRun: () => void;
};

export function ObjectiveRunButton({
  disabled,
  isRunning,
  onRun,
}: ObjectiveRunButtonProps) {
  return (
    <button
      className="primary-action form-submit"
      disabled={disabled || isRunning}
      onClick={onRun}
      type="button"
    >
      {isRunning ? "Running..." : "Run Objective"}
    </button>
  );
}
