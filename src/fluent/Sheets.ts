/**
 * TODO: Describe file contents
 */
import sheetIds from '../../test/config';
import { GoogleSpreadsheet } from '../old/GoogleSpreadsheet';
import { ServiceAccountCredentials } from '../types';

export async function Sheets(
	sheetId: string,
	credentials?: ServiceAccountCredentials,
	worksheetId = 1,
) {
	const sheet = new GoogleSpreadsheet(sheetId);
	if (credentials) {
		await sheet.useServiceAccountAuth(credentials);
	}
	const info = await sheet.getInfo();
	return info.worksheets[worksheetId];
}
