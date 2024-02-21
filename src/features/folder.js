class folder {
	construct(username) {
		let imageStorage = `./killmails/${username}_${date.format('YYMMDDhhmmss')}`

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
	}
}

export default folder