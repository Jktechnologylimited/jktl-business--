/** Deliberate product pause. Re-enable only after call/booking launch validation. */
export const RECEPTIONIST_PAUSED = true;
export const RECEPTIONIST_PAUSE_MESSAGE =
  "AI receptionist call handling and automated bookings are temporarily unavailable while we prepare the service. Your existing records are preserved.";
export function requireReceptionistAvailable() {
  if (RECEPTIONIST_PAUSED) throw new Error(RECEPTIONIST_PAUSE_MESSAGE);
}
