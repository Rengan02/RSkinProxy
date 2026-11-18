import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const app = express();
app.use(express.json());

const SKINRESTORER_PATH = process.env.SKINRESTORER_PATH;
const PORT = process.env.PORT;

if (!SKINRESTORER_PATH) {
	console.error("Error: SKINRESTORER_PATH environment variable is required.");
	process.exit(1);
}

function formatUuid(uuid: string): string {
	const clean = uuid.replace(/-/g, '');
	if (clean.length !== 32) return uuid;
	return `${clean.substring(0, 8)}-${clean.substring(8, 12)}-${clean.substring(12, 16)}-${clean.substring(16, 20)}-${clean.substring(20, 32)}`;
}

app.get('/skin/:uuid', async (req, res) => {
	try {
		const rawUuid = req.params.uuid;
		const uuid = formatUuid(rawUuid);
		const skinUrl = await getPlayerImage(uuid);
		
		if (!skinUrl) {
			return res.status(404).json({ error: "Skin not found", uuid });
		}

		const response = await fetch(skinUrl);
		if (!response.ok) throw new Error("Failed to fetch skin texture from URL");
		
		const arrayBuffer = await response.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		res.setHeader('Content-Type', 'image/png');
		res.send(buffer);
	} catch (err: any) {
		res.status(500).json({ error: "Server error", details: err.message });
	}
});

app.get('/head/:uuid', async (req, res) => {
	try {
		const rawUuid = req.params.uuid;
		const uuid = formatUuid(rawUuid);
		const skinUrl = await getPlayerImage(uuid);
		
		if (!skinUrl) {
			return res.status(404).json({ error: "Skin not found", uuid });
		}

		const response = await fetch(skinUrl);
		if (!response.ok) throw new Error("Failed to fetch skin texture from URL");
		
		const arrayBuffer = await response.arrayBuffer();
		const skinBuffer = Buffer.from(arrayBuffer);

		const metadata = await sharp(skinBuffer).metadata();
		const width = metadata.width || 64;
		const scale = width / 64;

		const baseLeft = Math.round(8 * scale);
		const baseTop = Math.round(8 * scale);
		const size = Math.round(8 * scale);

		const overlayLeft = Math.round(40 * scale);
		const overlayTop = Math.round(8 * scale);

		const headBase = await sharp(skinBuffer)
			.extract({ left: baseLeft, top: baseTop, width: size, height: size })
			.resize(128, 128, { kernel: sharp.kernel.nearest })
			.toBuffer();

		const headOverlay = await sharp(skinBuffer)
			.extract({ left: overlayLeft, top: overlayTop, width: size, height: size })
			.resize(128, 128, { kernel: sharp.kernel.nearest })
			.toBuffer();

		const finalHead = await sharp(headBase)
			.composite([{ input: headOverlay, left: 0, top: 0 }])
			.png()
			.toBuffer();

		res.setHeader('Content-Type', 'image/png');
		res.send(finalHead);
	} catch (err: any) {
		res.status(500).json({ error: "Server error", details: err.message });
	}
});

async function getPlayerImage(uuid: string): Promise<string | undefined> {
	try {
		if (!uuid) return;

		const filePath = path.join(SKINRESTORER_PATH!, "players", `${uuid}.player`);
		const fileContent = await fs.readFile(filePath, 'utf8');
		const data = JSON.parse(fileContent);

		return await getSkinUrl(data.skinIdentifier);
	} catch (err) {
		return undefined;
	}
}

async function getSkinUrl(skinIdentifier: any): Promise<string> {
	if (!skinIdentifier) throw new Error("skinIdentifier is undefined!");

	let filetype = "";
	if (skinIdentifier.type === "PLAYER") {
		filetype = "playerskin";
	} else if (skinIdentifier.type === "CUSTOM") {
		filetype = "customskin";
	} else if (skinIdentifier.type === "URL") {
		return skinIdentifier.identifier;
	}

	const filePath = path.join(SKINRESTORER_PATH!, "skins", `${skinIdentifier.identifier}.${filetype}`);
	const fileContent = await fs.readFile(filePath, 'utf8');
	const data = JSON.parse(fileContent);

	const decodedBuffer = Buffer.from(data.value.trim(), 'base64').toString('utf-8');
	const parsedJson = JSON.parse(decodedBuffer);

	return parsedJson.textures.SKIN.url;
}

app.listen(Number(PORT), '0.0.0.0', () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});