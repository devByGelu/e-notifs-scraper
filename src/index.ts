import _ from "lodash";
import puppeteer from "puppeteer";
import admin from "firebase-admin";
import moment from "moment";
require("dotenv").config();

type IEvent = {
  link: string;
  eventId: string;
  pic: string;
  deadline: Date;
  courseTitle: string;
};

const elearnUrl = process.env.ELEARN_URL;

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
  detailsAreaSelector: "#region-main",
};

const serviceAccount = require("../e-notifs-firebase-adminsdk-9h46d-f5e1c444d9.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.GCLOUD_STORAGE_BUCKET_URL,
});

const db = admin.firestore();

const eventsRef = db.collection("events");

(async () => {
  if (!(elearnUrl && userDetails["username"] && userDetails["password"]))
    throw new Error(".env is in incorrect format");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--start-maximized"],
    // headless: true,
    // args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
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

    const detailsArea = await page.$(selector["detailsAreaSelector"]); // declare a variable with an ElementHandle
    if (detailsArea)
      await detailsArea.screenshot({ path: `images/${eventId}.png` }); // take screenshot element in puppeteer

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

  await Promise.all(
    events.map(({ eventId }, i) =>
      uploadFile(`${eventId}.png`).then((url) => {
        events[i].pic = url;
      })
    )
  );
  console.log("Finished uploading images");

  console.log(JSON.stringify(events, null, 2));
  await Promise.all(_.map(events, (e) => eventsRef.doc(e.eventId).set(e)));
  console.log("Finished updating events collection");

  await browser.close();
})();

const uploadFile = async (fileName: string): Promise<string> => {
  let bucket = admin.storage().bucket();
  const destinationFilename = `folder1/${fileName}`;
  let res = await bucket.upload(`images/${fileName}`, {
    destination: destinationFilename,
    metadata: { contentType: "image/png" },
    public: true,
  });
  let url = res["0"].metadata.mediaLink;
  return url;
};
