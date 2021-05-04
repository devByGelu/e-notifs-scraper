import mongoose from "mongoose";

export type IEvent = {
  link: string;
  eventId: string;
  pic: string;
  deadline: Date;
  courseTitle: string;
};
const eventSchema = new mongoose.Schema({
  link: String,
  eventId: String,
  pic: String,
  deadline: Date,
  courseTitle: String,
});

export const Event = mongoose.model("Event", eventSchema);
