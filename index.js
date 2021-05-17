const { chromium } = require('playwright')
const needle = require('needle')
const randomUseragent = require('random-useragent')
const fs = require('fs')

const config = require('./config')
const useragent = randomUseragent.getRandom();

(async () => {
  const browser = await chromium.launch({ headless: false, userAgent: useragent })
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('https://instagram.com//')
  await page.screenshot({ path: 'screenshots/latest-screenshot.png' })

  await page.waitForTimeout(3000)

  const cookieForm = await page.$('text=Alle annehmen')

  if (cookieForm) {
    await page.click('text=Alle annehmen')
    await page.waitForTimeout(3000)
  }

  await page.fill(':nth-match(input, 1)', config.username)

  await page.waitForTimeout(3000)
  await page.fill(':nth-match(input, 2)', config.password)

  // TODO save cookies to file, on reload check if cookie works or not

  await page.waitForTimeout(3000)
  await page.click('text=Anmelden')

  await page.waitForTimeout(1500)
  const loginFailed1 = await page.$('text=Bitte warte einige')
  const loginFailed2 = await page.$('text=Wir konnten keine Verbindung zu Instagram herstellen.')

  if (!loginFailed1 || !loginFailed2) {
    // TODO add new job in order to try it later again, max tries 5 before end
    console.log('login failed')
    return
  }

  await page.waitForTimeout(3000)
  await page.click('text=Jetzt nicht')
  await page.waitForTimeout(3000)

  try {
    const notificationQuestion = await page.$('text=Jetzt nicht')

    if (notificationQuestion) {
      await page.click('text=Jetzt nicht')
    }
  } catch (error) {
    console.log(error)
  }

  await page.waitForTimeout(3000)
  await page.click(':nth-match(.Fifk5, 5) img')

  await page.waitForTimeout(3000)
  await page.click('text=Gespeichert')

  // await page.waitForTimeout(3000)
  await page.waitForSelector('._7UhW9.LjQVu.qyrsm.h_zdq.uL8Hv')
  // $$ returns colleation, $ returns single
  const albums = await page.$$('._7UhW9.LjQVu.qyrsm.h_zdq.uL8Hv')

  const outputBasePath = './fetched_images'

  if (!fs.existsSync(outputBasePath)) {
    fs.mkdirSync(outputBasePath)
  }

  for (const album of albums) {
    // create album folders
    const outputFullPath = outputBasePath + '/' + await album.textContent()

    if (!fs.existsSync(outputFullPath)) {
      fs.mkdirSync(outputFullPath)
    }
  }

  const albumUrls = await page.$$('.Nt8m2 > a')

  for (const albumUrl of albumUrls) {
    const albumUrlText = await albumUrl.textContent()
    console.log(albumUrlText)
    await page.goto(albumUrlText)
    const previewImages = await page.$$('.v1Nh3.kIKUG._bz0w > a')

    for (const previewImage of previewImages) {
      // TODO find out if i can put this as second parameter into imageUrls
      const previewImageUrl = await previewImage.getAttribute('href')
      console.log(previewImageUrl)

      await page.goto(previewImageUrl)

      const imageUrls = await page.$$('.KL4Bh > a')

      for (const imageUrl of imageUrls) {
        console.log(imageUrl)

        let imageUrlResponse

        try {
          imageUrlResponse = await needle('get', imageUrl)
        } catch (error) {
          console.log(error)
          // TODO be aware will not end the whole loop, fix that
          return
        }

        if (imageUrlResponse) {
          console.log(imageUrlResponse)
        }
      }
    }
  }

  await context.close()
})()
