/**
 * TODO: Describe file contents
 */
import { SpreadsheetWorksheet } from './old/SpreadsheetWorksheet';

export type SpreadsheetCellData = {
	id: string;
	link: LinkType;
	'gs:cell': CellType;
	[k: string]: any;
};
export type Links = any;
export type SpreadsheetRowData = any;
export type WorksheetData = any;
export type ServiceAccountParams = string | ServiceAccountCredentials;

export interface GetRowOptions {
	offset: number;
	limit: number;
	orderby: string;
	reverse: boolean;
	query: string;
}

export interface ServiceAccountCredentials {
	client_email: string;
	private_key: string;
}

export interface AuthCredentials {
	type: string;
	value: string;
	expires: number;
}

export interface AddWorksheetOptions {
	title: string;
	rowCount: number;
	colCount: number;
	headers: string[];
}

export interface IndexSignature<T = any> {
	[key: string]: T;
}

export interface SpreadsheetInfo {
	id: string;
	title: string;
	updated: any;
	author: {
		name: string;
		email: string;
	};
	worksheets: SpreadsheetWorksheet[];
}

export interface GetCellsOptions {
	'min-row': number;
	'max-row': number;
	'min-col': number;
	'max-col': number;
	'return-empty': boolean;
}

export interface Foo {
	$: { 'gd:etag': string };
	'app:edited': {
		$: {
			'xmlns:app': string;
		};
		_: string;
	};
	category: {
		$: {
			scheme: string;
			term: string;
		};
	};
	content: string;
	'gs:cell': CellType;
	id: string;
	link: LinkType[];
	title: string;
	updated: string;
}

interface CellType {
	$: {
		col: string;
		inputValue: string;
		numericValue: string;
		row: string;
	};
	_: string;
}

interface LinkType {
	$: {
		href: string;
		rel: string;
		type: string;
	};
}
