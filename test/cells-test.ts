import { after, describe, before, it } from 'mocha';

import {GoogleSpreadsheet} from '../index';

import creds from './service-account-creds.json';
import sheet_ids from './config';
import _ from 'lodash';
import async from 'async';

import { should, assert } from 'chai';
should();

const docs = {};
Object.keys(sheet_ids).forEach(key => {
  docs[key] = new GoogleSpreadsheet(sheet_ids[key]);
});
const doc = docs['private'];
let sheet;

const NUM_ROWS = 10;
const NUM_COLS = 10;

describe('Cell-based feeds', function() {
  this.timeout(5000);

  before(done => {
    async.series({
      setupAuth: step => {
        doc.useServiceAccountAuth(creds, step);
      },
      addSheet: step => {
        doc.addWorksheet({
          rowCount: NUM_ROWS,
          colCount: NUM_COLS
        }, (err, _sheet) => {
          sheet = _sheet;
          step(err);
        });
      }
    }, done);
  });

  after(done => {
    sheet.del(done);
  });

  describe('getCells params', () => {
    it('fetches an empty array if sheet is empty', done => {
      sheet.getCells({}, (err, cells) => {
        cells.length.should.equal(0);
        done(err);
      });
    });

    it('fetches entire sheet if `return-empty` is true', done => {
      sheet.getCells({'return-empty': true}, (err, cells) => {
        cells.length.should.equal(NUM_ROWS * NUM_COLS);
        done(err);
      });
    });

    it('respects `min-row`', done => {
      sheet.getCells({'return-empty': true, 'min-row': 2}, (err, cells) => {
        cells.length.should.equal((NUM_ROWS - 2 + 1) * NUM_COLS);
        done(err);
      });
    });

    it('respects `max-row`', done => {
      sheet.getCells({'return-empty': true, 'max-row': 5}, (err, cells) => {
        cells.length.should.equal(5 * NUM_COLS);
        done(err);
      });
    });

    it('respects `min-col`', done => {
      sheet.getCells({'return-empty': true, 'min-col': 2}, (err, cells) => {
        cells.length.should.equal((NUM_COLS - 2 + 1) * NUM_ROWS);
        done(err);
      });
    });

    it('respects `max-col`', done => {
      sheet.getCells({'return-empty': true, 'max-col': 5}, (err, cells) => {
        cells.length.should.equal(5 * NUM_ROWS);
        done(err);
      });
    });

    it('respects combined min/max params', done => {
      sheet.getCells({
        'return-empty': true,
        'min-row': 2,
        'max-row': 4,
        'min-col': 5,
        'max-col': 8
      }, (err, cells) => {
        cells.length.should.equal((4-2+1) * (8-5+1));
        done(err);
      });
    });

    it('handles requests outisde the bounds of the sheet', done => {
      sheet.getCells({
        'return-empty': true,
        'max-row': 1,
        'max-col': NUM_COLS+1
      }, (err: Error, cells) => {
        err.should.be.an('Error');
        //TODO FIX THIS LAST ERROR HERE
          err.message.should.include('max-col');
        done();
      });
    });
  });

  describe('manipulating cell data', () => {
	  let cell;
	
	  before(done => {
      sheet.getCells({
        'return-empty': true
      }, (err, cells) => {
        cell = cells[0];
        done(err);
      });
    });

    it('has row and column numbers', done => {
      sheet.getCells({}, (err, new_cells) => {
        cell.row.should.equal(1);
        cell.col.should.equal(1);
        done(err);
      });
    });

    it('can update a single cell by calling `setValue`', done => {
      cell.setValue('HELLO', err => {
        assert.notExists(err);
        cell.value.should.equal('HELLO');
        sheet.getCells({}, (err, cells) => {
          cells[0].value.should.equal('HELLO');
          done(err);
        });
      });
    });

    it('can update a single cell by `save`', done => {
      cell.value = 'GOODBYE';
      cell.save(err => {
        assert.notExists(err);
        cell.value.should.equal('GOODBYE');
        sheet.getCells({}, (err, cells) => {
          cells[0].value.should.equal('GOODBYE');
          done(err);
        });
      });
    });

    it('supports `value` to numeric values', done => {
      cell.value = 123;
      cell.value.should.equal('123');
      cell.numericValue.should.equal(123);
      (cell.formula === undefined).should.be.true;

      cell.save(err => {
        assert.notExists(err);
        cell.value.should.equal('123');
        cell.numericValue.should.equal(123);
        (cell.formula === undefined).should.be.true;
        done();
      });
    });

    it('supports setting `numericValue`', done => {
      cell.numericValue = 456;
      cell.value.should.equal('456');
      cell.numericValue.should.equal(456);
      (cell.formula === undefined).should.be.true;

      cell.save(err => {
        assert.notExists(err);
        cell.value.should.equal('456');
        cell.numericValue.should.equal(456);
        (cell.formula === undefined).should.be.true;
        done();
      });
    });

    it('throws an error if an invalid `numericValue` is set', () => {
	    let err;
	    try {
        cell.numericValue = 'abc';
      } catch (_err) { err = _err; }
      err.should.be.an('Error');
    });

    it('supports non-numeric values', done => {
      cell.value = 'ABC';
      cell.value.should.equal('ABC');
      (cell.numericValue === undefined).should.be.true;
      (cell.formula === undefined).should.be.true;

      cell.save(err => {
        assert.notExists(err);
        cell.value.should.equal('ABC');
        (cell.numericValue === undefined).should.be.true;
        (cell.formula === undefined).should.be.true;
        done();
      });
    });

    it('throws an error if setting an invalid formula', () => {
	    let err;
	    try {
        cell.formula = 'This is not a formula';
      } catch (_err) { err = _err; }
      err.should.be.an('Error');
    });

    it('supports formulas that resolve to a numeric value', done => {
      cell.formula = '=ROW()';
      (cell.numericValue === undefined).should.be.true;
      cell.value.should.equal('*SAVE TO GET NEW VALUE*');
      cell.formula.should.equal('=ROW()');
      cell.save(err => {
        assert.notExists(err);
        cell.value.should.equal('1');
        cell.numericValue.should.equal(1);
        cell.formula.should.equal('=ROW()');
        done();
      });
    });

    it('persists the new formula value', done => {
      sheet.getCells({}, (err, cells) => {
        cells[0].value.should.equal('1');
        cells[0].numericValue.should.equal(1);
        cells[0].formula.should.equal('=ROW()');
        done(err);
      });
    });

    it('supports formulas that resolve to non-numeric values', done => {
      cell.formula = '=IF(TRUE, "ABC", "DEF")';
      cell.save(err => {
        assert.notExists(err);
        cell.value.should.equal('ABC');
        (cell.numericValue === undefined).should.be.true;
        cell.formula.should.equal('=IF(TRUE, "ABC", "DEF")');
        done();
      });
    });

    it('supports setting the formula via the `value` property', done => {
      cell.value = '=COLUMN()';
      cell.value.should.equal('*SAVE TO GET NEW VALUE*');
      cell.formula.should.equal('=COLUMN()');
      (cell.numericValue === undefined).should.be.true;
      cell.save(err => {
        assert.notExists(err);
        cell.value.should.equal('1');
        cell.numericValue.should.equal(1);
        cell.formula.should.equal('=COLUMN()');
        done();
      });
    });

    it('supports clearing the `value`', done => {
      cell.value = '4';
      cell.value = '';
      cell.value.should.equal('');
      (cell.numericValue === undefined).should.be.true;
      (cell.formula === undefined).should.be.true;

      cell.save(err => {
        assert.notExists(err);
        cell.value.should.equal('');
        (cell.numericValue === undefined).should.be.true;
        (cell.formula === undefined).should.be.true;
        done();
      });
    });

    it('can update a single cell with linefeed in value', done => {
      cell.setValue('HELLO\nWORLD', err => {
        assert.notExists(err);
        cell.value.should.equal('HELLO\nWORLD');
        sheet.getCells({}, (err, cells) => {
          cells[0].value.should.equal('HELLO\nWORLD');
          done(err);
        });
      });
    });
  });

  describe('bulk cell updates', () => {
	  let cells;
	
	  before(done => {
      sheet.getCells({
        'return-empty': true
      }, (err, _cells) => {
        cells = _cells.slice(0,4);
        done(err);
      });
    });

    it('succeeds if no cells need an update', done => {
      sheet.bulkUpdateCells(cells, err => {
        assert.notExists(err);
        done();
      })
    });

    it('can update multiple cells at once', done => {
      cells[0].value = 1;
      cells[1].value = '2';
      cells[2].formula = '=A1+B1';
      sheet.bulkUpdateCells(cells, err => {
        assert.notExists(err);
        cells[0].numericValue.should.equal(1);
        cells[1].numericValue.should.equal(2);
        cells[2].numericValue.should.equal(3);
        done();
      })
    });
  });

});
