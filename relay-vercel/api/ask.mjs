import { createRelay } from "../lib/relay.mjs";

const relay = createRelay();

export function OPTIONS(request) {
  return relay(request);
}

export function POST(request) {
  return relay(request);
}
