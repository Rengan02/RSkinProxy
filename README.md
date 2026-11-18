# RSkinProxy

A lightweight Express service that serves [SkinsRestorer](https://github.com/SkinsRestorer/SkinsRestorer) data over HTTP.

## Installation

```bash
git clone https://github.com/Rengan02/RSkinProxy.git
cd RSkinProxy
npm install
```

Create a `.env` file in the root directory:

```env
PORT=3000
SKINRESTORER_PATH=/path/to/skinrestorer
```

## Usage

```bash
npm run build
npm start
```

For development:

```bash
npm run dev
```

## Endpoints

- `GET /skin/:uuid` - Returns the player skin.
- `GET /head/:uuid` - Returns the player head as a 128x128 PNG.