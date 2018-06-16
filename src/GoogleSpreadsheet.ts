/*
import async from 'async';
import request from 'request';
import xml2js from 'xml2js';
import http from 'http';
import querystring from 'querystring';
import _ from 'lodash';
import * as gal from 'google-auth-library';

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
	
	setAuthToken = function (auth_id) {
		if (auth_mode == 'anonymous') auth_mode = 'token';
		setAuthAndDependencies(auth_id);
	};
	
	// deprecated username/password login method
	// leaving it here to help notify users why it doesn't work
	setAuth = function (username, password, cb) {
		return cb(new Error('Google has officially deprecated ClientLogin. Please upgrade this module and see the readme for more instrucations'))
	};
	
	
	constructor(ss_key, auth_id, options){
		if (!ss_key) {
			throw new Error('Spreadsheet key not provided.');
		}
		
		const auth_client = new gal.GoogleAuth();
		let jwt_client;
		
		this.options = options || {};
		
		if (!options.visibility) {
			this.visibility = auth_id ? 'private' : 'public';
		}
		if (!options.projection) {
			this.projection = auth_id ? 'full' : 'values';
		}
		
		
		
	}
}



	const auth_client = new gal.GoogleAuth();
	let jwt_client;
	
	options = options || {};
	
	const xml_parser = new xml2js.Parser({
		// options carried over from older version of xml2js
		// might want to update how the code works, but for now this is fine
		explicitArray: false,
		explicitRoot: false
	});
	
	if (!ss_key) {
		throw new Error('Spreadsheet key not provided.');
	}
	
	// auth_id may be null
	setAuthAndDependencies(auth_id);
	
	// Authentication Methods
	
	this.setAuthToken = function (auth_id) {
		if (auth_mode == 'anonymous') auth_mode = 'token';
		setAuthAndDependencies(auth_id);
	};
	
	// deprecated username/password login method
	// leaving it here to help notify users why it doesn't work
	this.setAuth = function (username, password, cb) {
		return cb(new Error('Google has officially deprecated ClientLogin. Please upgrade this module and see the readme for more instrucations'))
	};
	
	this.useServiceAccountAuth = function (creds, cb) {
		if (typeof creds == 'string') {
			try {
				creds = require(creds);
			} catch (err) {
				return cb(err);
			}
		}
		jwt_client = new gal.JWT(creds.client_email, null, creds.private_key, GOOGLE_AUTH_SCOPE, null);
		renewJwtAuth(cb);
	};
	
	function renewJwtAuth(cb) {
		auth_mode = 'jwt';
		jwt_client.authorize(function (err, token) {
			if (err) return cb(err);
			self.setAuthToken({
				type: token.token_type,
				value: token.access_token,
				expires: token.expiry_date
			});
			cb()
		});
	}
	
	this.isAuthActive = function () {
		return !!google_auth;
	};
	
	
	function setAuthAndDependencies(auth) {
		google_auth = auth;
		if (!options.visibility) {
			visibility = google_auth ? 'private' : 'public';
		}
		if (!options.projection) {
			projection = google_auth ? 'full' : 'values';
		}
	}
	
	// This method is used internally to make all requests
	this.makeFeedRequest = function (url_params, method, query_or_data, cb) {
		let url;
		const headers = {};
		if (!cb) cb = function () {
		};
		if (typeof(url_params) == 'string') {
			// used for edit / delete requests
			url = url_params;
		} else if (Array.isArray(url_params)) {
			//used for get and post requets
			url_params.push(visibility, projection);
			url = GOOGLE_FEED_URL + url_params.join('/');
		}
		
		async.series({
			auth: function (step) {
				if (auth_mode != 'jwt') return step();
				// check if jwt token is expired
				if (google_auth && google_auth.expires > +new Date()) return step();
				renewJwtAuth(step);
			},
			request: function (result, step) {
				if (google_auth) {
					if (google_auth.type === 'Bearer') {
						headers['Authorization'] = 'Bearer ' + google_auth.value;
					} else {
						headers['Authorization'] = 'GoogleLogin auth=' + google_auth;
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
				}, function (err, response, body) {
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
						xml_parser.parseString(body, function (err, result) {
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
	this.getInfo = function (cb) {
		self.makeFeedRequest(['worksheets', ss_key], 'GET', null, function (err, data, xml) {
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
			worksheets.forEach(function (ws_data) {
				ss_data.worksheets.push(new SpreadsheetWorksheet(self, ws_data));
			});
			self.info = ss_data;
			self.worksheets = ss_data.worksheets;
			cb(null, ss_data);
		});
	};
	
	// NOTE: worksheet IDs start at 1
	
	this.addWorksheet = function (opts, cb) {
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
		
		var opts = _.extend({}, defaults, opts);
		
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
		
		self.makeFeedRequest(['worksheets', ss_key], 'POST', data_xml, function (err, data, xml) {
			if (err) return cb(err);
			
			const sheet = new SpreadsheetWorksheet(self, data);
			self.worksheets = self.worksheets || [];
			self.worksheets.push(sheet);
			sheet.setHeaderRow(opts.headers, function (err) {
				cb(err, sheet);
			})
		});
	};
	
	this.removeWorksheet = function (sheet_id, cb) {
		if (!this.isAuthActive()) return cb(new Error(REQUIRE_AUTH_MESSAGE));
		if (sheet_id instanceof SpreadsheetWorksheet) return sheet_id.del(cb);
		self.makeFeedRequest(GOOGLE_FEED_URL + 'worksheets/' + ss_key + '/private/full/' + sheet_id, 'DELETE', null, cb);
	};
	
	this.getRows = function (worksheet_id, opts, cb) {
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
		
		self.makeFeedRequest(['list', ss_key, worksheet_id], 'GET', query, function (err, data, xml) {
			if (err) return cb(err);
			if (data === true) {
				return cb(new Error('No response to getRows call'))
			}
			
			// gets the raw xml for each entry -- this is passed to the row object so we can do updates on it later
			
			let entries_xml = xml.match(/<entry[^>]*>([\s\S]*?)<\/entry>/g);
			
			
			// need to add the properties from the feed to the xml for the entries
			const feed_props = _.clone(data.$);
			delete feed_props['gd:etag'];
			const feed_props_str = _.reduce(feed_props, function (str, val, key) {
				return str + key + '=\'' + val + '\' ';
			}, '');
			entries_xml = _.map(entries_xml, function (xml) {
				return xml.replace('<entry ', '<entry ' + feed_props_str);
			});
			
			const rows = [];
			const entries = forceArray(data.entry);
			let i = 0;
			entries.forEach(function (row_data) {
				rows.push(new SpreadsheetRow(self, row_data, entries_xml[i++]));
			});
			cb(null, rows);
		});
	};
	
	this.addRow = function (worksheet_id, data, cb) {
		let data_xml = '<entry xmlns="http://www.w3.org/2005/Atom" xmlns:gsx="http://schemas.google.com/spreadsheets/2006/extended">' + '\n';
		Object.keys(data).forEach(function (key) {
			if (key != 'id' && key != 'title' && key != 'content' && key != '_links') {
				data_xml += '<gsx:' + xmlSafeColumnName(key) + '>' + xmlSafeValue(data[key]) + '</gsx:' + xmlSafeColumnName(key) + '>' + '\n'
			}
		});
		data_xml += '</entry>';
		self.makeFeedRequest(['list', ss_key, worksheet_id], 'POST', data_xml, function (err, data, new_xml) {
			if (err) return cb(err);
			const entries_xml = new_xml.match(/<entry[^>]*>([\s\S]*?)<\/entry>/g);
			const row = new SpreadsheetRow(self, data, entries_xml[0]);
			cb(null, row);
		});
	};
	
	this.getCells = function (worksheet_id, opts, cb) {
		// opts is optional
		if (typeof(opts) == 'function') {
			cb = opts;
			opts = {};
		}
		
		// Supported options are:
		// min-row, max-row, min-col, max-col, return-empty
		const query = _.assign({}, opts);
		
		
		self.makeFeedRequest(['cells', ss_key, worksheet_id], 'GET', query, function (err, data, xml) {
			if (err) return cb(err);
			if (data === true) {
				return cb(new Error('No response to getCells call'))
			}
			
			const cells = [];
			const entries = forceArray(data['entry']);
			const i = 0;
			entries.forEach(function (cell_data) {
				cells.push(new SpreadsheetCell(self, worksheet_id, cell_data));
			});
			
			cb(null, cells);
		});
	}
};
*/
