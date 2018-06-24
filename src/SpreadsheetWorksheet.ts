import { forceArray } from './utils';
import * as _ from 'lodash';
import { GoogleSpreadsheet } from './GoogleSpreadsheet';
import { Links, WorksheetData } from './types';
import { SpreadsheetRow } from './SpreadsheetRow';

/**
 * TODO: Describe file contents
 */

interface WorksheetInfo {
	title: string;
	rowCount: number;
	colCount: number;
}

export class SpreadsheetWorksheet {
	private spreadsheet: GoogleSpreadsheet;
	private url: string;
	private readonly id: string;
	private title: string;
	private rowCount: number;
	private colCount: number;
	private readonly _links: Links;

	constructor(spreadsheet: GoogleSpreadsheet, data: WorksheetData) {
		let links;
		this.spreadsheet = spreadsheet;
		this.url = data.id;
		this.id = data.id.substring(data.id.lastIndexOf('/') + 1);
		this.title = data.title;
		this.rowCount = parseInt(data['gs:rowCount']);
		this.colCount = parseInt(data['gs:colCount']);

		this._links = [];
		links = forceArray(data.link);
		links.forEach(link => {
			this._links[link['$']['rel']] = link['$']['href'];
		});
		this._links['cells'] = this._links[
			'http://schemas.google.com/spreadsheets/2006#cellsfeed'
		];
		this._links['bulkcells'] = this._links['cells'] + '/batch';
	}

	_setInfo = async (opts?: Partial<WorksheetInfo>) => {
		const xml = `<entry xmlns="http://www.w3.org/2005/Atom" xmlns:gs="http://schemas.google.com/spreadsheets/2006"><title>${opts.title ||
			this.title}</title><gs:rowCount>${opts.rowCount ||
			this.rowCount}</gs:rowCount><gs:colCount>${opts.colCount ||
			this.colCount}</gs:colCount></entry>`;
		const { data: response } = await this.spreadsheet.makeFeedRequest(
			this['_links']['edit'],
			'PUT',
			xml,
		);
		this.title = response.title;
		this.rowCount = parseInt(response['gs:rowCount']);
		this.colCount = parseInt(response['gs:colCount']);
	};

	resize = this._setInfo;
	setTitle = async (title: string) => {
		return this._setInfo({ title: title });
	};

	// just a convenience method to clear the whole sheet
	// resizes to 1 cell, clears the cell, and puts it back
	clear = async () => {
		const cols = this.colCount;
		const rows = this.colCount;
		await this.resize({ rowCount: 1, colCount: 1 });
		const cells = await this.getCells();
		await cells[0].setValue(null);
		return this.resize({ rowCount: rows, colCount: cols });
	};

	getRows = async (opts: any = {}) => {
		return this.spreadsheet.getRows(this.id, opts);
	};

	getCells = async (opts: any = {}) => {
		return this.spreadsheet.getCells(this.id, opts);
	};

	addRow = async (data: any): Promise<SpreadsheetRow> => {
		return this.spreadsheet.addRow(this.id, data);
	};

	bulkUpdateCells = async (cells: any[]) => {
		const entries = cells.map(cell => {
			cell._needsSave = false;
			return `<entry>
        <batch:id>${cell.batchId}</batch:id>
        <batch:operation type="update"/>
        <id>${this['_links']['cells']}/${cell.batchId}</id>
        <link rel="edit" type="application/atom+xml"
          href="${cell._links.edit}"/>
        <gs:cell row="${cell.row}" col="${cell.col}" inputValue="${
				cell.valueForSave
			}"/>
      </entry>`;
		});
		const data_xml = `<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:batch="http://schemas.google.com/gdata/batch"
      xmlns:gs="http://schemas.google.com/spreadsheets/2006">
      <id>${this['_links']['cells']}</id>
      ${entries.join('\n')}
    </feed>`;

		const { data } = await this.spreadsheet.makeFeedRequest(
			this['_links']['bulkcells'],
			'POST',
			data_xml,
		);
		// update all the cells
		const cells_by_batch_id = _.keyBy(cells, 'batchId');
		if (data.entry && data.entry.length) {
			data.entry.forEach((cell_data: any) => {
				cells_by_batch_id[cell_data['batch:id']].updateValuesFromResponseData(
					cell_data,
				);
			});
		}
	};

	del = async () => {
		return this.spreadsheet.makeFeedRequest(
			this['_links']['edit'],
			'DELETE',
			null,
		);
	};

	setHeaderRow = async (values: any) => {
		if (!values) {
			return;
		}
		if (values.length > this.colCount) {
			throw Error(
				'Sheet is not large enough to fit ' +
					values.length +
					' columns. Resize the sheet first.',
			);
		}
		const cells = await this.getCells({
			'min-row': 1,
			'max-row': 1,
			'min-col': 1,
			'max-col': this.colCount,
			'return-empty': true,
		});
		_.each(cells, cell => {
			cell.value = values[cell.col - 1] ? values[cell.col - 1] : '';
		});
		return this.bulkUpdateCells(cells);
	};
}
