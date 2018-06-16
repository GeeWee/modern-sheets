import { after, describe, before, it } from 'mocha';

import creds from './service-account-creds.json';
import sheet_ids from './config';
import {GoogleSpreadsheet} from '../index';
import _ from 'lodash';
import async from 'async';

const docs = {};
Object.keys(sheet_ids).forEach(function(key) {
  docs[key] = new GoogleSpreadsheet(sheet_ids[key]);
});
const doc = docs['private'];

describe('Managing doc info and sheets', function() {
  this.timeout(5000);

  before(function(done) {
    doc.useServiceAccountAuth(creds, done);
  });

  describe('get doc info', function() {
	  let info;
	
	  it('can fetch the doc info', function(done) {
      doc.getInfo(function(err, _info) {
        (!err).should.be.true;
        info = _info;
        done();
      });
    });

    it('should have the doc id', function() {
      info.id.should.equal('https://spreadsheets.google.com/feeds/worksheets/'+sheet_ids['private']+'/private/full')
    });

    it('should include the document title', function() {
      info.title.should.be.a.string;
    });

    it('should include author metadata', function() {
      info.author.name.should.equal('theozero');
      info.author.email.should.equal('theozero@gmail.com');
    });

    it('should include updated timestamp', function() {
      info.updated.should.match(/\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d\.\d\d\dZ/);
      new Date(info.updated).should.be.a('Date');
    });

    it('should include worksheets', function() {
      info.worksheets.should.have.length.above(0);
	    const sheet = info.worksheets[0];
	    sheet.url.should.include(sheet_ids['private']);
      sheet.title.should.be.a.string;
      sheet.rowCount.should.be.a('number');
      sheet.colCount.should.be.a('number');
    });
  });

  describe('adding, removing, and modifying worksheets', function() {
	  const sheet_title = 'Test sheet ' + (+new Date());
	  let sheet;
	  const sheets_to_remove = [];
	
	  after(function(done) {
      async.each(sheets_to_remove, function(sheet, nextSheet) {
        sheet.del(nextSheet);
      }, done);
    });

    it('can add a worksheet', function(done) {
      doc.addWorksheet({
        title: sheet_title,
        colCount: 10
      }, function(err, _sheet) {
        (!err).should.be.true;
        sheet = _sheet;
        sheet.title.should.equal(sheet_title);

        // check if the sheet is really there
        doc.getInfo(function(err, info) {
          (!err).should.be.true;
	        const added_sheet = info.worksheets.pop();
	        added_sheet.title.should.equal(sheet_title);
          done();
        });
      });
    });

    it('can set the header row of a worksheet', function(done) {
	    const header_vals = ['x1', 'x2', 'x3', 'x4', 'x5'];
	    sheet.setHeaderRow(header_vals, function(err) {
        sheet.getCells(function(err, cells) {
          (!err).should.be.true;
          cells.length.should.equal(5);
          _.times(header_vals.length, function(i) {
            cells[i].value.should.equal(header_vals[i]);
          });
          done();
        });
      });
    });

    it('clears the rest of the header row when setting headers', function(done) {
	    const header_vals = ['x1', 'x2'];
	    sheet.setHeaderRow(header_vals, function(err) {
        (!err).should.be.true;
        sheet.getCells(function(err, cells) {
          (!err).should.be.true;
          // only returns cells with values in them
          cells.length.should.equal(2);
          done();
        });
      });
    });

    it('can clear a worksheet', function(done) {
      sheet.clear(function(err) {
        (!err).should.be.true;
        sheet.getCells(function(err, cells) {
          (!err).should.be.true;
          // only returns cells with values in them
          cells.length.should.equal(0);
          done();
        });
      });
    });

    it('can resize a worksheet', function(done) {
      sheet.resize({rowCount: 5, colCount: 7}, function(err) {
        (!err).should.be.true;
        doc.getInfo(function(err, info) {
          (!err).should.be.true;
	        const last_sheet = info.worksheets.pop();
	        last_sheet.rowCount.should.equal(5);
          last_sheet.colCount.should.equal(7);
          done();
        });
      });
    });

    it('can set the title of a worksheet', function(done) {
	    const new_title = 'New title ' + (+new Date());
	    sheet.setTitle(new_title, function(err) {
        (!err).should.be.true;
        doc.getInfo(function(err, info) {
          (!err).should.be.true;
	        const last_sheet = info.worksheets.pop();
	        last_sheet.title.should.equal(new_title);
          done();
        });
      });
    });

    it('can delete a worksheet with `SpreadsheetWorksheet.del()`', function(done) {
      sheet.del(function(err) {
        (!err).should.be.true;
        // check if the sheet is really gone
        doc.getInfo(function(err, info) {
          (!err).should.be.true;
	        const last_sheet = info.worksheets.pop();
	        last_sheet.title.should.not.equal(sheet_title);
          done();
        });
      });
    });

    it('can delete a worksheet with `GoogleSpreadsheet.removeWorksheet()` passing the sheet object', function(done) {
      doc.addWorksheet({
        title: sheet_title,
        colCount: 10
      }, function(err, _sheet) {
        (!err).should.be.true;
        doc.removeWorksheet(_sheet, function(err) {
          (!err).should.be.true;
          doc.getInfo(function(err, info) {
            (!err).should.be.true;
	          const last_sheet = info.worksheets.pop();
	          last_sheet.title.should.not.equal(sheet_title);
            done();
          });
        });
      });
    });

    it('can delete a worksheet with `GoogleSpreadsheet.removeWorksheet()` passing the sheet ID', function(done) {
      doc.addWorksheet({
        title: sheet_title,
        colCount: 10
      }, function(err, _sheet) {
        (!err).should.be.true;
        doc.removeWorksheet(_sheet.id, function(err) {
          (!err).should.be.true;
          doc.getInfo(function(err, info) {
            (!err).should.be.true;
	          const last_sheet = info.worksheets.pop();
	          last_sheet.title.should.not.equal(sheet_title);
            done();
          });
        });
      });
    });

    it('can delete a worksheet with `GoogleSpreadsheet.removeWorksheet()` passing the index of the sheet', function(done) {
      doc.addWorksheet({
        title: sheet_title,
        colCount: 10
      }, function(err, _sheet) {
        (!err).should.be.true;

        doc.getInfo(function(err, info) {
          (!err).should.be.true;
	        const sheet_index = info.worksheets.length;
	
	        doc.removeWorksheet(sheet_index, function(err) {
            (!err).should.be.true;
            doc.getInfo(function(err, info) {
              (!err).should.be.true;
	            const last_sheet = info.worksheets.pop();
	            last_sheet.title.should.not.equal(sheet_title);
              done();
            });
          });
        });
      });
    });

    it('can add a sheet with specific number of rows and columns', function(done) {
      doc.addWorksheet({
        title: sheet_title,
        rowCount: 17,
        colCount: 13
      }, function(err, sheet) {
        (!err).should.be.true;
        sheets_to_remove.push(sheet);

        doc.getInfo(function(err, info) {
          (!err).should.be.true;
	        const new_sheet = info.worksheets.pop();
	        new_sheet.rowCount.should.equal(17);
          new_sheet.colCount.should.equal(13);
          done();
        });
      });
    });

    it('can specify column headers while adding a sheet', function(done) {
      doc.addWorksheet({
        headers: ['header1', 'header2', 'header3']
      }, function(err, sheet) {
        (!err).should.be.true;
        sheets_to_remove.push(sheet);
        sheet.getCells(function(err, cells) {
          (!err).should.be.true;
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
