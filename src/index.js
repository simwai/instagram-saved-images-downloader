const { chromium } = require('playwright')
const needle = require('needle')
const randomUseragent = require('random-useragent')
const fs = require('fs')

const config = require('./config')
const useragent = randomUseragent.getRandom()

const outputPaths = []
const albumUrlTexts = []

const outputBasePath = '../fetched_images';

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
    console.log(albumUrlText)
    await page.goto(albumUrlText)
    try {
      await page.waitForSelector('.v1Nh3.kIKUG._bz0w > a', { timeout: 20000 })
    } catch {
      console.log('warning: couldn\'t get pictures for the album ' + albumUrlTexts[counter])
      continue
    }

    await scrollToBottom(page)

    // const previewImages = await page.$$('.v1Nh3.kIKUG._bz0w > a')
    const previewImages = await page.$$eval('.v1Nh3.kIKUG._bz0w > a', (elements) =>
      elements.map((el) => el.href)
    )
    console.log(previewImages)

    const outputPath = outputPaths[counter]

    for (const previewImage of previewImages) {
      await page.goto(previewImage)
      const result = await grabAndSavePicture(page, outputPath)

      if (result === null) {
        console.log('failed to get one image')
      }
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
  } catch (error) {
    console.log(error)
    return null
  }

  const imageUrl = await page.$('.KL4Bh > img')

  if (!imageUrl) return null

  const imageUrlText = await imageUrl.getAttribute('src')

  if (!imageUrlText) return null

  console.log('imageUrlText: ', imageUrlText)

  const newImagePath = outputPath + '/' + (getDictionaryLength(outputPath) + '.jpg')

  const response = await needle('get', imageUrlText)
  const base64 = base64EncodeFromBitmap(response.body)
  if (!doesImageExist(base64)) {
    // TODO don't do request twice, convert base64 to bitmap and save it
    // await needle('get', imageUrlText, { output: newImagePath })
    // fs.writeFile(newImagePath, base64, 'base64', function (error) {
    //   console.log(error)
    // })

    fs.writeFileSync(newImagePath, response.body, error => console.log(error))

    const chevronRight = await page.$('.coreSpriteRightChevron')

    if (chevronRight) {
      await chevronRight.click()
      const result = await grabAndSavePicture(page, outputPath)

      if (result === null) {
        console.log('failed to get one picture from slideshow')
      }
    }
  }

  // function to encode file data to base64 encoded string
  function base64EncodeFromFile (file) {
  // read binary data
    const bitmap = fs.readFileSync(file)
    // convert binary data to base64 encoded string
    base64EncodeFromBitmap(bitmap)
  }

  function base64EncodeFromBitmap (bitmap) {
  // convert binary data to base64 encoded string
    const base64 = Buffer.from(bitmap).toString('base64')
    return base64
  }

  function doesImageExist (bitmap) {
    const image2base64 = base64EncodeFromBitmap(bitmap)

    const folders = fs.readdirSync(outputBasePath)

    for (const folder of folders) {
      const images = fs.readdirSync(outputBasePath + '/' + folder)

      for (const file of images) {
        const image1base64 = base64EncodeFromFile(outputBasePath + '/' + folder + '/' + file)

        if (image2base64 === image1base64) return true
      }
    }

    return false
  }
}

// function deleteImage (imagePath) {
//   const folders = fs.readdirSync(outputBasePath)

//   for (const folder of folders) {
//     const filesToDelete = fs.readdirSync(outputBasePath + '/' + folder)

//     for (const file of filesToDelete) {
//       if (imagePath === outputBasePath + '/' + folder + '/' + file) {
//         fs.unlinkSync(outputBasePath + '/' + folder + '/' + file)
//       }
//     }
//   }
// }
