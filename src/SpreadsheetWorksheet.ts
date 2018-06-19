import { forceArray } from './utils';
import * as _ from 'lodash';
import { GoogleSpreadsheet } from './GoogleSpreadsheet';
import { Callback, Links, WorksheetData } from './types';

/**
 * TODO: Describe file contents
 */

interface WorksheetInfo {
	title: string;
	rowCount: number,
	colCount: number,
}

export class SpreadsheetWorksheet{
	private spreadsheet: GoogleSpreadsheet;
	private url: string;
	private id: string;
	private title: string;
	private rowCount: number;
	private colCount: number;
	private _links: Links;
	
	constructor(spreadsheet: GoogleSpreadsheet, data: WorksheetData){
		let links;
		this.spreadsheet = spreadsheet;
		this.url = data.id;
		this.id = data.id.substring( data.id.lastIndexOf('/') + 1 );
		this.title = data.title;
		this.rowCount = parseInt(data['gs:rowCount']);
		this.colCount = parseInt(data['gs:colCount']);
		
		this._links = [];
		links = forceArray( data.link );
		links.forEach( ( link ) => {
			this._links[ link['$']['rel'] ] = link['$']['href'];
		});
		this._links['cells'] = this._links['http://schemas.google.com/spreadsheets/2006#cellsfeed'];
		this._links['bulkcells'] = this._links['cells']+'/batch';
		
	}
	
	_setInfo = (opts? : Partial<WorksheetInfo>, cb: Callback = _.noop) => {
		cb = cb || _.noop;
		const xml = `<entry xmlns="http://www.w3.org/2005/Atom" xmlns:gs="http://schemas.google.com/spreadsheets/2006"><title>${opts.title || this.title}</title><gs:rowCount>${opts.rowCount || this.rowCount}</gs:rowCount><gs:colCount>${opts.colCount || this.colCount}</gs:colCount></entry>`;
		this.spreadsheet.makeFeedRequest(this['_links']['edit'], 'PUT', xml, (err, response) => {
			if (err) return cb(err);
			this.title = response.title;
			this.rowCount = parseInt(response['gs:rowCount']);
			this.colCount = parseInt(response['gs:colCount']);
			cb();
		});
	};
	
	resize = this._setInfo;
	setTitle = (title: string, cb: Callback) => {
		this._setInfo({title: title}, cb);
	};
	
	
	// just a convenience method to clear the whole sheet
	// resizes to 1 cell, clears the cell, and puts it back
	clear = (cb : Callback) => {
		const cols = this.colCount;
		const rows = this.colCount;
		this.resize({rowCount: 1, colCount: 1}, (err)  => {
			if (err) return cb(err);
			this.getCells((err: any, cells: any) => {
				cells[0].setValue(null, (err: any) => {
					if (err) return cb(err);
					this.resize({rowCount: rows, colCount: cols}, cb);
				});
			})
		});
	};
	
	getRows = (opts : any, cb: Callback) =>{
		this.spreadsheet.getRows(this.id, opts, cb);
	};
	//todo maybe no callback
	getCells = (opts?: any, cb?: Callback) => {
		this.spreadsheet.getCells(this.id, opts, cb);
	};
	addRow = (data: any, cb: Callback) =>{
		this.spreadsheet.addRow(this.id, data, cb);
	};
	bulkUpdateCells = (cells: any[], cb: Callback = _.noop) => {
		const entries = cells.map((cell, i) => {
			cell._needsSave = false;
			return `<entry>
        <batch:id>${cell.batchId}</batch:id>
        <batch:operation type="update"/>
        <id>${this['_links']['cells']}/${cell.batchId}</id>
        <link rel="edit" type="application/atom+xml"
          href="${cell._links.edit}"/>
        <gs:cell row="${cell.row}" col="${cell.col}" inputValue="${cell.valueForSave}"/>
      </entry>`;
		});
		const data_xml = `<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:batch="http://schemas.google.com/gdata/batch"
      xmlns:gs="http://schemas.google.com/spreadsheets/2006">
      <id>${this['_links']['cells']}</id>
      ${entries.join('\n')}
    </feed>`;
		
		this.spreadsheet.makeFeedRequest(this['_links']['bulkcells'], 'POST', data_xml, function(err, data) {
			if (err) return cb(err);
			
			// update all the cells
			const cells_by_batch_id = _.keyBy(cells, 'batchId');
			if (data.entry && data.entry.length) data.entry.forEach((cell_data: any) => {
				cells_by_batch_id[cell_data['batch:id']].updateValuesFromResponseData(cell_data);
			});
			cb();
		});
	};
	del = (cb : Callback) => {
		this.spreadsheet.makeFeedRequest(this['_links']['edit'], 'DELETE', null, cb);
	};
	
	setHeaderRow = (values: any, cb: Callback = _.noop) => {
		if (!values) return cb();
		if (values.length > this.colCount){
			return cb(new Error('Sheet is not large enough to fit '+values.length+' columns. Resize the sheet first.'));
		}
		this.getCells({
			'min-row': 1,
			'max-row': 1,
			'min-col': 1,
			'max-col': this.colCount,
			'return-empty': true
		}, (err, cells)  => {
			if (err) return cb(err);
			_.each(cells, (cell) => {
				cell.value = values[cell.col-1] ? values[cell.col-1] : '';
			});
			this.bulkUpdateCells(cells, cb);
		});
	}
}
