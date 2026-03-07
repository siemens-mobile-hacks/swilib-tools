import os from "node:os";
import fs from "node:fs";
import path from "node:path";

export function getTempDir() {
	const tmpDir = `${os.tmpdir()}/swilib-tools-${process.getuid ? process.getuid() : os.userInfo().username}`;
	fs.mkdirSync(tmpDir, { recursive: true, mode: 0o700 });
	return tmpDir;
}

export async function cleanupTempDir() {
	const dir = getTempDir();
	const now = Date.now();
	const maxAgeMs = 1000 * 3600 * 24 * 7;

	const entries = await fs.promises.readdir(dir, { recursive: true, withFileTypes: true });
	for (const e of entries) {
		if (!e.isFile())
			continue;

		const filePath = path.join(dir, e.name);
		const st = await fs.promises.stat(filePath);

		if (now - Math.max(st.mtimeMs, st.atimeMs) > maxAgeMs) {
			try {
				await fs.promises.unlink(filePath);
			} catch { }
		}
	}
}
