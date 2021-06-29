const fs = require('fs')

const outputBasePath = '../fetched_images'

const folders = fs.readdirSync(outputBasePath)
console.log(folders)

for (const folder of folders) {
  const filesToDelete = fs.readdirSync(outputBasePath + '/' + folder)
  console.log(filesToDelete)

  for (const file of filesToDelete) {
    fs.unlinkSync(outputBasePath + '/' + folder + '/' + file)
  }

  console.log('deleted all files successfully')
}
