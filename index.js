const { chromium } = require('playwright')
const needle = require('needle')
const randomUseragent = require('random-useragent')
const fs = require('fs')

const config = require('./config')
const useragent = randomUseragent.getRandom()

const outputPaths = []
const albumUrlTexts = [];

(async () => {
  const browser = await chromium.launch({ headless: false, userAgent: useragent })
  const page = await browser.newPage()
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

  if (loginFailed1 || loginFailed2) {
    // TODO add new job in order to try it later again, max tries 5 before end
    console.log('login failed')
    return
  }

  await page.waitForTimeout(3000)

  try {
    await tryClick(page, "text='Jetzt nicht'")
    await tryClick(page, "text='Jetzt nicht'")
  } catch (error) {
    console.log(error)
    return
  }

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

    outputPaths.push(outputFullPath)
  }

  await scrollToBottom(page)

  const albumUrls = await page.$$('.Nt8m2 > a')

  for (let counter = 0; counter < albumUrls.length; counter++) {
    const albumUrlText = await albumUrls[counter].getAttribute('href')
    console.log(albumUrlText)

    albumUrlTexts.push(albumUrlText)
  }

  for (let counter = 0; counter < albumUrlTexts.length; counter++) {
    const albumUrlText = 'https://www.instagram.com' + albumUrlTexts[counter]

    await page.goto(albumUrlText)
    await page.waitForSelector('.v1Nh3.kIKUG._bz0w > a')

    await scrollToBottom(page)

    // const previewImages = await page.$$('.v1Nh3.kIKUG._bz0w > a')
    const previewImages = await page.$$eval('.v1Nh3.kIKUG._bz0w > a', (elements) =>
      elements.map((el) => el.href)
    )
    console.log(previewImages)

    const outputPath = outputPaths[counter]
    console.log(outputPaths[counter])

    for (const previewImage of previewImages) {
      await page.goto(previewImage)
      await grabAndSavePicture(page, outputPath)
    }
  }

  browser.close()
})()

/**
 * @param  {any} page
 * @param  {string} selector
 * @param  {number} maxTries=3
 */
async function tryClick (page, selector, maxTries = 3) {
  let tryCounter = 0

  while (tryCounter < maxTries) {
    if (tryCounter >= 1) {
      await page.waitForTimeout(3000)
    }

    const selectedElement = await page.$(selector)

    if (selectedElement) {
      await page.click(selector)
      break
    }

    tryCounter++
  }

  if (tryCounter === maxTries) {
    const logText = 'tryClick() for selector ' + selector + ' failed.'
    console.log(logText)
    throw new Error(logText)
  }

  await page.waitForTimeout(3000)
}

function getDictionaryLength (path) {
  const dir = fs.readdirSync(path)
  return dir.length
}

// Scrolls to bottom in order to load all saved images of one album
async function scrollToBottom (page) {
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      let totalHeight = 0
      const distance = 100
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight
        window.scrollBy(0, distance)
        totalHeight += distance

        if (totalHeight >= scrollHeight) {
          clearInterval(timer)
          resolve()
        }
      }, 400)
    })
  })
}

async function grabAndSavePicture (page, outputPath) {
  try {
    await page.waitForSelector('.KL4Bh > img', { timeout: 10000 })

    const imageUrl = await page.$('.KL4Bh > img')
    const imageUrlText = await imageUrl.getAttribute('src')

    if (!imageUrlText) {
      throw new Error('couldn\'t get one picture')
    }

    console.log('imageUrlText: ', imageUrlText)

    await needle.get(imageUrlText, { output: outputPath + '/' + (getDictionaryLength(outputPath) + '.jpg') })

    const chevronRight = await page.$('.coreSpriteRightChevron')

    if (chevronRight) {
      await chevronRight.click()
      await grabAndSavePicture(page, outputPath)
    }
  } catch (error) {
    console.log(error)
  }
}
