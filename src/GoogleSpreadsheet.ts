import async from 'async';
import request from 'request';
import xml2js from 'xml2js';
import http from 'http';
import querystring from 'querystring';
import _ from 'lodash';
import * as gal from 'google-auth-library';
import { GoogleAuth, JWT } from 'google-auth-library';
import { forceArray, xmlSafeColumnName, xmlSafeValue } from './utils';
import { SpreadsheetWorksheet } from './SpreadsheetWorksheet';
import { SpreadsheetRow } from './SpreadsheetRow';
import { SpreadsheetCell } from './SpreadsheetCell';
import { Callback } from './types';

const GOOGLE_FEED_URL = 'https://spreadsheets.google.com/feeds/';
const GOOGLE_AUTH_SCOPE = ['https://spreadsheets.google.com/feeds'];

const REQUIRE_AUTH_MESSAGE = 'You must authenticate to modify sheet data';

export class GoogleSpreadsheet {
	xml_parser = new xml2js.Parser({
		// options carried over from older version of xml2js
		// might want to update how the code works, but for now this is fine
		explicitArray: false,
		explicitRoot: false
	});
	
	visibility = 'public';
	projection = 'values';
	
	auth_mode = 'anonymous';
	private options: any;
	private jwt_client: JWT;
	private google_auth: any;
	private auth_client: GoogleAuth;
	private ss_key: any;
	private worksheets: any[];
	private info: { id: any; title: any; updated: any; author: any; worksheets: any[] };
	
	//TODO optional?
	constructor(ss_key, auth_id?, options?){
		if (!ss_key) {
			throw new Error('Spreadsheet key not provided.');
		}
		
		this.auth_client = new gal.GoogleAuth();
		this.ss_key = ss_key;
		
		this.options = options || {};
		
		this.setAuthAndDependencies(auth_id);
		
		
		
		
	}
	
	setAuthToken =  (auth_id) =>  {
		if (this.auth_mode == 'anonymous') {
			this.auth_mode = 'token';
		}
		this.setAuthAndDependencies(auth_id);
	};
	
	// deprecated username/password login method
	// leaving it here to help notify users why it doesn't work
	setAuth = (username, password, cb) => {
		return cb(new Error('Google has officially deprecated ClientLogin. Please upgrade this module and see the readme for more instrucations'))
	};
	
	useServiceAccountAuth =  (creds, cb) => {
		if (typeof creds == 'string') {
			try {
				creds = require(creds);
			} catch (err) {
				return cb(err);
			}
		}
		this.jwt_client = new gal.JWT(creds.client_email, null, creds.private_key, GOOGLE_AUTH_SCOPE, null);
		this.renewJwtAuth(cb);
	};
	
	renewJwtAuth = (cb) => {
		this.auth_mode = 'jwt';
		this.jwt_client.authorize((err, token) => {
			if (err) return cb(err);
			this.setAuthToken({
				type: token.token_type,
				value: token.access_token,
				expires: token.expiry_date
			});
			cb()
		});
	};
	
	isAuthActive = () => {
		return !!this.google_auth;
	};
	
	//TOdo maybe not right
	setAuthAndDependencies = (auth) => {
		this.google_auth = auth;
		if (!this.options.visibility) {
			this.visibility = auth ? 'private' : 'public';
		}
		if (!this.options.projection) {
			this.projection = auth ? 'full' : 'values';
		}
	};
	
