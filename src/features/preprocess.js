class Preprocess {
	constructor() {
		this.blurRadius
		this.blurKernelSize
		this.blurKernel
		this.blurMult
	}

	thresholdFilter(image, level) {
		if (image === undefined) {
			return
		}

		if (level === undefined) {
			level = .5
		}

		const thresh = Math.floor(level * 255)

		image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
			const red = this.bitmap.data[idx + 0]
			const green = this.bitmap.data[idx + 1]
			const blue = this.bitmap.data[idx + 2]
			const gray = 0.2126 * red + 0.7152 * green + 0.0722 * blue

			let value
			if (gray >= thresh) {
				value = 255
			} else {
				value = 0
			}

			this.bitmap.data[idx] = this.bitmap.data[idx + 1] = this.bitmap.data[idx + 2] = value
		})
	}

	getARGB(image, i) {
		const offset = i * 4
		return (
			((image.bitmap.data[offset + 3] << 24) & 0xff000000) |
			((image.bitmap.data[offset] << 16) & 0x00ff0000) |
			((image.bitmap.data[offset + 1] << 8) & 0x0000ff00) |
			(image.bitmap.data[offset + 2] & 0x000000ff)
		)
	}

	setPixels(image, data) {
		let offset = 0
		for (let i = 0, al = image.bitmap.data.length; i < al; i++) {
			offset = i * 4
			image.bitmap.data[offset + 0] = (data[i] & 0x00ff0000) >>> 16
			image.bitmap.data[offset + 1] = (data[i] & 0x0000ff00) >>> 8
			image.bitmap.data[offset + 2] = data[i] & 0x000000ff
			image.bitmap.data[offset + 3] = (data[i] & 0xff000000) >>> 24
		}
	}

	buildBlurKernel(r) {
		let radius = (r * 3.5) | 0
		radius = radius < 1 ? 1 : radius < 248 ? radius : 248

		if (this.blurRadius !== radius) {
			this.blurRadius = radius
			this.blurKernelSize = (1 + this.blurRadius) << 1
			this.blurKernel = new Int32Array(this.blurKernelSize)
			this.blurMult = new Array(this.blurKernelSize)

			for (let i = 0; i < this.blurKernelSize; i++) {
				this.blurMult[i] = new Int32Array(256)
			}

			let bk, bki
			let bm, bmi

			for (let j = 1, radiusi = radius - 1; j < radius; j++) {
				this.blurKernel[radius + j] = this.blurKernel[radiusi] = bki = radiusi * radiusi
				bm = this.blurMult[radius + j]
				bmi = this.blurMult[radiusi--]

				for (let k = 0; k < 256; k++) {
					bm[k] = bmi[k] = bki * k
				}
			}

			bk = this.blurKernel[radius] = radius * radius
			bm = this.blurMult[radius]

			for (let l = 0; l < 256; l++) {
				bm[l] = bk * l
			}
		}
	}

	blurARGB(image, radius) {
		const width = image.bitmap.width
		const height = image.bitmap.height
		const numPackedPixels = width * height
		const argb = new Int32Array(numPackedPixels)

		for (let i = 0; i < numPackedPixels; i++) {
			argb[i] = this.getARGB(image, i)
		}

		let sum, cr, cg, cb, ca
		let read, ri, ym, ymi, bk0

		const a2 = new Int32Array(numPackedPixels)
		const r2 = new Int32Array(numPackedPixels)
		const g2 = new Int32Array(numPackedPixels)
		const b2 = new Int32Array(numPackedPixels)

		let yj = 0

		this.buildBlurKernel(radius)

		let x, y, j
		let bm
		for (y = 0; y < height; y++) {
			for (x = 0; x < width; x++) {
				cb = cg = cr = ca = sum = 0
				read = x - this.blurRadius

				if (read < 0) {
					bk0 = -read
					read = 0
				} else {
					if (read >= width) {
						break
					}
					bk0 = 0
				}

				for (j = bk0; j < this.blurKernelSize; j++) {
					if (read >= width) {
						break
					}

					const c = argb[read + yj]

					bm = this.blurMult[j]
					ca += bm[(c & -16777216) >>> 24]
					cr += bm[(c & 16711680) >> 16]
					cg += bm[(c & 65280) >> 8]
					cb += bm[c & 255]
					sum += this.blurKernel[j]
					read++
				}

				ri = yj + x
				a2[ri] = ca / sum
				r2[ri] = cr / sum
				g2[ri] = cg / sum
				b2[ri] = cb / sum
			}
			yj += width
		}

		yj = 0
		ym = -this.blurRadius
		ymi = ym * width
		for (y = 0; y < height; y++) {
			for (x = 0; x < width; x++) {
				cb = cg = cr = ca = sum = 0

				if (ym < 0) {
					bk0 = ri = -ym
					read = x
				} else {
					if (ym >= height) {
						break
					}

					bk0 = 0
					ri = ym
					read = x + ymi
				}

				for (j = bk0; j < this.blurKernelSize; j++) {
					if (ri >= height) {
						break
					}

					bm = this.blurMult[j]
					ca += bm[a2[read]]
					cr += bm[r2[read]]
					cg += bm[g2[read]]
					cb += bm[b2[read]]
					sum += this.blurKernel[j]
					ri++
					read += width
				}

				argb[x + yj] =
					((ca / sum) << 24) |
					((cr / sum) << 16) |
					((cg / sum) << 8) |
					(cb / sum)
			}

			yj += width
			ymi += width
			ym++
		}

		this.setPixels(image, argb)
	}

	invertColors(image) {
		for (let i = 0; i < image.bitmap.data.length; i += 4) {
			image.bitmap.data[i + 0] = image.bitmap.data[i + 0] ^ 255
			image.bitmap.data[i + 1] = image.bitmap.data[i + 1] ^ 255
			image.bitmap.data[i + 2] = image.bitmap.data[i + 2] ^ 255
		}
	}

	dialate(image) {
		let currIdx = 0
		const maxIdx = image.bitmap.data.length ? image.bitmap.data.length / 4 : 0
		const out = new Int32Array(maxIdx)
		let currRowIdx, maxRowIdx, colOrig, colOut, currLum

		let idxRight, idxLeft, idxUp, idxDown
		let colRight, colLeft, colUp, colDown
		let lumRight, lumLeft, lumUp, lumDown

		while (currIdx < maxIdx) {
			currRowIdx = currIdx
			maxRowIdx = currIdx + image.bitmap.width
			while (currIdx < maxRowIdx) {
				colOrig = colOut = this.getARGB(image, currIdx)
				idxLeft = currIdx - 1
				idxRight = currIdx + 1
				idxUp = currIdx - image.bitmap.width
				idxDown = currIdx + image.bitmap.width

				if (idxLeft < currRowIdx) {
					idxLeft = currIdx
				}

				if (idxRight >= maxRowIdx) {
					idxRight = currIdx
				}

				if (idxUp < 0) {
					idxUp = 0
				}

				if (idxDown >= maxIdx) {
					idxDown = currIdx
				}

				colUp = this.getARGB(image, idxUp)
				colLeft = this.getARGB(image, idxLeft)
				colDown = this.getARGB(image, idxDown)
				colRight = this.getARGB(image, idxRight)

				//compute luminance
				currLum =
					77 * ((colOrig >> 16) & 0xff) +
					151 * ((colOrig >> 8) & 0xff) +
					28 * (colOrig & 0xff)
				lumLeft =
					77 * ((colLeft >> 16) & 0xff) +
					151 * ((colLeft >> 8) & 0xff) +
					28 * (colLeft & 0xff)
				lumRight =
					77 * ((colRight >> 16) & 0xff) +
					151 * ((colRight >> 8) & 0xff) +
					28 * (colRight & 0xff)
				lumUp =
					77 * ((colUp >> 16) & 0xff) +
					151 * ((colUp >> 8) & 0xff) +
					28 * (colUp & 0xff)
				lumDown =
					77 * ((colDown >> 16) & 0xff) +
					151 * ((colDown >> 8) & 0xff) +
					28 * (colDown & 0xff)

				if (lumLeft > currLum) {
					colOut = colLeft
					currLum = lumLeft
				}

				if (lumRight > currLum) {
					colOut = colRight
					currLum = lumRight
				}

				if (lumUp > currLum) {
					colOut = colUp
					currLum = lumUp
				}

				if (lumDown > currLum) {
					colOut = colDown
					currLum = lumDown
				}

				out[currIdx++] = colOut;
			}
		}

		this.setPixels(image, out)
	}
}

export default Preprocess