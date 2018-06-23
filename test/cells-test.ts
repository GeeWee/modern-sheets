import { after, describe, before, it } from 'mocha';

import { GoogleSpreadsheet } from '../index';

import creds from './service-account-creds.json';
import sheet_ids from './config';
import _ from 'lodash';
import async from 'async';

import { should, assert, expect } from 'chai';

should();

const docs = {};
Object.keys(sheet_ids).forEach(key => {
	docs[key] = new GoogleSpreadsheet(sheet_ids[key]);
});
const doc = docs['private'];
let sheet;

const NUM_ROWS = 10;
const NUM_COLS = 10;

describe('Cell-based feeds', function () {
	this.timeout(5000);
	
	//todo refactor
	before(async () => {
		await doc.useServiceAccountAuth(creds);
		const _sheet = await doc.addWorksheet({
			rowCount: NUM_ROWS,
			colCount: NUM_COLS
		});
		sheet = _sheet;
	});
	
	after(async () => {
		return sheet.del();
	});
	
	describe('getCells params', () => {
		it('fetches an empty array if sheet is empty', async () => {
			const cells = await sheet.getCells({});
			cells.length.should.equal(0);
		});
		
		it('fetches entire sheet if `return-empty` is true', async () => {
			const cells = await sheet.getCells({'return-empty': true});
			cells.length.should.equal(NUM_ROWS * NUM_COLS);
		});
		
		it('respects `min-row`', async () => {
			const cells = await sheet.getCells({'return-empty': true, 'min-row': 2});
			cells.length.should.equal((NUM_ROWS - 2 + 1) * NUM_COLS);
		});
		
		it('respects `max-row`', async () => {
			const cells = await sheet.getCells({'return-empty': true, 'max-row': 5});
			cells.length.should.equal(5 * NUM_COLS);
		});
		
		it('respects `min-col`', async () => {
			const cells = await sheet.getCells({'return-empty': true, 'min-col': 2});
			cells.length.should.equal((NUM_COLS - 2 + 1) * NUM_ROWS);
		});
		
		it('respects `max-col`', async () => {
			const cells = await sheet.getCells({'return-empty': true, 'max-col': 5});
			cells.length.should.equal(5 * NUM_ROWS);
		});
		
		it('respects combined min/max params', async () => {
			const cells = await sheet.getCells({
				'return-empty': true,
				'min-row': 2,
				'max-row': 4,
				'min-col': 5,
				'max-col': 8
			});
			cells.length.should.equal((4 - 2 + 1) * (8 - 5 + 1));
		});
		
		it('handles requests outisde the bounds of the sheet', async () => {
			return expect(sheet.getCells({
				'return-empty': true,
				'max-row': 1,
				'max-col': NUM_COLS + 1
			}))
				.to.be.rejectedWith('max-col');
		});
	});
	
	describe('manipulating cell data', () => {
		let cell;
		
		before(async () => {
			const cells = await sheet.getCells({
				'return-empty': true
			});
			cell = cells[0];
		});
		
		it('has row and column numbers', async () => {
			const cells = await sheet.getCells({}); //todo wtf
			cell.row.should.equal(1);
			cell.col.should.equal(1);
		});
		
		it('can update a single cell by calling `setValue`', async () => {
			await cell.setValue('HELLO');
			cell.value.should.equal('HELLO');
			
			const cells = await sheet.getCells({});
			cells[0].value.should.equal('HELLO');
		});
		
		it('can update a single cell by `save`', async () => {
			cell.value = 'GOODBYE';
			await cell.save();
			cell.value.should.equal('GOODBYE');
			const cells = await sheet.getCells({});
			cells[0].value.should.equal('GOODBYE');
		});
		
		it('supports `value` to numeric values', async () => {
			cell.value = 123;
			cell.value.should.equal('123');
			cell.numericValue.should.equal(123);
			(cell.formula === undefined).should.be.true;
			
			await cell.save();
			cell.value.should.equal('123');
			cell.numericValue.should.equal(123);
			(cell.formula === undefined).should.be.true;
		});
		
		it('supports setting `numericValue`', async () => {
			cell.numericValue = 456;
			cell.value.should.equal('456');
			cell.numericValue.should.equal(456);
			(cell.formula === undefined).should.be.true;
			
			await cell.save();
			cell.value.should.equal('456');
			cell.numericValue.should.equal(456);
			(cell.formula === undefined).should.be.true;
		});
		
		it('throws an error if an invalid `numericValue` is set', () => {
			let err;
			
			try {
				cell.numericValue = 'abc';
			} catch (_err) {
				err = _err;
			}
			err.should.be.an('Error');
		});
		
		it('supports non-numeric values', async () => {
			cell.value = 'ABC';
			cell.value.should.equal('ABC');
			(cell.numericValue === undefined).should.be.true;
			(cell.formula === undefined).should.be.true;
			
			await cell.save();
			cell.value.should.equal('ABC');
			(cell.numericValue === undefined).should.be.true;
			(cell.formula === undefined).should.be.true;
		});
		
		it('throws an error if setting an invalid formula', () => {
			let err;
			try {
				cell.formula = 'This is not a formula';
			} catch (_err) {
				err = _err;
			}
			err.should.be.an('Error');
		});
		
		it('supports formulas that resolve to a numeric value', async () => {
			cell.formula = '=ROW()';
			(cell.numericValue === undefined).should.be.true;
			cell.value.should.equal('*SAVE TO GET NEW VALUE*');
			cell.formula.should.equal('=ROW()');
			await cell.save();
			cell.value.should.equal('1');
			cell.numericValue.should.equal(1);
			cell.formula.should.equal('=ROW()');
		});
		
		it('persists the new formula value', async () => {
			const cells = await sheet.getCells({});
			cells[0].value.should.equal('1');
			cells[0].numericValue.should.equal(1);
			cells[0].formula.should.equal('=ROW()');
		});
		
		it('supports formulas that resolve to non-numeric values', async () => {
			cell.formula = '=IF(TRUE, "ABC", "DEF")';
			await cell.save();
			cell.value.should.equal('ABC');
			(cell.numericValue === undefined).should.be.true;
			cell.formula.should.equal('=IF(TRUE, "ABC", "DEF")');
		});
		
		it('supports setting the formula via the `value` property', async () => {
			cell.value = '=COLUMN()';
			cell.value.should.equal('*SAVE TO GET NEW VALUE*');
			cell.formula.should.equal('=COLUMN()');
			(cell.numericValue === undefined).should.be.true;
			await cell.save();
			cell.value.should.equal('1');
			cell.numericValue.should.equal(1);
			cell.formula.should.equal('=COLUMN()');
		});
		
		it('supports clearing the `value`', async () => {
			cell.value = '4';
			cell.value = '';
			cell.value.should.equal('');
			(cell.numericValue === undefined).should.be.true;
			(cell.formula === undefined).should.be.true;
			
			await cell.save();
			cell.value.should.equal('');
			(cell.numericValue === undefined).should.be.true;
			(cell.formula === undefined).should.be.true;
		});
		
		it('can update a single cell with linefeed in value', async () => {
			await cell.setValue('HELLO\nWORLD');
			cell.value.should.equal('HELLO\nWORLD');
			const cells = await sheet.getCells({});
			cells[0].value.should.equal('HELLO\nWORLD');
		});
	});
	
	describe('bulk cell updates', () => {
		let cells;
		
		before(async () => {
			const _cells = await sheet.getCells({
				'return-empty': true
			});
			cells = _cells.slice(0, 4);
		});
		
		it('succeeds if no cells need an update', async () => {
			return sheet.bulkUpdateCells(cells);
		});
		
		it('can update multiple cells at once', async () => {
			cells[0].value = 1;
			cells[1].value = '2';
			cells[2].formula = '=A1+B1';
			await sheet.bulkUpdateCells(cells);
			cells[0].numericValue.should.equal(1);
			cells[1].numericValue.should.equal(2);
			cells[2].numericValue.should.equal(3);
		});
	});
});
