/**
 * TODO: Describe file contents
 */
import sheetIds from '../../test/config';
import { GoogleSpreadsheet } from '../old/GoogleSpreadsheet';
import { AuthCredentials, ServiceAccountCredentials } from '../types';
import { SpreadsheetWorksheet } from '../old/SpreadsheetWorksheet';

export function Sheets(id: string) {
	const actions: Function[] = [];
	const sheet = new GoogleSpreadsheet(id);

	return {
		withAuthentication: (creds: ServiceAccountCredentials) => {
			actions.push(() => sheet.useServiceAccountAuth(creds));
			return worksheetPicker(actions, sheet);
		},

		withoutAuth: () => {
			return worksheetPicker(actions, sheet);
		},
	};
}

function worksheetPicker(actions: Function[], sheet: GoogleSpreadsheet) {
	return {
		worksheet: (id: number) => {
			actions.push(async () => {
				const info = await sheet.getInfo();
				return info.worksheets[id];
			});
			return worksheetProxy(actions);
		},
	};
}

function worksheetProxy(actions: Function[]) {
	return {
		get: async () => {
			let res;
			//Get sheet in proper state
			for (const action of actions) {
				res = await action(); // Grab the ast res, which is the worksheet
			}
			const worksheet = res as SpreadsheetWorksheet;
			return worksheet;
		},
	};
}
