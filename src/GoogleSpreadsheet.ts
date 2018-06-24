import xml2js from 'xml2js';
import _ from 'lodash';
import * as gal from 'google-auth-library';
import { GoogleAuth, JWT } from 'google-auth-library';
import { forceArray, xmlSafeColumnName, xmlSafeValue } from './utils';
import { SpreadsheetWorksheet } from './SpreadsheetWorksheet';
import { SpreadsheetRow } from './SpreadsheetRow';
import { SpreadsheetCell } from './SpreadsheetCell';
import { Authentication } from './types';
import axios, { AxiosResponse } from 'axios';
import * as querystring from 'querystring';
import * as util from 'util';

const GOOGLE_FEED_URL = 'https://spreadsheets.google.com/feeds/';
const GOOGLE_AUTH_SCOPE = ['https://spreadsheets.google.com/feeds'];

const REQUIRE_AUTH_MESSAGE = 'You must authenticate to modify sheet data';

export class GoogleSpreadsheet {
	xml_parser = new xml2js.Parser({
		// options carried over from older version of xml2js
		// might want to update how the code works, but for now this is fine
		explicitArray: false,
		explicitRoot: false,
	});

	visibility = 'public';
	projection = 'values';

	auth_mode = 'anonymous';
	private options: any;
	private jwt_client: JWT;
	private google_auth: any; //todo remove? -- type should be googleauth??
	private auth_client: GoogleAuth;
	private readonly ss_key: string;
	private worksheets: any[];
	private info: {
		id: any;
		title: any;
		updated: any;
		author: any;
		worksheets: any[];
	};

	//TODO optional?
	constructor(ss_key: string, auth_id?: Authentication, options?: any) {
		if (!ss_key) {
			throw new Error('Spreadsheet key not provided.');
		}

		this.auth_client = new gal.GoogleAuth();
		this.ss_key = ss_key;

		this.options = options || {};

		this.setAuthAndDependencies(auth_id);
	}

	setAuthToken = (auth_id: Authentication) => {
		if (this.auth_mode == 'anonymous') {
			this.auth_mode = 'token';
		}
		this.setAuthAndDependencies(auth_id);
	};

	// deprecated username/password login method
	// leaving it here to help notify users why it doesn't work

	useServiceAccountAuth = async (creds: string | any) => {
		if (typeof creds == 'string') {
			creds = require(creds);
		}
		this.jwt_client = new gal.JWT(
			creds.client_email,
			null,
			creds.private_key,
			GOOGLE_AUTH_SCOPE,
			null,
		);
		return this.renewJwtAuth();
	};

	renewJwtAuth = async (): Promise<void> => {
		this.auth_mode = 'jwt';
		const token = await this.jwt_client.authorize();
		this.setAuthToken({
			type: token.token_type,
			value: token.access_token,
			expires: token.expiry_date,
		});
	};

	isAuthActive = () => {
		return !!this.google_auth;
	};

	//TOdo maybe not right
	setAuthAndDependencies = (auth: GoogleAuth) => {
		this.google_auth = auth;
		if (!this.options.visibility) {
			this.visibility = auth ? 'private' : 'public';
		}
		if (!this.options.projection) {
			this.projection = auth ? 'full' : 'values';
		}
	};

	private ensureAuthIsUpToDate = async () => {
		if (this.auth_mode != 'jwt') {
			return;
		}
		// check if jwt token is expired
		if (this.google_auth && this.google_auth.expires > +new Date()) {
			return;
		}
		return this.renewJwtAuth();
	};

	// This method is used internally to make all requests
	makeFeedRequest = async (
		url_params: any,
		method: any,
		query_or_data: any,
	) => {
		let url;
		const headers = {};
		if (typeof url_params == 'string') {
			// used for edit / delete requests
			url = url_params;
		} else if (Array.isArray(url_params)) {
			//used for get and post requets
			url_params.push(this.visibility, this.projection);
			url = GOOGLE_FEED_URL + url_params.join('/');
		}

		await this.ensureAuthIsUpToDate();
		return this.makeRequest(headers, method, url, query_or_data);
	};

