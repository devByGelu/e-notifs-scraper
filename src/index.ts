import _ from "lodash";
import puppeteer from "puppeteer";
const elearnUrl = "https://elearn.xu.edu.ph";

const userDetails = { username: "200610313", password: "Augustus_10" };
const selector = {
  username: "#username",
  password: "#password",
};

const hehe: number = 2;
(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    // headless: true,
    // args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.goto(elearnUrl);
  await page.waitForSelector(selector["username"]);
  await page.waitForSelector(selector["password"]);
  await page.evaluate(() => {});
  await page.$eval(
    "input[name=username]",
    (el: any) => (el.value = userDetails.username),
    { userDetails }
  );
  await page.$eval(
    "input[name=password]",
    (el: any) => (el.value = userDetails.password),
    { userDetails }
  );
  console.log("SUCCESS!");
  // await page.screenshot({ path: "example.png" });
  // await browser.close();
})();
