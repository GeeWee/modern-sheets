import asynclib from 'async';
import { after, describe, before, it } from 'mocha';
import creds from './service-account-creds.json';
import sheet_ids from './config';
import {GoogleSpreadsheet} from '../index';
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

  before(done => {
    asynclib.series({
      setupAuth: step => {
        doc.useServiceAccountAuth(creds, step);
      },
      addSheet: step => {
        doc.addWorksheet({
          headers: ['col1', 'col2', 'col3']
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

  describe('adding, updating, removing rows', () => {
	  let row;
	
	  it('can add a row', done => {
	    const new_data = {
		    col1: 'c1',
		    col2: 'c2',
		    col3: 'c3'
	    };
	
	    sheet.addRow(new_data, (err, _row) => {
        (err == null).should.be.true;
        row = _row;
        row.col1.should.equal(new_data.col1);
        row.col2.should.equal(new_data.col2);
        row.col3.should.equal(new_data.col3);
        done();
      });
    });

    it('can update a row', done => {
      row.col1 = 'col1-update';
      row.col2 = 'col2-update';
      row.save(err => {
        (err == null).should.be.true;
        done();
      });
    });

    it('persisted the row update', done => {
      sheet.getRows((err, rows) => {
        rows.length.should.equal(1);
        rows[0].col1.should.equal(row.col1);
        rows[0].col2.should.equal(row.col2);
        rows[0].col3.should.equal(row.col3);
        done(err);
      });
    });

    it('can write a formula', done => {
      row.col1 = 1;
      row.col2 = 2;
      row.col3 = '=A2+B2';
      row.save(done);
    });

    it('can read (only) the value from a formula', done => {
      sheet.getRows((err, rows) => {
        rows[0].col3.should.equal('3');
        done(err);
      });
    });

    _.each({
      'new lines': "new\n\nlines\n",
      'special chars': "∑πécial <> chårs = !\t"
    }, (value, description) => {
      it('supports '+description, done => {
        row.col1 = value;
        row.save(err => {
          (err == null).should.be.true;
          sheet.getRows((err, rows) => {
            rows.length.should.equal(1);
            rows[0].col1.should.equal(value);
            done(err);
          });
        });
      });
    });

    it('can delete a row', done => {
      row.del(err => {
        (err == null).should.be.true;
        sheet.getRows((err, rows) => {
          rows.length.should.equal(0);
          done(err);
        });
      });
    });
  });

  describe('fetching rows', function() {
    // add 5 rows to use for read tests
    before(function(done) {
      this.timeout(5000);
      asynclib.eachSeries(NUMBERS, (i, nextVal) => {
        sheet.addRow({
          col1: i,
          col2: LETTERS[i],
          col3: (new Date()).toISOString()
        }, nextVal);
      }, done);
    });

    it('can fetch multiple rows', done => {
      sheet.getRows((err, rows) => {
        rows.length.should.equal(5);
        done(err);
      });
    });

    it('supports `offset` option', done => {
      sheet.getRows({offset: 3}, (err, rows) => {
        rows.length.should.equal(MAX_NUM - 3 + 1); //offset is inclusive
        rows[0].col1.should.equal('2');
        done(err);
      });
    });

    it('supports `limit` option', done => {
      sheet.getRows({limit: 3}, (err, rows) => {
        rows.length.should.equal(3);
        rows[0].col1.should.equal('0');
        done(err);
      });
    });

    it('supports `orderby` option', done => {
      sheet.getRows({orderby: 'col2'}, (err, rows) => {
        rows.length.should.equal(5);
        _.map(rows, 'col2').should.deep.equal(_.sortBy(LETTERS));
        done(err);
      });
    });


    // GOOGLE HAS A KNOWN BUG WITH THIS!
    // see: http://stackoverflow.com/questions/32272783/google-sheets-api-reverse-order-parameter-ignored/34805432#34805432
    it.skip('supports `reverse` option', done => {
      sheet.getRows({reverse: true}, (err, rows) => {
        rows.length.should.equal(5);
        rows[0].col1.should.equal('4');
        done(err);
      });
    });

    it('supports `query` option', done => {
      sheet.getRows({query: 'col1>=2 and col1<4'}, (err, rows) => {
        rows.length.should.equal(2);
        _.map(rows, 'col1').should.include.members(['2', '3']);
        done(err);
      });
    });

    it('supports `orderby`+`reverse` option', done => {
      sheet.getRows({orderby: 'col2', reverse: true}, (err, rows) => {
        rows.length.should.equal(5);
        _.map(rows, 'col2').should.deep.equal(_.sortBy(LETTERS).reverse());
        done(err);
      });
    });

    it('supports `orderby`+`limit` option', done => {
      sheet.getRows({orderby: 'col2', limit: 2}, (err, rows) => {
        rows.length.should.equal(2);
        _.map(rows, 'col2').should.deep.equal(_.sortBy(LETTERS).slice(0,2));
        done(err);
      });
    });

    // we could add more tests here, but it seems a bit unnecessary
    // as it would just be testing google's API

  });
});
