const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth")
const { url } = require("./constants");
const fs = require("node:fs")
const path = require("node:path")

puppeteer.use(StealthPlugin())

const DATA_DIR = path.join(__dirname, "data");
const CSV_FILE = path.join(DATA_DIR, "aviator-rounds.csv");

const CSV_HEADER =
  "outcome,time\n";

fs.mkdirSync(DATA_DIR, { recursive: true });

if (!fs.existsSync(CSV_FILE)) {
  fs.writeFileSync(CSV_FILE, CSV_HEADER, "utf8");
}

function appendCsvRow(row) {
  // Quote and escape CSV fields safely.
  const line = row.map(value => {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  }).join(",") + "\n";

  fs.appendFileSync(CSV_FILE, line, "utf8");
}

// Change this once we know the site's actual selector.
const MULTIPLIER_SELECTOR = ".payouts-block";

let targetOdd = 2.00
let lossMultiplier = 2;
let initialStake = '100';
let lStreakTolerance = 9;

let currentStake = initialStake;
let currentRound = 0;
let lStreak = 0;
let stakedLastRound = false;

(async () => {

    const browser = await puppeteer.launch({
        headless: false,
        userDataDir: "./browser-profile",
        defaultViewport: null
    });

    const page = await browser.newPage()

    await page.goto(url);

    page.on('console', (msg)=>{
        console.log('something happened in evaluate function', msg)
    })

    await page.exposeFunction('newMult', (val)=>{
        console.log("this is when newMult function have been exposed", val, typeof val)
        processData(val)
    })

    let frameHandle = await page.waitForSelector("iframe#launch-wap-iframe")
    let frame = await frameHandle.contentFrame()

    let layeredFrameHandle = await frame.waitForSelector("iframe#third-party-game-iframe")
    let layeredFrame = await layeredFrameHandle.contentFrame()

    let lastFrameHanlde = await layeredFrame.waitForSelector("iframe[title='gameIFrame']")
    let lastFrame = await lastFrameHanlde.contentFrame()

    let multContainer = await lastFrame.waitForSelector(MULTIPLIER_SELECTOR)
    let input = await lastFrame.waitForSelector('input[type="text"]')
    
    let textFromMUltContainer = await lastFrame.evaluate((MULTIPLIER_SELECTOR)=>{
        const txts = document.querySelector(MULTIPLIER_SELECTOR)
        let txtContent = txts.textContent
        
        const observer = new MutationObserver((mutationsList) => {
            window.newMult(txts.textContent)
            console.log('The text inside the div just changed programmatically!');
            
        });
        
        observer.observe(txts, { childList: true, characterData: true, subtree: true });
        
        return txtContent
    }, MULTIPLIER_SELECTOR)
    
    //console.log("element", multContainer, textFromMUltContainer, input)

    //check if you can place bet in round
    function canProceedToBet(lt){
        let last = parseFloat(lt[0].replace("x", "").replace(",", ""))
        let lastTwo = parseFloat(lt[1].replace("x", "").replace(",", ""))
        console.log(last, lastTwo)

        if(lStreak == 0 && (last > targetOdd)){
            console.log("can bet after last win or first bet of round", lStreak)
            return true
        }

        if(lStreak > 0 &&  last > targetOdd){
            console.log("can bet after condition met with loss streak", lStreak)
            return true
        }

        return false
    }
    
    async function processData(outcomesArr){
        let btn = await lastFrame.waitForSelector('button.bet')
        let lastTwo = outcomesArr.split(" ").filter((item)=> item !== '').slice(0, 2)
        console.log("last two outcomes", lastTwo)
        //await lastFrame.click('input[type="text"]')
        let inputBox = await input.boundingBox()
        let btnBox = await btn.boundingBox()
        
        //check if won previous round
        let lastOutcome = parseFloat(lastTwo[0].replace("x", "").replace(",", ""))
        let outcomeBeforeLast = parseFloat(lastTwo[1].replace("x", "").replace(",", ""))
        if(lastOutcome > targetOdd && currentRound > 0 && outcomeBeforeLast > targetOdd && stakedLastRound){
            console.log("previous round won", currentRound)
            lStreak = 0
            currentStake = initialStake
        }else if(lastOutcome < targetOdd && currentRound > 0 && outcomeBeforeLast > targetOdd && stakedLastRound){
            console.log("previous round not won", currentRound)
            lStreak = lStreak > lStreakTolerance ?  0 : lStreak + 1
            currentStake = (lStreak > lStreakTolerance) ? initialStake : String(parseInt(currentStake) * lossMultiplier)
        }

        console.log("current stake", currentStake)

        if(canProceedToBet(lastTwo)){
            //this block makes the b3t
            console.log("bet running, round should add", currentStake)
            await page.mouse.move(inputBox.x + 1, inputBox.y + 1)
            await page.mouse.click(inputBox.x + 1, inputBox.y + 1)
            
            for(let i=0; i< 7; i++){
                await page.keyboard.press('ArrowRight', {delay: 100})
            }
            await page.keyboard.down('Shift')
            for(let i=0; i < 9; i++){
                await page.keyboard.press('ArrowLeft', {delay: 100})
            }
            await page.keyboard.up('Shift')
            await page.keyboard.press('Backspace')
            await page.keyboard.type(currentStake, {delay: 500})
            
            await page.mouse.move(btnBox.x + 1, btnBox.y + 1)
            await btn.click()
            currentRound += 1
            stakedLastRound = true
        }else{
            stakedLastRound = false
        }

        //after processing the data save to csv file
        appendCsvRow([lastOutcome, new Date()])
    }
    
    //let frame = page.locator("iframe[title='gameIFrame']")

    console.log("====================================");
    console.log("AVIATOR MONITOR");
    console.log("====================================");
    console.log("Browser loaded.");
    console.log("Monitoring is READ ONLY.");
    console.log("");



    console.log("Multiplier element found.");


})();