const { google } = require('googleapis')
const fs = require('fs')

const config = require('../config')

class GDriveService {
  async init (browser) {
    this.oauth2Client = new google.auth.OAuth2(
      config.googleDriveClientId,
      config.googleDriveClientSecret,
      config.googleDriveClientRedirect
    )

    const url = this.oauth2Client.generateAuthUrl({
      access_type: 'online',
      scope: 'https://www.googleapis.com/auth/drive'
    })

    this.drive = google.drive({
      version: 'v3',
      auth: config.googleDriveApiToken
    })

    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto(url)
  }

  async createFolder () {
    const fileMetadata = {
      name: 'Invoices',
      mimeType: 'application/vnd.google-apps.folder'
    }

    return this.drive.files.create({
      resource: fileMetadata,
      fields: 'id'
    })
  }

  async createFileInFolder (filePath, folderId) {
    // const folderId = '0BwwA4oUTeiV1TGRPeTVjaWRDY1E'
    const fileMetadata = {
      name: 'photo.jpg',
      parents: [folderId]
    }

    const media = {
      mimeType: 'image/jpeg',
      body: fs.createReadStream(filePath)
    }

    return this.drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id'
    })
  }

  async checkIfFolderExists (folder) {
    let pageToken = null

    while (true) {
      const response = await this.drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder'",
        fields: 'name',
        spaces: 'drive',
        pageToken: pageToken
      })

      for (const file of response.files) {
        console.log('Found file: ', file.name, file.id)

        if (file.name === folder) return true
      }

      pageToken = response.nextPageToken

      if (!pageToken) return false
    }
  }

  async getFolderId (folder) {
    let pageToken = null

    while (true) {
      const response = await this.drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder'",
        fields: 'name',
        spaces: 'drive',
        pageToken: pageToken
      })

      for (const file of response.files) {
        console.log('Found file: ', file.name, file.id)

        if (file.name === folder) return file.id
      }

      pageToken = response.nextPageToken

      if (!pageToken) return null
    }
  }
}

module.exports = {
  GDriveService
}
