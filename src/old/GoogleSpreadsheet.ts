import xml2js from 'xml2js';
import _ from 'lodash';
import * as gal from 'google-auth-library';
import { GoogleAuth, JWT } from 'google-auth-library';
import {
	forceArray,
	makeRequest,
	xmlSafeColumnName,
	xmlSafeValue,
} from './utils';
import { SpreadsheetWorksheet } from './SpreadsheetWorksheet';
import { SpreadsheetRow } from './SpreadsheetRow';
import { SpreadsheetCell } from './SpreadsheetCell';
import {
	AuthCredentials,
	SpreadsheetInfo,
	GetCellsOptions,
	ServiceAccountCredentials,
} from '../types';
import axios, { AxiosResponse } from 'axios';
import * as querystring from 'querystring';
import * as util from 'util';
import { throws } from 'assert';

const GOOGLE_FEED_URL = 'https://spreadsheets.google.com/feeds/';
const GOOGLE_AUTH_SCOPE = ['https://spreadsheets.google.com/feeds'];

const REQUIRE_AUTH_MESSAGE = 'You must authenticate to modify sheet data';

export class GoogleSpreadsheet {
	private visibility: 'public' | 'private' = 'public';
	private projection: 'full' | 'values' = 'values';
	private auth_mode: 'anonymous' | 'jwt' = 'anonymous';
	private jwt_client: JWT;
	private auth_client: AuthCredentials;
	private readonly ss_key: string;
	private info: SpreadsheetInfo;

	constructor(ss_key: string) {
		if (!ss_key) {
			throw new Error('Spreadsheet key not provided.');
		}
		this.ss_key = ss_key;
	}

	// -------------------  Authentication ---------------------
	useServiceAccountAuth = async (
		creds: ServiceAccountCredentials,
	): Promise<void> => {
		if (typeof creds == 'string') {
			creds = require(creds);
		}
		this.jwt_client = new gal.JWT(
			creds.client_email,
			undefined,
			creds.private_key,
			GOOGLE_AUTH_SCOPE,
			undefined,
		);
		return this.renewJwtAuth();
	};

	private renewJwtAuth = async (): Promise<void> => {
		this.auth_mode = 'jwt';
		const token = await this.jwt_client.authorize();

		this.auth_client = {
			type: token.token_type!,
			value: token.access_token!,
			expires: token.expiry_date!,
		};
		this.visibility = 'private';
		this.projection = 'full';
	};

	isAuthActive = (): boolean => {
		return !!this.auth_client;
	};

	private ensureAuthIsUpToDate = async (): Promise<void> => {
		if (this.auth_mode != 'jwt') {
			return;
		}
		if (this.auth_client && this.auth_client.expires > +new Date()) {
			return;
		}
		return this.renewJwtAuth();
	};

	// ---------------------- Auth end ------------------------

	// This method is used internally to make all requests
	makeFeedRequest = async (
		url_params: any,
		method: any,
		query_or_data: any,
	) => {
		let url: string;
		if (typeof url_params == 'string') {
			// used for edit / delete requests
			url = url_params;
		} else if (Array.isArray(url_params)) {
			//used for get and post requets
			url_params.push(this.visibility, this.projection);
			url = GOOGLE_FEED_URL + url_params.join('/');
		} else {
			throw Error(
				'Internal sheets error. Attempted to make a request without ur params.',
			);
		}

		await this.ensureAuthIsUpToDate();
		return makeRequest(method, url, query_or_data, this.auth_client);
	};

	// public API methods
	getInfo = async (): Promise<SpreadsheetInfo> => {
		const { data } = await this.makeFeedRequest(
			['worksheets', this.ss_key],
			'GET',
			null,
		);
		if (data === true) {
			throw Error('No response to getInfo call');
		}
		const ss_data = {
			id: data.id,
			title: data.title,
			updated: data.updated,
			author: data.author,
			worksheets: [] as SpreadsheetWorksheet[],
		};
		const worksheets = forceArray(data.entry);
		worksheets.forEach(ws_data => {
			ss_data.worksheets.push(new SpreadsheetWorksheet(this, ws_data));
		});
		this.info = ss_data;
		return ss_data;
	};

