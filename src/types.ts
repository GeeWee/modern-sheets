/**
 * TODO: Describe file contents
 */
import { SpreadsheetWorksheet } from './old/SpreadsheetWorksheet';

export type SpreadsheetCellData = any;
export type Links = any;
export type SpreadsheetRowData = any;
export type WorksheetData = any;
export type ServiceAccountParams = string | ServiceAccountCredentials;

export interface ServiceAccountCredentials {
	client_email: string;
	private_key: string;
}

export interface AuthCredentials {
	type: string;
	value: string;
	expires: number;
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
	'gs:cell': {
		$: {
			col: string;
			inputValue: string;
			numericValue: string;
			row: string;
		};
		_: string;
	};
	id: string;
	link: {
		$: {
			href: string;
			rel: string;
			type: string;
		};
	}[];
	title: string;
	updated: string;
}
