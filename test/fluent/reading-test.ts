/**
 * TODO: Describe file contents
 */

import { after, describe, before, it } from 'mocha';
import { should, expect, default as chai } from 'chai';
import { GoogleSpreadsheet } from '../../src/old/GoogleSpreadsheet';
import { IndexSignature } from '../../src/types';
import { SpreadsheetWorksheet } from '../../src/old/SpreadsheetWorksheet';
import { SpreadsheetCell } from '../../src/old/SpreadsheetCell';
import cap from 'chai-as-promised';
import { Sheets } from '../../src/fluent/Sheets';
chai.use(cap);
should();

describe('Should be able to read stuff from a sheet', function() {
	this.timeout(5000);

	it('Should be able to read from a sheet with auth', async () => {
		const worksheet = await Sheets(
			'1LG6vqg6ezQpIXr-SIDDWQAc9mLNSXasboDR7MUbLvZw',
		);
		worksheet.addRow({});
	});
});
