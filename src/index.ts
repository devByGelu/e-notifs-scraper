import mongoose from "mongoose";
import _ from "lodash";
import puppeteer from "puppeteer";
import moment from "moment";
import { Event, IEvent } from "./Models/Event";
require("dotenv").config();

const elearnUrl = process.env.ELEARN_URL;
const mongoDbUri = process.env.MONGO_DB_URI;

const userDetails = {
  username: process.env.ELEARN_USERNAME,
  password: process.env.ELEARN_PASSWORD,
};
const selector = {
  username: "#username",
  password: "#password",
  loginButton: "#loginbtn",
  calendarButton: ".metismenu > li:nth-child(3) > a:nth-child(1)",
  newEventButton: "button.btn-secondary:nth-child(4)",
  days: '[data-region="day-content"]',
  dayEvents: ".calendar_event_course",
  eventCourseTitle:
    "#page-header > div > div > div > div.d-flex.align-items-center > div.mr-auto > div > div > h1",
  eventInstructions: "#intro",
  eventDeadline:
    "#region-main > div:nth-child(1) > div > div > div.submissionstatustable > div.box.py-3.boxaligncenter.submissionsummarytable > table > tbody > tr:nth-child(3) > td",
  detailsColumns: ".cell",
};

(async () => {
  if (
    !(
      elearnUrl &&
      mongoDbUri &&
      userDetails["username"] &&
      userDetails["password"]
    )
  )
    throw new Error(".env is in incorrect format");
  const browser = await puppeteer.launch({
    headless: false,
    // headless: true,
    // args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  // Logging in
  await page.goto(elearnUrl);
  await page.waitForSelector(selector["username"]);
  await page.waitForSelector(selector["password"]);
  await page.focus(selector["username"]);
  await page.keyboard.type(userDetails["username"]);
  await page.focus(selector["password"]);
  await page.keyboard.type(userDetails["password"]);
  await page.keyboard.press("Enter");

  // Wait for Calendar button to appear
  await page.waitForSelector(selector["calendarButton"]);
  await page.click(selector["calendarButton"]);

  // If New Even button appears, ready to read calendar
  await page.waitForSelector(selector["newEventButton"]);

  // Get event links
  let links = await page.evaluate(
    ({ selector }) => {
      const links: string[] = [];
      let d = document.querySelectorAll(selector["days"]);
      d.forEach((el) => {
        let dayEvents = el.querySelectorAll(selector["dayEvents"]);
        //@ts-ignore
        Array.from(dayEvents).forEach((el: Element) => {
          // For each event
          links.push(el.getElementsByTagName("a")[0].href);
        });
      });
      return links;
    },
    { selector }
  );

  links = links.filter((l) => l.includes("assign"));

  let events: IEvent[] = [];

  for (const link of links) {
    await page.goto(link);
    await page.waitForSelector(selector["eventInstructions"]);

    const courseTitle = await page.evaluate(
      ({ selector }) =>
        document.querySelector(selector["eventCourseTitle"]).textContent,
      { selector }
    );

    const deadlineStr: string = await page.evaluate(
      ({ selector }) => {
        let dateStr = "";
        document.querySelectorAll(selector["detailsColumns"]).forEach((el) => {
          if (el.textContent === "Due date")
            if (el.nextElementSibling?.textContent) {
              dateStr = el.nextElementSibling.textContent;
            }
        });
        return dateStr;
      },
      { selector }
    );

    const deadline = new Date(deadlineStr);

    const eventId = link.split("id=")[1];
    const pic = "";
    events.push({
      eventId,
      deadline,
      link,
      pic,
      courseTitle,
    });
  }

  events = _.unionBy(events, "eventId"); // Remove duplicates
  console.log(JSON.stringify(events, null, 2));

  await mongoose.connect(mongoDbUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: true,
  });

  console.log("Connected to mongodb!");
  await Promise.all(
    _.map(events, (e) =>
      Event.findOneAndUpdate({ eventId: e.eventId }, e, { upsert: true })
    )
  );
  console.log("Finished updating events collection");

  // await page.screenshot({ path: "example.png" });
  // await browser.close();
})();
