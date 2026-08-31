import { BookingRepository } from "../../repositories/booking/booking.repository";
import { BookingTransitionService } from "../booking/booking.transition.service";

const bookingRepo = new BookingRepository();
const transitionService = new BookingTransitionService();

/*
  A request nobody answered before the job was due to start is dead. Left open
  it sits in the driver dashboard forever and blocks the client from rebooking,
  so it is cancelled on the client's behalf with a reason they can read.
*/
export const expireStaleBookingRequests = async () => {
  const stale = await bookingRepo.findStaleRequests(new Date());

  for (const booking of stale) {
    await transitionService.transition(booking.id, "CANCELLED", booking.clientId, {
      reason: "This request expired because the start time passed before the driver responded.",
    });
  }

  return `${stale.length} stale booking request(s) expired`;
};
