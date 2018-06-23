import { after, describe, before, it } from 'mocha';

import creds from './service-account-creds.json';
import sheet_ids from './config';
import { GoogleSpreadsheet } from '../index';
import _ from 'lodash';
import async from 'async';

import { should, assert } from 'chai';

should();

const docs = {};
Object.keys(sheet_ids).forEach(key => {
	docs[key] = new GoogleSpreadsheet(sheet_ids[key]);
});
const doc = docs['private'];

describe('Managing doc info and sheets', function () {
	this.timeout(5000);
	
	before(done => {
		doc.useServiceAccountAuth(creds, done);
	});
	
	describe('get doc info', () => {
		let info;
		
		it('can fetch the doc info', done => {
			doc.getInfo((err, _info) => {
				assert.notExists(err);
				info = _info;
				done();
			});
		});
		
		it('should have the doc id', () => {
			info.id.should.equal('https://spreadsheets.google.com/feeds/worksheets/' + sheet_ids['private'] + '/private/full')
		});
		
		it('should include the document title', () => {
			info.title.should.be.a.string;
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
		
		after(done => {
			async.each(sheets_to_remove, (sheet, nextSheet) => {
				sheet.del(nextSheet);
			}, done);
		});
		
		it('can add a worksheet', done => {
			doc.addWorksheet({
				title: sheet_title,
				colCount: 10
			}, (err, _sheet) => {
				assert.notExists(err);
				sheet = _sheet;
				sheet.title.should.equal(sheet_title);
				
				// check if the sheet is really there
				doc.getInfo((err, info) => {
					assert.notExists(err);
					const added_sheet = info.worksheets.pop();
					added_sheet.title.should.equal(sheet_title);
					done();
				});
			});
		});
		
		it('can set the header row of a worksheet', done => {
			const header_vals = ['x1', 'x2', 'x3', 'x4', 'x5'];
			sheet.setHeaderRow(header_vals, err => {
				sheet.getCells((err, cells) => {
					assert.notExists(err);
					cells.length.should.equal(5);
					_.times(header_vals.length, i => {
						cells[i].value.should.equal(header_vals[i]);
					});
					done();
				});
			});
		});
		
		it('clears the rest of the header row when setting headers', done => {
			const header_vals = ['x1', 'x2'];
			sheet.setHeaderRow(header_vals, err => {
				assert.notExists(err);
				sheet.getCells((err, cells) => {
					assert.notExists(err);
					// only returns cells with values in them
					cells.length.should.equal(2);
					done();
				});
			});
		});
		
		it('can clear a worksheet', done => {
			sheet.clear(err => {
				assert.notExists(err);
				sheet.getCells((err, cells) => {
					assert.notExists(err);
					// only returns cells with values in them
					cells.length.should.equal(0);
					done();
				});
			});
		});
		
		it('can resize a worksheet', done => {
			sheet.resize({rowCount: 5, colCount: 7}, err => {
				assert.notExists(err);
				doc.getInfo((err, info) => {
					assert.notExists(err);
					const last_sheet = info.worksheets.pop();
					last_sheet.rowCount.should.equal(5);
					last_sheet.colCount.should.equal(7);
					done();
				});
			});
		});
		
		it('can set the title of a worksheet', done => {
			const new_title = 'New title ' + (+new Date());
			sheet.setTitle(new_title, err => {
				assert.notExists(err);
				doc.getInfo((err, info) => {
					assert.notExists(err);
					const last_sheet = info.worksheets.pop();
					last_sheet.title.should.equal(new_title);
					done();
				});
			});
		});
		
		it('can delete a worksheet with `SpreadsheetWorksheet.del()`', done => {
			sheet.del(err => {
				assert.notExists(err);
				// check if the sheet is really gone
				doc.getInfo((err, info) => {
					assert.notExists(err);
					assert.notExists(err); //null
					const last_sheet = info.worksheets.pop();
					last_sheet.title.should.not.equal(sheet_title);
					done();
				});
			});
		});
		
		it('can delete a worksheet with `GoogleSpreadsheet.removeWorksheet()` passing the sheet object', done => {
			doc.addWorksheet({
				title: sheet_title,
				colCount: 10
			}, (err, _sheet) => {
				assert.notExists(err);
				doc.removeWorksheet(_sheet, err => {
					assert.notExists(err);
					doc.getInfo((err, info) => {
						assert.notExists(err);
						const last_sheet = info.worksheets.pop();
						last_sheet.title.should.not.equal(sheet_title);
						done();
					});
				});
			});
		});
		
		it('can delete a worksheet with `GoogleSpreadsheet.removeWorksheet()` passing the sheet ID', done => {
			doc.addWorksheet({
				title: sheet_title,
				colCount: 10
			}, (err, _sheet) => {
				assert.notExists(err);
				doc.removeWorksheet(_sheet.id, err => {
					assert.notExists(err);
					doc.getInfo((err, info) => {
						assert.notExists(err);
						const last_sheet = info.worksheets.pop();
						last_sheet.title.should.not.equal(sheet_title);
						done();
					});
				});
			});
		});
		
		it('can delete a worksheet with `GoogleSpreadsheet.removeWorksheet()` passing the index of the sheet', done => {
			doc.addWorksheet({
				title: sheet_title,
				colCount: 10
			}, (err, _sheet) => {
				assert.notExists(err);
				
				doc.getInfo((err, info) => {
					assert.notExists(err);
					const sheet_index = info.worksheets.length;
					
					doc.removeWorksheet(sheet_index, err => {
						assert.notExists(err);
						doc.getInfo((err, info) => {
							assert.notExists(err);
							const last_sheet = info.worksheets.pop();
							last_sheet.title.should.not.equal(sheet_title);
							done();
						});
					});
				});
			});
		});
		
		it('can add a sheet with specific number of rows and columns', done => {
			doc.addWorksheet({
				title: sheet_title,
				rowCount: 17,
				colCount: 13
			}, (err, sheet) => {
				assert.notExists(err);
				sheets_to_remove.push(sheet);
				
				doc.getInfo((err, info) => {
					assert.notExists(err);
					const new_sheet = info.worksheets.pop();
					new_sheet.rowCount.should.equal(17);
					new_sheet.colCount.should.equal(13);
					done();
				});
			});
		});
		
		it('can specify column headers while adding a sheet', done => {
			doc.addWorksheet({
				headers: ['header1', 'header2', 'header3']
			}, (err, sheet) => {
				assert.notExists(err);
				sheets_to_remove.push(sheet);
				sheet.getCells((err, cells) => {
					assert.notExists(err);
					cells.length.should.equal(3);
					cells[0].value.should.equal('header1');
					cells[1].value.should.equal('header2');
					cells[2].value.should.equal('header3');
					done();
				});
			});
		});
	});
});
