import { after, describe, before, it } from 'mocha';

import creds from './service-account-creds.json';
import sheet_ids from './config';
import { GoogleSpreadsheet } from '../index';
import _ from 'lodash';

import { should} from 'chai';

should();

const docs = {};
Object.keys(sheet_ids).forEach(key => {
	docs[key] = new GoogleSpreadsheet(sheet_ids[key]);
});
const doc = docs['private'];

describe('Managing doc info and sheets', function () {
	this.timeout(5000);
	
	before(async () => {
		return doc.useServiceAccountAuth(creds);
	});
	
	describe('get doc info', () => {
		let info;
		
		it('can fetch the doc info', async () => {
			info = await doc.getInfo();
		});
		
		it('should have the doc id', () => {
			info.id.should.equal('https://spreadsheets.google.com/feeds/worksheets/' + sheet_ids['private'] + '/private/full')
		});
		
		it('should include the document title', () => {
			info.title.should.be.a('string'); //todo changed
		});
		
		it('should include author metadata', () => {
			info.author.name.should.equal('theozero');
			info.author.email.should.equal('theozero@gmail.com');
		});
		
		it('should include updated timestamp', () => {
			info.updated.should.match(/\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d\.\d\d\dZ/);
			new Date(info.updated).should.be.a('Date');
		});
		
		it('should include worksheets', () => {
			info.worksheets.should.have.length.above(0);
			const sheet = info.worksheets[0];
			sheet.url.should.include(sheet_ids['private']);
			sheet.title.should.be.a.string;
			sheet.rowCount.should.be.a('number');
			sheet.colCount.should.be.a('number');
		});
	});
	
	describe('adding, removing, and modifying worksheets', () => {
		const sheet_title = 'Test sheet ' + (+new Date());
		let sheet;
		const sheets_to_remove = [];
		
		after(async () => {
			for (const sheet of sheets_to_remove){
				await sheet.del(sheet);
			}
		});
		
		it('can add a worksheet', async () => {
			sheet = await doc.addWorksheet({
				title: sheet_title,
				colCount: 10
			});
				sheet.title.should.equal(sheet_title);
				
				// check if the sheet is really there
				const info = await doc.getInfo();
					const added_sheet = info.worksheets.pop();
					added_sheet.title.should.equal(sheet_title);
		});
		
		it('can set the header row of a worksheet', async () => {
			const header_vals = ['x1', 'x2', 'x3', 'x4', 'x5'];
			await sheet.setHeaderRow(header_vals);
				const cells = await sheet.getCells();
					cells.length.should.equal(5);
					_.times(header_vals.length, i => {
						cells[i].value.should.equal(header_vals[i]);
					});
		});
		
		it('clears the rest of the header row when setting headers', async () => {
			const header_vals = ['x1', 'x2'];
			await sheet.setHeaderRow(header_vals);
			const cells = await sheet.getCells();
					// only returns cells with values in them
					cells.length.should.equal(2);
		});
		
		it('can clear a worksheet', async () => {
			await sheet.clear();
				const cells = await sheet.getCells();
					// only returns cells with values in them
					cells.length.should.equal(0);
		});
		
		it('can resize a worksheet', async () => {
			await sheet.resize({rowCount: 5, colCount: 7});
				const info = await doc.getInfo();
					const last_sheet = info.worksheets.pop();
					last_sheet.rowCount.should.equal(5);
					last_sheet.colCount.should.equal(7);
		});
		
		it('can set the title of a worksheet', async () => {
			const new_title = 'New title ' + (+new Date());
			await sheet.setTitle(new_title);
			const info = await doc.getInfo();
					const last_sheet = info.worksheets.pop();
					last_sheet.title.should.equal(new_title);
		});
		
		it('can delete a worksheet with `SpreadsheetWorksheet.del()`', async () => {
			await sheet.del();
				// check if the sheet is really gone
				const info = await doc.getInfo();
					const last_sheet = info.worksheets.pop();
					last_sheet.title.should.not.equal(sheet_title);
		});
		
		it('can delete a worksheet with `GoogleSpreadsheet.removeWorksheet()` passing the sheet object', async () => {
			const newSheet = await doc.addWorksheet({
				title: sheet_title,
				colCount: 10
			});
				await doc.removeWorksheet(newSheet);
					const info = await doc.getInfo();
						const last_sheet = info.worksheets.pop();
						last_sheet.title.should.not.equal(sheet_title);
		});
		
		it('can delete a worksheet with `GoogleSpreadsheet.removeWorksheet()` passing the sheet ID', async () => {
			const newSheet = await doc.addWorksheet({
				title: sheet_title,
				colCount: 10
			});
				await doc.removeWorksheet(newSheet.id);
					const info = await doc.getInfo();
						const last_sheet = info.worksheets.pop();
						last_sheet.title.should.not.equal(sheet_title);
					});
		
		it('can delete a worksheet with `GoogleSpreadsheet.removeWorksheet()` passing the index of the sheet', async () => {
			await doc.addWorksheet({
				title: sheet_title,
				colCount: 10
			});
				const info = await doc.getInfo();
					const sheet_index = info.worksheets.length;
					
					await doc.removeWorksheet(sheet_index);
						const newInfo = await doc.getInfo();
							const last_sheet = newInfo.worksheets.pop();
							last_sheet.title.should.not.equal(sheet_title);
		});
		
		it('can add a sheet with specific number of rows and columns', async () => {
			const sheet = await doc.addWorksheet({
				title: sheet_title,
				rowCount: 17,
				colCount: 13
			});
				sheets_to_remove.push(sheet);
				
				const info = await doc.getInfo();
					const new_sheet = info.worksheets.pop();
					new_sheet.rowCount.should.equal(17);
					new_sheet.colCount.should.equal(13);
		});
		
		it('can specify column headers while adding a sheet', async () => {
			const sheet = await doc.addWorksheet({
				headers: ['header1', 'header2', 'header3']
			});
				sheets_to_remove.push(sheet);
				const cells = await sheet.getCells();
					cells.length.should.equal(3);
					cells[0].value.should.equal('header1');
					cells[1].value.should.equal('header2');
					cells[2].value.should.equal('header3');
		}   );
	});
});
