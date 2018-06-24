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
import { Sheets, sheetsBuilder } from '../../src/fluent/Sheets';
chai.use(cap);
should();

describe('Should be able to read stuff from a sheet', function() {
	this.timeout(5000);

	it('test', async () => {
		const worksheet = await sheetsBuilder(
			'1LG6vqg6ezQpIXr-SIDDWQAc9mLNSXasboDR7MUbLvZw',
		)
			.withoutAuth()
			.worksheet(1)
			.get();

		//console.log(worksheet);
		const row = await worksheet.addRow({
			c1: 23,
		});
		console.log(row);
	});
});