	// NOTE: worksheet IDs start at 1
	addWorksheet = async (opts: any = {}) => {
		if (!this.isAuthActive()) {
			throw Error(REQUIRE_AUTH_MESSAGE);
		}

		const defaults = {
			title: 'Worksheet ' + +new Date(), // need a unique title
			rowCount: 50,
			colCount: 20,
		};

		opts = _.extend({}, defaults, opts);

		// if column headers are set, make sure the sheet is big enough for them
		if (opts.headers && opts.headers.length > opts.colCount) {
			opts.colCount = opts.headers.length;
		}

		const data_xml =
			'<entry xmlns="http://www.w3.org/2005/Atom" xmlns:gs="http://schemas.google.com/spreadsheets/2006"><title>' +
			opts.title +
			'</title><gs:rowCount>' +
			opts.rowCount +
			'</gs:rowCount><gs:colCount>' +
			opts.colCount +
			'</gs:colCount></entry>';

		const { data } = await this.makeFeedRequest(
			['worksheets', this.ss_key],
			'POST',
			data_xml,
		);
		const sheet = new SpreadsheetWorksheet(this, data);
		await sheet.setHeaderRow(opts.headers);
		return sheet;
	};

	removeWorksheet = async (sheet_id: number | SpreadsheetWorksheet) => {
		if (!this.isAuthActive()) {
			throw Error(REQUIRE_AUTH_MESSAGE);
		}
		if (sheet_id instanceof SpreadsheetWorksheet) {
			return sheet_id.del();
		}
		return this.makeFeedRequest(
			GOOGLE_FEED_URL +
				'worksheets/' +
				this.ss_key +
				'/private/full/' +
				sheet_id,
			'DELETE',
			null,
		);
	};

	getRows = async (worksheet_id: number, opts: any = {}) => {
		// the first row is used as titles/keys and is not included
		const query: any = {};

		if (opts.offset) {
			query['start-index'] = opts.offset;
		} else if (opts.start) {
			query['start-index'] = opts.start;
		}

		if (opts.limit) {
			query['max-results'] = opts.limit;
		} else if (opts.num) {
			query['max-results'] = opts.num;
		}

		if (opts.orderby) {
			query['orderby'] = opts.orderby;
		}
		if (opts.reverse) {
			query['reverse'] = 'true';
		}
		if (opts.query) {
			query['sq'] = opts.query;
		}

		const { data, xml } = await this.makeFeedRequest(
			['list', this.ss_key, worksheet_id],
			'GET',
			query,
		);
		if (data === true) {
			throw Error('No response to getRows call');
		}

		// gets the raw xml for each entry -- this is passed to the row object so we can do updates on it later

		let entries_xml = xml.match(/<entry[^>]*>([\s\S]*?)<\/entry>/g);

		// need to add the properties from the feed to the xml for the entries
		const feed_props = _.clone(data.$);
		delete feed_props['gd:etag'];
		const feed_props_str = _.reduce(
			feed_props,
			(str, val, key) => {
				return str + key + "='" + val + "' ";
			},
			'',
		);
		entries_xml = _.map(entries_xml, xml => {
			return xml.replace('<entry ', '<entry ' + feed_props_str);
		});

		const rows: SpreadsheetRow[] = [];
		const entries = forceArray(data.entry);
		let i = 0;
		entries.forEach(row_data => {
			rows.push(new SpreadsheetRow(this, row_data, entries_xml[i++]));
		});
		return rows;
	};

	addRow = async (
		worksheet_id: number,
		rowData: any,
	): Promise<SpreadsheetRow> => {
		let data_xml =
			'<entry xmlns="http://www.w3.org/2005/Atom" xmlns:gsx="http://schemas.google.com/spreadsheets/2006/extended">' +
			'\n';
		Object.keys(rowData).forEach(key => {
			if (
				key != 'id' &&
				key != 'title' &&
				key != 'content' &&
				key != '_links'
			) {
				data_xml +=
					'<gsx:' +
					xmlSafeColumnName(key) +
					'>' +
					xmlSafeValue(rowData[key]) +
					'</gsx:' +
					xmlSafeColumnName(key) +
					'>' +
					'\n';
			}
		});
		data_xml += '</entry>';
		const { data, xml: new_xml } = await this.makeFeedRequest(
			['list', this.ss_key, worksheet_id],
			'POST',
			data_xml,
		);
		const entries_xml = new_xml.match(/<entry[^>]*>([\s\S]*?)<\/entry>/g);
		return new SpreadsheetRow(this, data, entries_xml[0]);
	};

	getCells = async (
		worksheet_id: number,
		opts: Partial<GetCellsOptions> = {},
	): Promise<SpreadsheetCell[]> => {
		// Supported options are:
		// min-row, max-row, min-col, max-col, return-empty
		const query = _.assign({}, opts);

		const { data } = await this.makeFeedRequest(
			['cells', this.ss_key, worksheet_id],
			'GET',
			query,
		);
		if (data === true) {
			throw Error('No response to getCells call');
		}

		const cells: SpreadsheetCell[] = [];
		const entries = forceArray(data['entry']);

		entries.forEach(cell_data => {
			cells.push(new SpreadsheetCell(this, worksheet_id, cell_data));
		});
		return cells;
	};
}
