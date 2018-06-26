import { forceArray, xmlSafeValue } from './utils';
import { GoogleSpreadsheet } from './GoogleSpreadsheet';
import { Links, SpreadsheetCellData } from '../types';
import * as _ from 'lodash';

export class SpreadsheetCell {
	public readonly row: number;
	public readonly col: number;
	private readonly id: string; // ????
	private readonly _links: Links;
	private batchId: string;
	private _formula: string | undefined;
	private _value: string;
	private spreadsheet: GoogleSpreadsheet;
	private worksheet_id: number;

	constructor(
		spreadsheet: GoogleSpreadsheet,
		worksheet_id: number,
		data: SpreadsheetCellData,
	) {
		this.spreadsheet = spreadsheet;
		this.worksheet_id = worksheet_id;

		this.id = data.id;
		this.row = parseInt(data['gs:cell'].$.row);
		this.col = parseInt(data['gs:cell'].$.col);
		this.batchId = 'R' + this.row + 'C' + this.col;

		this._links = [];
		const links = forceArray(data.link);
		links.forEach(link => {
			this._links[link.$.rel] = link.$.href;
		});

		this.updateValuesFromResponseData(data);
	}

	// --------- PUBLIC API ---------------

	/**
	 * Sets value and saves
	 * @param {string} new_value
	 * @returns {Promise<void>}
	 */
	public setValue = async (new_value: string | number) => {
		this.val(new_value);
		return this.save(); //todo no callback
	};

	/**
	 * Saves cell. Mutates cell if e.g. a formula has been entered-
	 * @returns {Promise<void>}
	 */
	public save = async () => {
		let data_xml =
			'<entry><id>' +
			this.id +
			'</id>' +
			'<link rel="edit" type="application/atom+xml" href="' +
			this.id +
			'"/>' +
			'<gs:cell row="' +
			this.row +
			'" col="' +
			this.col +
			'" inputValue="' +
			this.valueForSave() +
			'"/></entry>';

		data_xml = data_xml.replace(
			'<entry>',
			"<entry xmlns='http://www.w3.org/2005/Atom' xmlns:gs='http://schemas.google.com/spreadsheets/2006'>",
		);

		const response = await this.spreadsheet.makeFeedRequest(
			this['_links']['edit'],
			'PUT',
			data_xml,
		);
		this.updateValuesFromResponseData(response.data);
	};

	/**
	 * Clears cell
	 * @returns {Promise<Promise<void>>}
	 */
	public del = async () => {
		return this.setValue('');
	};

	// TODO : figure out how to enforce that you can set with both string and number, but you always get a string back.

	// Value overload taking both string and number
	val = (val: string | number) => {
		//Enforce stringiness
		this._value = val.toString();

		if (typeof val == 'string' && val.substr(0, 1) === '=') {
			// use the getter to clear the value
			this.formula = val;
		} else {
			this._formula = undefined;
		}
	};

	// GETTERS AND SETTERS
	get value(): string {
		return this._value;
	}

	/**
	 * Set the value. If you want to clear, either use the empty string or use the .del method
	 * @param {string | number} val
	 */
	set value(val: string) {
		if (!val) {
			this._clearValue();
			return;
		}
		this.val(val);
	}

	get formula(): string | undefined {
		return this._formula;
	}

	// Set the formula. Use del or empty string to clear
	set formula(val: string | undefined) {
		if (!val) {
			this._clearValue();
			return;
		}

		if (val.substr(0, 1) !== '=') {
			throw new Error('Formulas must start with "="');
		}
		this._value = '*SAVE TO GET NEW VALUE*';
		this._formula = val;
	}

	get numericValue(): number {
		const valAsNumber = parseFloat(this._value);
		if (!valAsNumber) {
			throw new Error(
				`Attempted to get numeric value of a non-numeric field. Field value was: '${
					this._value
				}'`,
			);
		}
		return valAsNumber;
	}

	// ------------ Private ---------------

	private updateValuesFromResponseData = (_data: SpreadsheetCellData) => {
		// formula value
		const input_val = _data['gs:cell']['$']['inputValue'];
		// inputValue can be undefined so substr throws an error
		// still unsure how this situation happens
		if (input_val && input_val.substr(0, 1) === '=') {
			this._formula = input_val;
		} else {
			this._formula = undefined;
		}

		// the main "value" - its always a string
		this._value = _data['gs:cell']['_'] || '';
	};

	private _clearValue = () => {
		this._formula = undefined;
		this._value = '';
	};

	private valueForSave() {
		return xmlSafeValue(this._formula || this._value);
	}
}
