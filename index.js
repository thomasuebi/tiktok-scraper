const puppeteer = require("puppeteer-extra")

// add stealth plugin and use defaults (all evasion techniques)
const StealthPlugin = require("puppeteer-extra-plugin-stealth")
puppeteer.use(StealthPlugin())
const express = require("express")
const fs = require("fs")

let abort = false

function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time))
}

async function main() {
  let browser = await puppeteer.launch({ headless: false, timeout: 100000 })
  const page = (await browser.pages())[0]

  const app = express()
  const port = 3000
  if (fs.existsSync("./cookies.json")) {
    const cookiesString = fs.readFileSync("./cookies.json")
    const cookies = JSON.parse(cookiesString)
    await page.setCookie(...cookies)
  }
  await page.goto("https://www.tiktok.com/search?q=%23ad&t=1654958769899", {
    timeout: 100000,
  })

  app.get("/abort", async (req, res) => {
    abort = true
  })
  app.get("/crawl", async (req, res) => {
    abort = false
    res.send("Crawling started!")
    const cookies = await page.cookies()
    fs.writeFileSync("./cookies.json", JSON.stringify(cookies, null, 2))
    while (!abort) {
      await page.waitForSelector('[data-e2e="search-load-more"]')
      await page.click('[data-e2e="search-load-more"]')
      const elements = await page.$$(".tiktok-1soki6-DivItemContainerForSearch")
      const results = await asyncMap(elements, async (element) => {
        const caption = await page.evaluate(
          (el) => el.textContent,
          await element.$('[data-e2e="search-card-video-caption"]')
        )
        const user = await page.evaluate(
          (el) => el.textContent,
          await element.$('[data-e2e="search-card-user-link"]')
        )
        const views = await page.evaluate(
          (el) => el.textContent,
          await element.$('[data-e2e="search-card-like-container"]')
        )
        return { caption, user, views }
      })
      fs.writeFileSync("./results.json", JSON.stringify(results, null, 2))
      console.log(
        `Continue crawling. Send request to https://localhost:${port}/abort to abort.`
      )
    }
  })

  app.listen(port, () => {
    console.log(
      `Crawler app listening on port ${port} - Login to TikTok, then send request to http://localhost:${port}/crawl to start`
    )
  })
  //   await browser.close()
}

main()

async function asyncMap(arr, callbackfn, thisArg) {
  return Promise.all(
    arr.map(
      async (value, index, array) => callbackfn(value, index, array),
      thisArg
    )
  )
}
