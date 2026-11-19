import express from 'express';
import fs from 'node:fs'
import fsP from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import crypto from 'crypto';
import { DecodedSkinValue, MinecraftProfile } from './types';

const app = express();
app.use(express.json());

const SKINRESTORER_PATH = process.env.SKINRESTORER_PATH;
const PORT = process.env.PORT;

if (!SKINRESTORER_PATH) {
	console.error("Error: SKINRESTORER_PATH environment variable is required.");
	process.exit(1);
}

function formatUUID(uuid: string): string {
	const clean = uuid.replace(/-/g, '');
	if (clean.length !== 32) return uuid;
	return `${clean.substring(0, 8)}-${clean.substring(8, 12)}-${clean.substring(12, 16)}-${clean.substring(16, 20)}-${clean.substring(20, 32)}`;
}

app.get('/skin/:uuid', async (req, res) => {
	try {
		const rawUuid = req.params.uuid;
		const uuid = formatUUID(rawUuid);
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
		const uuid = formatUUID(rawUuid);
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
	return readPlayerImage(uuid) || getOnlineSkinURL(uuid);
}

async function readPlayerImage(uuid: string): Promise<string | undefined> {
	try {
		if (!uuid) return;

		const filePath = path.join(SKINRESTORER_PATH!, "players", `${uuid}.player`);
		if(!fs.existsSync(filePath)) return;
		const fileContent = await fsP.readFile(filePath, 'utf8');
		const data = JSON.parse(fileContent);

		return await getSkinURL(data.skinIdentifier);
	} catch (err) {
		return undefined;
	}
}

async function getSkinURL(skinIdentifier: any): Promise<string> {
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
	const fileContent = await fsP.readFile(filePath, 'utf8');
	const data = JSON.parse(fileContent);

	return decodeSkin(data.value.trim());
}

app.listen(Number(PORT), '0.0.0.0', () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});

function decodeSkin(base64: string): string {
	const decodedBuffer = Buffer.from(base64, 'base64').toString('utf-8');
	const parsedJson: DecodedSkinValue = JSON.parse(decodedBuffer);

	return parsedJson.textures.SKIN.url;
}

async function getOnlineUUID(username: string, format: boolean = true): Promise<string | undefined> {
	const url = `https://api.minecraftservices.com/minecraft/profile/lookup/name/${encodeURIComponent(username)}`;
	const response = await fetch(url);

	if (!response.ok || response.status === 204 || response.status === 404) {
		return;
	}

	const data = await response.json();
	if (!data.id || data.id.length !== 32) {
		return;
	}
	
	return format ? formatUUID(data.id) : data.id;
}

async function getOfflineUUID(username: string, format: boolean = true) {
	const digest = crypto.createHash("md5").update(`OfflinePlayer:${username}`, "utf8").digest();
	const bytes = Buffer.from(digest);

	bytes[6] = (bytes[6] & 0x0f) | 0x30;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;

	const hex = bytes.toString("hex");
	return format ? formatUUID(hex) : hex;
}

async function getOnlineSkinURL(username: string): Promise<string | null | undefined> {
	const uuid = await getOnlineUUID(username, false);
	if(!uuid) return null;

	const url = `https://sessionserver.mojang.com/session/minecraft/profile/${encodeURIComponent(username)}`;
	const response = await fetch(url);
	if (!response.ok || response.status === 204 || response.status === 404) {
		return null;
	}
	const data: MinecraftProfile = await response.json();
	const skindata = data.properties[0].value.trim()
	return decodeSkin(skindata);
}