	private makeRequest = async (
		headers,
		method: any,
		url,
		query_or_data: any,
	): Promise<{ data: any; xml: any }> => {
		if (this.google_auth) {
			if (this.google_auth.type === 'Bearer') {
				headers['Authorization'] = 'Bearer ' + this.google_auth.value;
			} else {
				headers['Authorization'] = 'GoogleLogin auth=' + this.google_auth;
			}
		}

		headers['Gdata-Version'] = '3.0';

		if (method == 'POST' || method == 'PUT') {
			headers['content-type'] = 'application/atom+xml';
		}

		if (method == 'PUT' || (method == 'POST' && url.indexOf('/batch') != -1)) {
			headers['If-Match'] = '*';
		}

		if (method == 'GET' && query_or_data) {
			let query = '?' + querystring.stringify(query_or_data);
			// replacements are needed for using structured queries on getRows
			query = query.replace(/%3E/g, '>');
			query = query.replace(/%3D/g, '=');
			query = query.replace(/%3C/g, '<');
			url += query;
		}

		let response: AxiosResponse;
		try {
			response = await axios.request({
				url: url,
				method: method,
				headers: headers,
				data: method == 'POST' || method == 'PUT' ? query_or_data : null,
				//The response is xml - we'll just grab it as text to avoid json parse errors
				responseType: 'text',
			});
		} catch (err) {
			if (err.response.status === 401) {
				throw new Error('Invalid authorization key.');
			}
			// Decorate error with some extra information
			err.message = `${err.message}. Response from server: "${
				err.response.data
			}"`;
			throw err;
		}
		// If it responds with an html page - it means the sheet is private
		if (
			response.status === 200 &&
			response.headers['content-type'].indexOf('text/html') >= 0
		) {
			throw new Error(
				'Sheet is private. Use authentication or make public. (see https://github.com/theoephraim/node-google-spreadsheet#a-note-on-authentication for details)',
			);
		}

		if (response.data) {
			const promisifedParse = util.promisify(
				this.xml_parser.parseString,
			) as any;
			const parseResult = await promisifedParse(response.data);
			return { data: parseResult, xml: response.data };

			// Wtf two returns?????
			//cb(null, result, body);
		}
		// No errors and no response. Return empty object here.
		//todo remove?
		return { data: null, xml: null };
	};

	// public API methods
	getInfo = async () => {
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
			worksheets: [],
		};
		const worksheets = forceArray(data.entry);
		worksheets.forEach(ws_data => {
			ss_data.worksheets.push(new SpreadsheetWorksheet(this, ws_data));
		});
		this.info = ss_data;
		this.worksheets = ss_data.worksheets;
		return ss_data;
	};

	// NOTE: worksheet IDs start at 1

	addWorksheet = async opts => {
		// make opts optional
		if (typeof opts == 'function') {
			opts = {};
		}

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
		this.worksheets = this.worksheets || [];
		this.worksheets.push(sheet);
		await sheet.setHeaderRow(opts.headers);
		return sheet;
	};

	removeWorksheet = async sheet_id => {
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

	getRows = async (worksheet_id, opts: any = {}) => {
		// the first row is used as titles/keys and is not included
		const query = {};

		if (opts.offset) query['start-index'] = opts.offset;
		else if (opts.start) query['start-index'] = opts.start;

		if (opts.limit) query['max-results'] = opts.limit;
		else if (opts.num) query['max-results'] = opts.num;

		if (opts.orderby) query['orderby'] = opts.orderby;
		if (opts.reverse) query['reverse'] = 'true';
		if (opts.query) query['sq'] = opts.query;

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

		const rows = [];
		const entries = forceArray(data.entry);
		let i = 0;
		entries.forEach(row_data => {
			rows.push(new SpreadsheetRow(this, row_data, entries_xml[i++]));
		});
		return rows;
	};

	addRow = async (worksheet_id, rowData): Promise<SpreadsheetRow> => {
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

	getCells = async (worksheet_id, opts?) => {
		// opts is optional
		if (typeof opts == 'function') {
			opts = {};
		}

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

		const cells = [];
		const entries = forceArray(data['entry']);

		entries.forEach(cell_data => {
			cells.push(new SpreadsheetCell(this, worksheet_id, cell_data));
		});
		return cells;
	};
}
