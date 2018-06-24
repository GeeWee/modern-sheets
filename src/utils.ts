import axios, { AxiosResponse } from 'axios';
import * as querystring from 'querystring';
import * as util from 'util';
import xml2js from 'xml2js';
import { AuthCredentials, Authentication, IndexSignature } from './types';

export function forceArray<T>(val: T | T[]): T[] {
	if (Array.isArray(val)) return val;
	if (!val) return [];
	return [val];
}

export function xmlSafeValue(val: number | string): string {
	if (val == null) return '';
	return String(val)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/\n/g, '&#10;')
		.replace(/\r/g, '&#13;');
}

export function xmlSafeColumnName(val: string): string {
	if (!val) return '';
	return String(val)
		.replace(/[\s_]+/g, '')
		.toLowerCase();
}

const xmlParser = new xml2js.Parser({
	// options carried over from older version of xml2js
	// might want to update how the code works, but for now this is fine
	explicitArray: false,
	explicitRoot: false,
});

export const makeRequest = async (
	method: 'POST' | 'PUT' | 'GET',
	url: string,
	query_or_data: undefined | any,
	auth_client: AuthCredentials,
): Promise<{ data: any; xml: any }> => {
	const headers: IndexSignature = {};
	if (auth_client) {
		//@ts-ignore
		if (auth_client.type === 'Bearer') {
			//@ts-ignore
			headers['Authorization'] = 'Bearer ' + auth_client.value;
		} else {
			headers['Authorization'] = 'GoogleLogin auth=' + auth_client;
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
		const promisifedParse = util.promisify(xmlParser.parseString) as any;
		const parseResult = await promisifedParse(response.data);
		return { data: parseResult, xml: response.data };

		// Wtf two returns?????
		//cb(null, result, body);
	}
	// No errors and no response. Return empty object here.
	//todo remove?
	return { data: null, xml: null };
};
