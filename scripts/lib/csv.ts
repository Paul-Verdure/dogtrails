// Minimal RFC 4180 CSV helpers (no dependency): enough for our versioned extractions.

export function toCsv(rows: string[][]): string {
	const cell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);
	return rows.map((r) => r.map(cell).join(',')).join('\n') + '\n';
}

export function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quoted) {
			if (c === '"' && text[i + 1] === '"') {
				field += '"';
				i++;
			} else if (c === '"') quoted = false;
			else field += c;
		} else if (c === '"') quoted = true;
		else if (c === ',') {
			row.push(field);
			field = '';
		} else if (c === '\n') {
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else if (c !== '\r') field += c;
	}
	if (field !== '' || row.length) {
		row.push(field);
		rows.push(row);
	}
	return rows;
}
