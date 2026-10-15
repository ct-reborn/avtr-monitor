const puppeteer = require("puppeteer");
const StealthPlugin = require("puppeteer-extra-plugin-stealth")
const { url } = require("./constants");

(async () => {
    const browser = await puppeteer.launch({
        headless: false,

        // Keep cookies/localStorage/session information here.
        userDataDir: "./browser-profile",

        defaultViewport: null
    });

    const pages = await browser.pages();
    const page = pages[0];

    await page.goto(url, {
        waitUntil: "domcontentloaded"
    });

    console.log("\n====================================");
    console.log("LOGIN");
    console.log("====================================");
    console.log("Log in manually in the browser.");
    console.log("Complete OTP/2FA if required.");
    console.log("When finished, return to this terminal.");
    console.log("Press ENTER to finish.\n");

    process.stdin.setEncoding("utf8");

    process.stdin.once("data", async () => {
        console.log("Login session saved in ./browser-profile");

        await browser.close();
        process.exit(0);
    });
})();