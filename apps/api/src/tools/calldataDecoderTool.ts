export function calldataDecoderTool(calldata: `0x${string}`) {
  return {
    calldata,
    supported: calldata.startsWith("0xa9059cbb") || calldata.startsWith("0x095ea7b3"),
  };
}
