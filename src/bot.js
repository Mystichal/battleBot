import dotenv from 'dotenv'
import discord, {
	GatewayIntentBits,
	User
} from 'discord.js'
import tesseract from 'tesseract.js'
import fetch from 'node-fetch'
import fs from 'fs'
import moment from 'moment'
import Jimp from 'jimp'
import cv from '@techstark/opencv-js'
import Preprocess from './features/preprocess.js'


dotenv.config()

const preprocess = new Preprocess


const lang = 'eng+rus'
const client = new discord.Client({
	intents: [
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages
	]
})
const supportedImageFormats = [
	'jpeg',
	'jpg',
	'png',
	'bmp',
]
const dicCorpTickers = []
const dicUsernames = []
const dicSystems = []
const dicShips = []
const dicShipTypes = [
	'Frigate',
	'Destroyer',
	'Cruiser',
	'Battlecruiser',
	'Battleship',
	'Carrier',
	'Dreadnought'
]
const dicRef = [
	'Top Damage',
	'Kill',
	'Total damage',
	'KILL REPORT',
	'ID',
	'Warp Scramble Strength',
]

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`)
})

client.on('messageCreate', async message => {
	if (message.author.bot) return

	if (message.attachments.size > 0) {
		message.attachments.forEach(async attachment => {
			// parse type from url
			let type = attachment.attachment.split(/[#?]/)[0].split('.').pop().trim()

			if (supportedImageFormats.includes(type)) {
				// set time
				let date = moment()

				// set folder path(/killmails/Username_220830230830) and image name (raw)
				let imageStorage = `./killmails/${message.author.username}_${date.format('YYMMDDhhmmss')}`
				let imageOne = imageStorage + '/1' + '.' + type
				let imageTwo = imageStorage + '/2' + '.' + type
				let imageThree = imageStorage + '/3' + '.' + type
				let imageRawPath = imageStorage + '/raw' + '.' + type
				let imageOut = imageStorage + '/out' + '.' + type

				// fetch image
				let response = await fetch(attachment.attachment)
				let arrayBuffer = await response.arrayBuffer()
				let imageBuffer = Buffer.from(arrayBuffer)

				// create folder and raw image
				if (!fs.existsSync(imageStorage)) {
					try {
						fs.mkdirSync(imageStorage)

						if (fs.existsSync(imageStorage)) {
							fs.writeFileSync(imageRawPath, imageBuffer)
						}
					} catch (error) {
						console.log(error)
					}
				}

				// image pre process
				let imageRaw = await Jimp.read(imageRawPath)
				imageRaw
					.quality(100)
					.convolute([
						[0, -1, 0],
						[-1, 5, -1],
						[0, -1, 0]
					])
					.color([{
						apply: 'tint',
						params: [10]
					}])


				preprocess.blurARGB(imageRaw, 1)
				imageRaw.write(imageOne)

				let src = cv.matFromImageData(imageRaw.bitmap)
				let dst = new cv.Mat()
				let M = cv.Mat.ones(2, 2, cv.CV_8U)
				let anchor = new cv.Point(-1, -1)
				cv.dilate(src, dst, M, anchor, 1, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue())

				imageRaw = new Jimp({
					width: dst.cols,
					height: dst.rows,
					data: Buffer.from(dst.data)
				})

				imageRaw.write(imageTwo)

				preprocess.invertColors(imageRaw)
				imageRaw.write(imageThree)

				preprocess.thresholdFilter(imageRaw, 0.5)
				imageRaw.write(imageOut)

				// ocr image
				tesseract.recognize(
					imageOut,
					lang, {
						logger: (m) => console.log(m)
					}
				).then(({
					data: {
						text
					}
				}) => {
					message.reply({
						content: text,
						files: [imageOut],
						ephemeral: true
					})
				})
			} else {
				message.reply('Error: Image format is not supported')
			}
		})

	}
})

client.login(process.env.BOT_TOKEN)

/// create a folder for each image, save it, pre process it
// https://dev.to/mathewthe2/using-javascript-to-preprocess-images-for-ocr-1jc

// cv thresh
// https://docs.opencv.org/4.x/d7/d4d/tutorial_py_thresholding.html