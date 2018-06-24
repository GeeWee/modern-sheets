import { after, describe, before, it } from 'mocha';
import creds from './service-account-creds.json';
import sheet_ids from './config';
import { GoogleSpreadsheet } from '../index';
import _ from 'lodash';

import { should } from 'chai';
should();

const docs = {};
Object.keys(sheet_ids).forEach(key => {
	docs[key] = new GoogleSpreadsheet(sheet_ids[key]);
});
const doc = docs['private'];
let sheet;

const MAX_NUM = 5;
const NUMBERS = _.times(MAX_NUM);
const LETTERS = ['C', 'D', 'E', 'A', 'B'];

describe('Row-based feeds', function() {
	this.timeout(5000);

	before(async () => {
		await doc.useServiceAccountAuth(creds);
		sheet = await doc.addWorksheet({
			headers: ['col1', 'col2', 'col3'],
		});
	});

	after(async () => {
		return sheet.del();
	});

	describe('adding, updating, removing rows', () => {
		let row;

		it('can add a row', async () => {
			const new_data = {
				col1: 'c1',
				col2: 'c2',
				col3: 'c3',
			};

			row = await sheet.addRow(new_data);
			row.col1.should.equal(new_data.col1);
			row.col2.should.equal(new_data.col2);
			row.col3.should.equal(new_data.col3);
		});

		it('can update a row', async () => {
			row.col1 = 'col1-update';
			row.col2 = 'col2-update';
			return row.save();
		});

		it('persisted the row update', async () => {
			const rows = await sheet.getRows();
			rows.length.should.equal(1);
			rows[0].col1.should.equal(row.col1);
			rows[0].col2.should.equal(row.col2);
			rows[0].col3.should.equal(row.col3);
		});

		it('can write a formula', async () => {
			row.col1 = 1;
			row.col2 = 2;
			row.col3 = '=A2+B2';
			return row.save();
		});

		it('can read (only) the value from a formula', async () => {
			const rows = await sheet.getRows();
			rows[0].col3.should.equal('3');
		});

		_.each(
			{
				'new lines': 'new\n\nlines\n',
				'special chars': '∑πécial <> chårs = !\t',
			},
			(value, description) => {
				it('supports ' + description, async () => {
					row.col1 = value;
					await row.save();
					const rows = await sheet.getRows();
					rows.length.should.equal(1);
					rows[0].col1.should.equal(value);
				});
			},
		);

		it('can delete a row', async () => {
			await row.del();
			const rows = await sheet.getRows();
			rows.length.should.equal(0);
		});
	});

	describe('fetching rows', function() {
		// add 5 rows to use for read tests
		before(async () => {
			this.timeout(5000);

			for (const i of NUMBERS) {
				await sheet.addRow({
					col1: i,
					col2: LETTERS[i],
					col3: new Date().toISOString(),
				});
			}
		});

		it('can fetch multiple rows', async () => {
			const rows = await sheet.getRows();
			rows.length.should.equal(5);
		});

		it('supports `offset` option', async () => {
			const rows = await sheet.getRows({ offset: 3 });
			rows.length.should.equal(MAX_NUM - 3 + 1); //offset is inclusive
			rows[0].col1.should.equal('2');
		});

		it('supports `limit` option', async () => {
			const rows = await sheet.getRows({ limit: 3 });
			rows.length.should.equal(3);
			rows[0].col1.should.equal('0');
		});

		it('supports `orderby` option', async () => {
			const rows = await sheet.getRows({ orderby: 'col2' });
			rows.length.should.equal(5);
			_.map(rows, 'col2').should.deep.equal(_.sortBy(LETTERS));
		});

		// GOOGLE HAS A KNOWN BUG WITH THIS!
		// see: http://stackoverflow.com/questions/32272783/google-sheets-api-reverse-order-parameter-ignored/34805432#34805432
		it.skip('supports `reverse` option', async () => {
			const rows = await sheet.getRows({ reverse: true });
			rows.length.should.equal(5);
			rows[0].col1.should.equal('4');
		});

		it('supports `query` option', async () => {
			const rows = await sheet.getRows({ query: 'col1>=2 and col1<4' });
			rows.length.should.equal(2);
			_.map(rows, 'col1').should.include.members(['2', '3']);
		});

		it('supports `orderby`+`reverse` option', async () => {
			const rows = await sheet.getRows({ orderby: 'col2', reverse: true });
			rows.length.should.equal(5);
			_.map(rows, 'col2').should.deep.equal(_.sortBy(LETTERS).reverse());
		});

		it('supports `orderby`+`limit` option', async () => {
			const rows = await sheet.getRows({ orderby: 'col2', limit: 2 });
			rows.length.should.equal(2);
			_.map(rows, 'col2').should.deep.equal(_.sortBy(LETTERS).slice(0, 2));
		});

		// we could add more tests here, but it seems a bit unnecessary
		// as it would just be testing google's API
	});
});