	// This method is used internally to make all requests
	makeFeedRequest = (url_params, method, query_or_data, cb: any) => {
		let url;
		const headers = {};
		if (!cb) cb = function () {
		};
		if (typeof(url_params) == 'string') {
			// used for edit / delete requests
			url = url_params;
		} else if (Array.isArray(url_params)) {
			//used for get and post requets
			url_params.push(this.visibility, this.projection);
			url = GOOGLE_FEED_URL + url_params.join('/');
		}
		
		async.series({
			auth: (step) => {
				if (this.auth_mode != 'jwt') return step();
				// check if jwt token is expired
				if (this.google_auth && this.google_auth.expires > +new Date()) return step();
				this.renewJwtAuth(step);
			},
			request: (result, step) => {
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
				
				if (method == 'PUT' || method == 'POST' && url.indexOf('/batch') != -1) {
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
				
				request({
					url: url,
					method: method,
					headers: headers,
					body: method == 'POST' || method == 'PUT' ? query_or_data : null
				}, (err, response, body) => {
					if (err) {
						return cb(err);
					} else if (response.statusCode === 401) {
						return cb(new Error('Invalid authorization key.'));
					} else if (response.statusCode >= 400) {
						const message = _.isObject(body) ? JSON.stringify(body) : body.replace(/&quot;/g, '"');
						return cb(new Error('HTTP error ' + response.statusCode + ' (' + http.STATUS_CODES[response.statusCode]) + ') - ' + message);
					} else if (response.statusCode === 200 && response.headers['content-type'].indexOf('text/html') >= 0) {
						return cb(new Error('Sheet is private. Use authentication or make public. (see https://github.com/theoephraim/node-google-spreadsheet#a-note-on-authentication for details)'));
					}
					
					
					if (body) {
						this.xml_parser.parseString(body,  (err, result) => {
							if (err) return cb(err);
							cb(null, result, body);
						});
					} else {
						if (err) cb(err);
						else cb(null, true);
					}
				})
			}
		});
	};

	// public API methods
	getInfo = (cb) => {
		this.makeFeedRequest(['worksheets', this.ss_key], 'GET', null, (err, data, xml) => {
			if (err) return cb(err);
			if (data === true) {
				return cb(new Error('No response to getInfo call'))
			}
			const ss_data = {
				id: data.id,
				title: data.title,
				updated: data.updated,
				author: data.author,
				worksheets: []
			};
			const worksheets = forceArray(data.entry);
			worksheets.forEach(ws_data => {
				ss_data.worksheets.push(new SpreadsheetWorksheet(this, ws_data));
			});
			this.info = ss_data;
			this.worksheets = ss_data.worksheets;
			cb(null, ss_data);
		});
	};
	
	// NOTE: worksheet IDs start at 1
	
	addWorksheet = (opts, cb)  => {
		// make opts optional
		if (typeof opts == 'function') {
			cb = opts;
			opts = {};
		}
		
		cb = cb || _.noop;
		
		if (!this.isAuthActive()) return cb(new Error(REQUIRE_AUTH_MESSAGE));
		
		const defaults = {
			title: 'Worksheet ' + (+new Date()),  // need a unique title
			rowCount: 50,
			colCount: 20
		};
		
		opts = _.extend({}, defaults, opts);
		
		// if column headers are set, make sure the sheet is big enough for them
		if (opts.headers && opts.headers.length > opts.colCount) {
			opts.colCount = opts.headers.length;
		}
		
		const data_xml = '<entry xmlns="http://www.w3.org/2005/Atom" xmlns:gs="http://schemas.google.com/spreadsheets/2006"><title>' +
			opts.title +
			'</title><gs:rowCount>' +
			opts.rowCount +
			'</gs:rowCount><gs:colCount>' +
			opts.colCount +
			'</gs:colCount></entry>';
		
		this.makeFeedRequest(['worksheets', this.ss_key], 'POST', data_xml, (err, data, xml) => {
			if (err) return cb(err);
			
			const sheet = new SpreadsheetWorksheet(this, data);
			this.worksheets = this.worksheets || [];
			this.worksheets.push(sheet);
			sheet.setHeaderRow(opts.headers,  (err) => {
				cb(err, sheet);
			})
		});
	};
	
	removeWorksheet = (sheet_id, cb) => {
		if (!this.isAuthActive()) return cb(new Error(REQUIRE_AUTH_MESSAGE));
		if (sheet_id instanceof SpreadsheetWorksheet) return sheet_id.del(cb);
		this.makeFeedRequest(GOOGLE_FEED_URL + 'worksheets/' + this.ss_key + '/private/full/' + sheet_id, 'DELETE', null, cb);
	};
	
	getRows = (worksheet_id, opts, cb) => {
		// the first row is used as titles/keys and is not included
		
		// opts is optional
		if (typeof(opts) == 'function') {
			cb = opts;
			opts = {};
		}
		
		
		const query = {};
		
		if (opts.offset) query['start-index'] = opts.offset;
		else if (opts.start) query['start-index'] = opts.start;
		
		if (opts.limit) query['max-results'] = opts.limit;
		else if (opts.num) query['max-results'] = opts.num;
		
		if (opts.orderby) query['orderby'] = opts.orderby;
		if (opts.reverse) query['reverse'] = 'true';
		if (opts.query) query['sq'] = opts.query;
		
		this.makeFeedRequest(['list', this.ss_key, worksheet_id], 'GET', query, (err, data, xml) => {
			if (err) return cb(err);
			if (data === true) {
				return cb(new Error('No response to getRows call'))
			}
			
			// gets the raw xml for each entry -- this is passed to the row object so we can do updates on it later
			
			let entries_xml = xml.match(/<entry[^>]*>([\s\S]*?)<\/entry>/g);
			
			
			// need to add the properties from the feed to the xml for the entries
			const feed_props = _.clone(data.$);
			delete feed_props['gd:etag'];
			const feed_props_str = _.reduce(feed_props,  (str, val, key) => {
				return str + key + '=\'' + val + '\' ';
			}, '');
			entries_xml = _.map(entries_xml,  (xml) => {
				return xml.replace('<entry ', '<entry ' + feed_props_str);
			});
			
			const rows = [];
			const entries = forceArray(data.entry);
			let i = 0;
			entries.forEach( (row_data) => {
				rows.push(new SpreadsheetRow(this, row_data, entries_xml[i++]));
			});
			cb(null, rows);
		});
	};
	
	addRow = (worksheet_id, data, cb) => {
		let data_xml = '<entry xmlns="http://www.w3.org/2005/Atom" xmlns:gsx="http://schemas.google.com/spreadsheets/2006/extended">' + '\n';
		Object.keys(data).forEach( (key) => {
			if (key != 'id' && key != 'title' && key != 'content' && key != '_links') {
				data_xml += '<gsx:' + xmlSafeColumnName(key) + '>' + xmlSafeValue(data[key]) + '</gsx:' + xmlSafeColumnName(key) + '>' + '\n'
			}
		});
		data_xml += '</entry>';
		this.makeFeedRequest(['list', this.ss_key, worksheet_id], 'POST', data_xml, (err, data, new_xml) => {
			if (err) return cb(err);
			const entries_xml = new_xml.match(/<entry[^>]*>([\s\S]*?)<\/entry>/g);
			const row = new SpreadsheetRow(this, data, entries_xml[0]);
			cb(null, row);
		});
	};
	
	getCells = (worksheet_id, opts, cb) => {
		// opts is optional
		if (typeof(opts) == 'function') {
			cb = opts;
			opts = {};
		}
		
		// Supported options are:
		// min-row, max-row, min-col, max-col, return-empty
		const query = _.assign({}, opts);
		
		
		this.makeFeedRequest(['cells', this.ss_key, worksheet_id], 'GET', query, (err, data, xml) => {
			if (err) return cb(err);
			if (data === true) {
				return cb(new Error('No response to getCells call'))
			}
			
			const cells = [];
			const entries = forceArray(data['entry']);
			const i = 0;
			entries.forEach((cell_data) => {
				cells.push(new SpreadsheetCell(this, worksheet_id, cell_data));
			});
			
			cb(null, cells);
		});
	}
}

